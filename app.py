"""
app.py - RF Monitor Flask application entry point.

Architecture:
  RF Source (Simulator | ESP32)
    -> DeviceInterface  (hardware abstraction)
    -> Measurement pipeline (RF processing, DB, AI)
    -> Flask REST API
    -> Browser Dashboard

Only this file and config.py know about the full application structure.
"""

import logging
import threading
from datetime import datetime, timezone

from flask import Flask, render_template, jsonify, redirect
from flask_cors import CORS

from config import flask_cfg, device_cfg
from database.db import init_db, insert_measurement, insert_event, insert_prediction
from device.interface import get_device_interface
from ml.predict import AnomalyPredictor
from rf_processing.signal_processing import process_measurement
from api.routes import api_bp

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(name)s  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
def create_app() -> Flask:
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.secret_key = flask_cfg.SECRET_KEY
    CORS(app, origins=flask_cfg.CORS_ORIGINS)

    # -- Database -----------------------------------------------------------
    init_db()

    # -- Device interface ---------------------------------------------------
    iface = get_device_interface()
    iface.connect()
    app.config['DEVICE_INTERFACE'] = iface

    # -- AI predictor -------------------------------------------------------
    predictor = AnomalyPredictor()
    app.config['AI_PREDICTOR'] = predictor

    # -- Register measurement pipeline callback ----------------------------
    def on_measurement(m):
        """Called for every measurement from the device stream."""
        try:
            processed = process_measurement(m.to_dict())

            # AI prediction
            pred = predictor.predict(processed)
            ai_prediction = pred.get('prediction')
            ai_score = pred.get('anomaly_score')

            # Persist measurement
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

            # Persist AI prediction
            if ai_prediction and ai_prediction not in ('UNTRAINED', 'INSUFFICIENT_DATA', 'ERROR'):
                insert_prediction({
                    'timestamp': m.timestamp,
                    'measurement_id': meas_id,
                    'model_name': pred.get('model_name', 'isolation_forest'),
                    'prediction': ai_prediction,
                    'anomaly_score': ai_score,
                    'confidence': pred.get('confidence'),
                })

            # Simple event detection
            if processed.get('has_alerts') or ai_prediction == 'ANOMALY':
                evt = {
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
                }
                insert_event(evt)

        except Exception as exc:
            logger.error('Measurement pipeline error: %s', exc, exc_info=True)

    iface.register_callback(on_measurement)
    iface.start_stream()
    logger.info('Measurement stream started (source=%s)', device_cfg.SOURCE)

    # -- Global Error Handlers (Ensures CORS on 404/500) -------------------
    @app.errorhandler(Exception)
    def handle_exception(e):
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            return jsonify(error=e.description), e.code
        logger.error('Unhandled exception: %s', e, exc_info=True)
        return jsonify(error="Internal Server Error"), 500

    # -- Register blueprints -----------------------------------------------
    app.register_blueprint(api_bp)

    # -- Routes — Redirect non-API requests to React App -------------------
    REACT_APP_URL = 'http://localhost:5173'

    @app.route('/')
    def dashboard():
        return redirect(REACT_APP_URL)

    @app.route('/spectrum')
    def spectrum():
        return redirect(f"{REACT_APP_URL}/analytics")

    @app.route('/events')
    def events():
        return redirect(f"{REACT_APP_URL}/events")

    @app.route('/history')
    def history():
        return redirect(f"{REACT_APP_URL}/history")

    @app.route('/device')
    def device():
        return redirect(f"{REACT_APP_URL}/device")

    @app.route('/calibration')
    def calibration():
        return redirect(f"{REACT_APP_URL}/calibration")

    @app.route('/ai-analysis')
    def ai_analysis():
        return redirect(f"{REACT_APP_URL}/ai")

    @app.route('/coverage')
    def coverage():
        return redirect(f"{REACT_APP_URL}/coverage")

    logger.info(
        'RF Monitor application ready — http://%s:%d',
        flask_cfg.HOST, flask_cfg.PORT
    )
    return app


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
app = create_app()

if __name__ == '__main__':
    app.run(
        host=flask_cfg.HOST,
        port=flask_cfg.PORT,
        debug=flask_cfg.DEBUG,
        use_reloader=False,    # Reloader would spawn duplicate stream threads
    )
