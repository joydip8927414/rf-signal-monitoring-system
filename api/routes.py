import json
import logging
import statistics
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request, current_app, Response

from api.schemas import measurement_schema, event_schema, error_response, success_response

logger = logging.getLogger(__name__)
api_bp = Blueprint("api", __name__, url_prefix="/api")


def _iface():
    return current_app.config["DEVICE_INTERFACE"]


def _pred():
    return current_app.config["AI_PREDICTOR"]


@api_bp.route("/health")
def health():
    iface = _iface()
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "device_connected": iface.is_connected,
        "data_source": iface.get_status().get("data_source", "unknown"),
    })


@api_bp.route("/device/status")
def device_status():
    try:
        return jsonify(_iface().get_status())
    except Exception as e:
        return jsonify(error_response(str(e))), 500

import os
from device.interface import RFMeasurement

@api_bp.route("/device/measurements", methods=["POST"])
def ingest_measurement():
    """Endpoint for ESP32 to push real measurements over the internet."""
    try:
        # Authenticate device
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        expected_token = os.environ.get("DEVICE_TOKEN")
        
        if not expected_token:
            logger.error("DEVICE_TOKEN is not set in environment variables!")
            return jsonify(error_response("Server configuration error", 500)), 500
            
        if token != expected_token:
            return jsonify(error_response("Unauthorized", 401)), 401

        data = request.get_json(force=True)
        
        # Validation
        if "signal_dbm" not in data:
            return jsonify(error_response("Missing signal_dbm", 400)), 400

        # Construct measurement explicitly to avoid accepting fabricated data
        m = RFMeasurement(
            device_id=data.get("device_id", current_app.config.get("DEVICE_ID", "ESP32-RF-001")),
            timestamp=data.get("timestamp") or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            frequency_hz=data.get("frequency_hz"),
            signal_dbm=float(data["signal_dbm"]),
            noise_dbm=float(data["noise_dbm"]) if "noise_dbm" in data else None,
            snr_db=float(data["snr_db"]) if "snr_db" in data else None,
            adc_value=int(data["adc_value"]) if "adc_value" in data else None,
            detector_voltage=float(data["detector_voltage"]) if "detector_voltage" in data else None,
            lna_enabled=bool(data.get("lna_enabled", False)),
            data_source="real", # Force 'real', don't trust client
            metadata={
                'latitude': float(data['latitude']) if data.get('latitude') is not None else None,
                'longitude': float(data['longitude']) if data.get('longitude') is not None else None,
                'altitude_m': float(data['altitude_m']) if data.get('altitude_m') is not None else None,
            }
        )
        
        # We manually process it since the stream loop won't pick this up
        from database.db import insert_measurement, insert_event, insert_prediction
        from rf_processing.signal_processing import process_measurement
        
        processed = process_measurement(m.to_dict())
        pred = _pred().predict(processed)
        ai_prediction = pred.get('prediction')
        ai_score = pred.get('anomaly_score')
        
        # Update latest measurement in memory
        with _iface()._lock:
            _iface()._latest = m
            
        # Build dict explicitly for the DB schema
        db_row = {
            'timestamp': m.timestamp,
            'device_id': m.device_id,
            'frequency_hz': m.frequency_hz,
            'signal_dbm': m.signal_dbm,
            'noise_dbm': m.noise_dbm,
            'snr_db': m.snr_db,
            'adc_value': m.adc_value,
            'detector_voltage': m.detector_voltage,
            'lna_enabled': 1 if m.lna_enabled else 0,
            'data_source': m.data_source,
        }
        
        meas_id = insert_measurement(db_row)
        
        if ai_prediction and ai_prediction not in ('UNTRAINED', 'INSUFFICIENT_DATA', 'ERROR'):
            insert_prediction({
                'timestamp': m.timestamp,
                'measurement_id': meas_id,
                'model_name': pred.get('model_name', 'isolation_forest'),
                'prediction': ai_prediction,
                'anomaly_score': ai_score,
                'confidence': pred.get('confidence'),
            })

        if processed.get('has_alerts') or ai_prediction == 'ANOMALY':
            insert_event({
                'start_time': m.timestamp,
                'peak_power_dbm': m.signal_dbm,
                'avg_power_dbm': m.signal_dbm,
                'event_type': 'ANOMALY' if ai_prediction == 'ANOMALY' else 'ALERT',
                'noise_dbm': m.noise_dbm,
                'snr_db': m.snr_db,
                'ai_anomaly_score': ai_score,
                'ai_classification': ai_prediction,
                'device_id': m.device_id,
                'data_source': m.data_source,
            })

        # We fire the callbacks so connected clients (if we ever use websockets) get it
        for cb in _iface()._callbacks:
            try:
                cb(m)
            except Exception as e:
                logger.error('Stream callback error during ingestion: %s', e)

        return jsonify(success_response({"timestamp": m.timestamp}, "Measurement ingested")), 201

    except ValueError as ve:
        return jsonify(error_response(f"Invalid data format: {ve}", 400)), 400
    except Exception as e:
        logger.error("ingest_measurement error: %s", e, exc_info=True)
        return jsonify(error_response(str(e))), 500


@api_bp.route("/measurements/latest")
def measurements_latest():
    try:
        m = _iface().get_latest()
        if m is None:
            return jsonify(error_response("No measurement yet", 404)), 404
        from rf_processing.signal_processing import process_measurement
        p = process_measurement(m.to_dict())
        pred = _pred().predict(p)
        p["ai_prediction"]    = pred.get("prediction")
        p["ai_anomaly_score"] = pred.get("anomaly_score")
        p["ai_details"]       = pred.get("details", {})
        return jsonify(measurement_schema(p))
    except Exception as e:
        logger.error("measurements_latest: %s", e)
        return jsonify(error_response(str(e))), 500


@api_bp.route("/measurements/history")
def measurements_history():
    try:
        from database.db import get_measurements_since, get_latest_measurements
        minutes = int(request.args.get("minutes", 5))
        limit   = int(request.args.get("limit", 2000))
        since   = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        rows    = get_measurements_since(since.replace(tzinfo=None), limit=limit)
        if not rows:
            latest = get_latest_measurements(limit=min(limit, 200))
            if latest:
                rows = list(reversed(latest))
        return jsonify({"count": len(rows), "data": rows})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/analytics/summary")
def analytics_summary():
    try:
        from database.db import get_measurements_since
        minutes = int(request.args.get("minutes", 60))
        since   = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        rows    = get_measurements_since(since.replace(tzinfo=None), limit=10000)
        if not rows:
            return jsonify({"count": 0, "summary": None})
        def _stats(vals):
            v = [x for x in vals if x is not None]
            if not v: return None
            return {"min": round(min(v),3), "max": round(max(v),3),
                    "mean": round(statistics.mean(v),3), "median": round(statistics.median(v),3),
                    "stdev": round(statistics.stdev(v),3) if len(v)>1 else 0}
        return jsonify({
            "count": len(rows), "period_minutes": minutes,
            "signal_dbm":  _stats([r["signal_dbm"]       for r in rows]),
            "noise_dbm":   _stats([r["noise_dbm"]         for r in rows]),
            "snr_db":      _stats([r["snr_db"]            for r in rows]),
            "detector_v":  _stats([r["detector_voltage"]  for r in rows]),
            "adc":         _stats([r["adc_value"]         for r in rows]),
        })
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/analytics/distribution")
def analytics_distribution():
    try:
        from database.db import get_measurements_since
        import numpy as np
        minutes = int(request.args.get("minutes", 60))
        since   = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        rows    = get_measurements_since(since.replace(tzinfo=None), limit=10000)
        def _hist(vals, bins=20):
            v = np.array([x for x in vals if x is not None], dtype=float)
            if len(v) < 5: return None
            counts, edges = np.histogram(v, bins=bins)
            return {"counts": counts.tolist(),
                    "edges": [round(float(e),2) for e in edges.tolist()],
                    "mean": round(float(v.mean()),2), "std": round(float(v.std()),2)}
        return jsonify({
            "signal_dbm": _hist([r["signal_dbm"] for r in rows]),
            "snr_db":     _hist([r["snr_db"]     for r in rows]),
            "noise_dbm":  _hist([r["noise_dbm"]  for r in rows]),
        })
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/analytics/compare")
def analytics_compare():
    try:
        from database.db import get_measurement_range
        minutes = int(request.args.get("minutes", 5))
        now = datetime.now(timezone.utc)
        end1 = now; start1 = now - timedelta(minutes=minutes); start2 = start1 - timedelta(minutes=minutes)
        cur  = get_measurement_range(start1.replace(tzinfo=None), end1.replace(tzinfo=None))
        prev = get_measurement_range(start2.replace(tzinfo=None), start1.replace(tzinfo=None))
        def _avg(rows, key):
            v = [r[key] for r in rows if r.get(key) is not None]
            return round(statistics.mean(v), 2) if v else None
        return jsonify({"period_minutes": minutes,
            "current":  {"count": len(cur),  "signal_mean": _avg(cur,"signal_dbm"),  "noise_mean": _avg(cur,"noise_dbm"),  "snr_mean": _avg(cur,"snr_db")},
            "previous": {"count": len(prev), "signal_mean": _avg(prev,"signal_dbm"), "noise_mean": _avg(prev,"noise_dbm"), "snr_mean": _avg(prev,"snr_db")},
        })
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/analytics/timeseries")
def analytics_timeseries():
    try:
        from database.db import get_measurements_since, get_latest_measurements
        minutes = int(request.args.get("minutes", 60))
        points  = int(request.args.get("points", 300))
        since   = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        rows    = get_measurements_since(since.replace(tzinfo=None), limit=10000)
        
        # If time-based query returns empty (e.g. clock differences or initial startup),
        # fall back to the most recent measurements from the database
        if not rows:
            latest = get_latest_measurements(limit=min(points, 300))
            if latest:
                rows = list(reversed(latest))

        # If still empty, produce an initial measurement from the device interface
        if not rows:
            m = _iface().get_latest()
            if m:
                rows = [{
                    "timestamp": m.timestamp,
                    "signal_dbm": m.signal_dbm,
                    "noise_dbm": m.noise_dbm,
                    "snr_db": m.snr_db,
                    "adc_value": m.adc_value,
                    "detector_voltage": m.detector_voltage,
                }]

        if len(rows) > points:
            step = max(1, len(rows) // points)
            rows = rows[::step]
        return jsonify({"count": len(rows), "series": [
            {"t": r["timestamp"], "sig": r["signal_dbm"], "noise": r["noise_dbm"],
             "snr": r["snr_db"], "adc": r["adc_value"], "vdet": r["detector_voltage"]}
            for r in rows
        ]})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/events")
def get_events():
    try:
        from database.db import get_events
        limit = int(request.args.get("limit", 200))
        events = get_events(limit=limit)
        return jsonify({"count": len(events), "data": [event_schema(e) for e in events]})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


# Auto-train global state stored on current_app config or module level
_AUTO_TRAIN_CFG = {
    "enabled": True,
    "interval_minutes": 10,
    "mode": "online", # "online" or "offline"
    "last_trained": None,
    "train_count": 0,
}

@api_bp.route("/ai/status")
def ai_status():
    try:
        status = _pred().get_status()
        status["auto_train"] = _AUTO_TRAIN_CFG
        return jsonify(status)
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/ai/train", methods=["POST"])
def ai_train():
    try:
        from database.db import get_measurements_since, get_latest_measurements
        from rf_processing.signal_processing import process_measurement
        from ml.train import train_isolation_forest

        body = request.json or {}
        mode = body.get("mode", "online")  # "online" or "offline"
        minutes = int(body.get("minutes", 60))

        if mode == "offline":
            # Offline training on full recorded historical dataset
            rows = get_latest_measurements(limit=5000)
        else:
            # Online training on recent streaming buffer
            since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
            rows = get_measurements_since(since.replace(tzinfo=None))
            if len(rows) < 10:
                rows = get_latest_measurements(limit=500)

        result = train_isolation_forest([process_measurement(r) for r in rows])
        if result["success"]:
            _pred().reload()
            _AUTO_TRAIN_CFG["last_trained"] = datetime.now(timezone.utc).isoformat()
            _AUTO_TRAIN_CFG["train_count"] += 1
            result["mode_used"] = mode

        return jsonify(result)
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/ai/autotrain", methods=["GET", "POST"])
def ai_autotrain():
    try:
        if request.method == "POST":
            body = request.json or {}
            if "enabled" in body:
                _AUTO_TRAIN_CFG["enabled"] = bool(body["enabled"])
            if "interval_minutes" in body:
                _AUTO_TRAIN_CFG["interval_minutes"] = max(1, int(body["interval_minutes"]))
            if "mode" in body:
                _AUTO_TRAIN_CFG["mode"] = str(body["mode"])
        return jsonify({"success": True, "config": _AUTO_TRAIN_CFG})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/ai/predictions")
def ai_predictions():
    try:
        from database.db import get_predictions
        limit = int(request.args.get("limit", 100))
        return jsonify({"count": 0, "data": get_predictions(limit=limit)})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/copilot/chat", methods=["POST"])
def copilot_chat():
    """RF Copilot: answers questions from real RF project data. SIMULATED vs REAL always shown."""
    try:
        from database.db import get_measurements_since, get_events
        from rf_processing.signal_processing import process_measurement
        data     = request.get_json(force=True)
        question = (data.get("message") or "").strip().lower()
        if not question:
            return jsonify(error_response("Empty message", 400)), 400
        m         = _iface().get_latest()
        processed = process_measurement(m.to_dict()) if m else {}
        pred      = _pred().predict(processed) if processed else {}
        since5    = datetime.now(timezone.utc) - timedelta(minutes=5)
        since60   = datetime.now(timezone.utc) - timedelta(minutes=60)
        recent5   = get_measurements_since(since5.replace(tzinfo=None),  limit=500)
        recent60  = get_measurements_since(since60.replace(tzinfo=None), limit=5000)
        events    = get_events(limit=20)
        sig   = m.signal_dbm       if m else None
        noise = m.noise_dbm        if m else None
        snr   = m.snr_db           if m else None
        vdet  = m.detector_voltage if m else None
        adc   = m.adc_value        if m else None
        ai_pr = pred.get("prediction", "UNTRAINED")
        ai_sc = pred.get("anomaly_score")
        def _avg(rows, key):
            v = [r[key] for r in rows if r.get(key) is not None]
            return round(statistics.mean(v),2) if v else None
        def _max(rows, key):
            v = [r[key] for r in rows if r.get(key) is not None]
            return round(max(v),2) if v else None
        def _min(rows, key):
            v = [r[key] for r in rows if r.get(key) is not None]
            return round(min(v),2) if v else None
        sig5   = _avg(recent5,"signal_dbm"); sig60 = _avg(recent60,"signal_dbm")
        snr5   = _avg(recent5,"snr_db");     ns5   = _avg(recent5,"noise_dbm")
        n_ano  = sum(1 for e in events if e.get("ai_classification")=="ANOMALY")
        src    = (m.data_source if m else "unknown").upper()
        resp   = ""
        q = question
        if any(w in q for w in ["what is happening","right now","current status","status now","happening now"]):
            tr = ""
            if sig is not None and sig5 is not None:
                d = round(sig-sig5,1)
                tr = f"Signal is {'rising' if d>1 else 'falling' if d<-1 else 'stable'} ({d:+.1f} dB vs 5-min avg)."
            resp = (f"**Current RF Status** [{src}]\n\n"
                    f"- Signal: **{sig:.1f} dBm** | Noise: **{noise:.1f} dBm** | SNR: **{snr:.1f} dB**\n"
                    f"- Detector: {vdet:.4f} V | ADC: {adc}\n"
                    f"- AI: **{ai_pr}**" + (f" (score: {ai_sc:.3f})" if ai_sc is not None else "") +
                    f"\n- {tr}") if sig is not None else "No measurement data yet."
        elif any(w in q for w in ["signal power","power level","dbm","signal strength"]):
            resp = (f"**Signal Power** [{src}]\n\n- Current: **{sig:.1f} dBm**\n"
                    f"- 5-min avg: {sig5} | Max: {_max(recent5,'signal_dbm')} | Min: {_min(recent5,'signal_dbm')}\n"
                    f"- 60-min avg: {sig60} dBm\n\n"
                    "AD8317 measures broadband RF power. Less-negative = stronger signal.") if sig else "Signal data not available."
        elif any(w in q for w in ["snr","signal to noise","signal-to-noise"]):
            qual = "excellent" if snr and snr>30 else "good" if snr and snr>15 else "marginal" if snr and snr>5 else "poor"
            resp = (f"**SNR Analysis** [{src}]\n\n- SNR: **{snr:.1f} dB** ({qual})\n"
                    f"- 5-min avg: {snr5} dB | Min: {_min(recent5,'snr_db')}\n\n"
                    f"SNR = Signal - Noise = {sig:.1f} - {noise:.1f} = {snr:.1f} dB.") if snr else "SNR data not available."
        elif any(w in q for w in ["noise","noise floor"]):
            resp = (f"**Noise Floor** [{src}]\n\n- Current: **{noise:.1f} dBm** | 5-min avg: {ns5}\n"
                    f"- Max: {_max(recent5,'noise_dbm')} | Min: {_min(recent5,'noise_dbm')}\n\n"
                    "A rising noise floor may indicate interference. Frequency-resolved equipment needed for identification.") if noise else "Noise data not available."
        elif any(w in q for w in ["anomaly","abnormal","unusual","interference","jammer"]):
            sc_s = f"{ai_sc:.3f}" if ai_sc else "N/A"
            resp = f"**AI Assessment** [{src}]\n\n- Classification: **{ai_pr}** | Score: {sc_s}\n- Anomalies (5 min): {n_ano}\n\n"
            if ai_pr == "ANOMALY":
                resp += (f"Statistical anomaly detected.\n- Signal: {sig:.1f} dBm (5-min avg: {sig5})\n- SNR: {snr:.1f} dB | Noise: {noise:.1f} dBm\n\n"
                         "WARNING: Statistical deviation only. High power does NOT confirm a jammer. Frequency-resolved analysis required.")
            elif ai_pr == "UNTRAINED": resp += "Model not trained yet. Use the AI Analysis page."
            else: resp += "RF environment is within the normal statistical range."
        elif any(w in q for w in ["maximum","max","peak power","highest"]):
            resp = (f"**Peak Power** [{src}]\n\n- Last 5 min: **{_max(recent5,'signal_dbm')} dBm**\n"
                    f"- Last 60 min: **{_max(recent60,'signal_dbm')} dBm**")
        elif any(w in q for w in ["how many","count","events","anomalies today"]):
            resp = (f"**Event Summary**\n\n- Total events: {len(events)}\n- Anomalies (5 min): {n_ano}\n"
                    f"- Recent types: {', '.join(set(e.get('event_type','?') for e in events[:5])) if events else 'None'}")
        elif any(w in q for w in ["last 5","past 5","recent","summary","summarize","summarise"]):
            resp = (f"**5-Minute Summary** [{src}]\n\n- Samples: {len(recent5)}\n"
                    f"- Avg signal: {sig5} | Max: {_max(recent5,'signal_dbm')} | Min: {_min(recent5,'signal_dbm')}\n"
                    f"- Avg SNR: {snr5} dB | Avg noise: {ns5} dBm\n- Anomalies: {n_ano} | AI: **{ai_pr}**")
        elif any(w in q for w in ["device","hardware","esp32","health"]):
            st = _iface().get_status()
            resp = (f"**Device Health**\n\n- ID: {st.get('device_id')} | Source: **{st.get('data_source')}**\n"
                    f"- Status: {st.get('status')} | Streaming: {st.get('streaming')}\n"
                    f"- Uptime: {st.get('uptime_s')} s | Samples: {st.get('sample_count')}\n"
                    f"- RSSI: {st.get('wifi_rssi') or 'N/A'} | IP: {st.get('ip_address')}")
        elif any(w in q for w in ["compare","versus","vs","previous period"]):
            if sig5 and sig60:
                d = round(sig5-sig60,2)
                resp = (f"**Period Comparison** [{src}]\n\n- Last 5-min avg: {sig5} dBm\n"
                        f"- Last 60-min avg: {sig60} dBm\n- Difference: **{d:+.2f} dB**")
            else: resp = "Insufficient data for comparison."
        elif any(w in q for w in ["spectrum","frequency","freq"]):
            resp = ("**Spectrum**\n\nAD8317 is a broadband power detector. No frequency resolution available.\n"
                    "True spectrum requires SDR or swept receiver.\n\n"
                    f"Broadband power: **{sig:.1f} dBm**" if sig else "Broadband power: N/A")
        elif any(w in q for w in ["coverage","map","location","gps"]):
            resp = ("**Coverage & Location**\n\nNo location data available.\n"
                    "Requires GPS-tagged measurements. Coordinates are never fabricated.")
        elif any(w in q for w in ["detector","voltage","adc","ad8317"]):
            resp = (f"**AD8317 Readings** [{src}]\n\n- Voltage: **{vdet:.4f} V** | ADC: **{adc}**/4095\n"
                    f"- Derived power: **{sig:.1f} dBm**\n\nAD8317: V ~ slope*(P_in - intercept), slope ~ -25mV/dB.") if vdet else "Detector data not available."
        else:
            s = f"{sig:.1f} dBm" if sig else "N/A"
            r = f"{snr:.1f} dB"  if snr else "N/A"
            resp = (f"**RF Copilot** [{src}]\n\nAsk me about:\n- Current status / what is happening\n"
                    f"- Signal power / SNR / noise\n- Anomalies / interference\n- 5-minute summary\n"
                    f"- Compare periods\n- Device health\n- AD8317 detector\n- Spectrum limitations\n"
                    f"- Coverage / GPS\n\nCurrent: Signal={s} | SNR={r} | AI={ai_pr}")
        return jsonify({"response": resp, "timestamp": datetime.now(timezone.utc).isoformat(), "data_source": src})
    except Exception as e:
        logger.error("copilot_chat: %s", e, exc_info=True)
        return jsonify(error_response(str(e))), 500


@api_bp.route("/calibration", methods=["GET"])
def get_calibration():
    try:
        from database.db import get_calibration_history
        from config import device_cfg
        hist = get_calibration_history(device_cfg.DEVICE_ID)
        return jsonify({"latest": hist[0] if hist else None, "history": hist})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/calibration", methods=["POST"])
def post_calibration():
    try:
        from database.db import insert_calibration
        from config import device_cfg
        d = request.get_json(force=True)
        ref = float(d["reference_dbm"]); meas = float(d["measured_dbm"])
        cal = {"timestamp": datetime.now(timezone.utc).isoformat(), "device_id": device_cfg.DEVICE_ID,
               "reference_dbm": ref, "measured_dbm": meas, "correction_db": round(ref-meas,4), "notes": d.get("notes","")}
        insert_calibration(cal)
        return jsonify(success_response(cal, "Calibration recorded"))
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/export")
def export_data():
    try:
        from database.db import get_measurements_since, get_events, get_predictions
        fmt = request.args.get("format","json"); minutes = int(request.args.get("minutes",60))
        since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        measurements = get_measurements_since(since.replace(tzinfo=None))
        events = get_events(); preds = get_predictions()
        if fmt == "csv":
            import csv, io
            out = io.StringIO()
            if measurements:
                w = csv.DictWriter(out, fieldnames=measurements[0].keys())
                w.writeheader(); w.writerows(measurements)
            return Response(out.getvalue(), mimetype="text/csv",
                            headers={"Content-Disposition": "attachment; filename=rf_measurements.csv"})
        return jsonify({"exported_at": datetime.now(timezone.utc).isoformat(),
                        "measurements": measurements, "events": events, "predictions": preds})
    except Exception as e:
        return jsonify(error_response(str(e))), 500


@api_bp.route("/settings")
def get_settings():
    from config import device_cfg, rf_cfg, ml_cfg, alert_cfg
    return jsonify({
        "data_source": device_cfg.SOURCE, "device_id": device_cfg.DEVICE_ID,
        "sim_interval_s": device_cfg.SIM_INTERVAL_S, "sim_base_power_dbm": device_cfg.SIM_BASE_POWER_DBM,
        "sim_noise_floor_dbm": device_cfg.SIM_NOISE_FLOOR_DBM, "rolling_window": rf_cfg.ROLLING_WINDOW,
        "alert_power_high_dbm": alert_cfg.POWER_HIGH_DBM, "alert_power_low_dbm": alert_cfg.POWER_LOW_DBM,
        "alert_snr_low_db": alert_cfg.SNR_LOW_DB, "anomaly_threshold": alert_cfg.ANOMALY_SCORE_THRESHOLD,
        "if_contamination": ml_cfg.IF_CONTAMINATION, "spectrum_mode": device_cfg.SIM_SPECTRUM_MODE,
    })


@api_bp.route("/simulator/config", methods=["GET", "POST"])
def simulator_config():
    """Retrieve or dynamically adjust the physics simulation parameters."""
    try:
        driver = getattr(_iface(), "_driver", None)
        if not hasattr(driver, "get_config"):
            return jsonify(error_response("Active driver is not SimulatorDriver", 400)), 400

        if request.method == "POST":
            data = request.get_json(force=True) or {}
            updated = driver.update_config(data)
            return jsonify(success_response(updated, "Simulation configuration updated"))

        return jsonify(driver.get_config())
    except Exception as e:
        logger.error("simulator_config error: %s", e)
        return jsonify(error_response(str(e))), 500


@api_bp.route("/simulator/scenario", methods=["POST"])
def simulator_scenario():
    """Apply a preset physics test scenario (baseline, increased_distance, obstacle_introduced, etc.)."""
    try:
        driver = getattr(_iface(), "_driver", None)
        if not hasattr(driver, "apply_scenario"):
            return jsonify(error_response("Active driver is not SimulatorDriver", 400)), 400

        data = request.get_json(force=True) or {}
        scenario_name = data.get("scenario")
        if not scenario_name:
            return jsonify(error_response("Missing scenario name", 400)), 400

        ok = driver.apply_scenario(scenario_name)
        if not ok:
            return jsonify(error_response(f"Unknown scenario '{scenario_name}'", 400)), 400

        return jsonify(success_response(driver.get_config(), f"Scenario '{scenario_name}' activated"))
    except Exception as e:
        logger.error("simulator_scenario error: %s", e)
        return jsonify(error_response(str(e))), 500

