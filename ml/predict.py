import logging
from typing import Optional, Dict, Any

import joblib
import numpy as np

from config import ml_cfg
from rf_processing.features import extract_features
from ml.isolation_forest import PureNumpyIsolationForest, PureNumpyIsolationTree

logger = logging.getLogger(__name__)


class AnomalyPredictor:
    """
    Isolation Forest anomaly predictor.

    Automatically loads a persisted model from disk when available.
    Falls back to 'UNTRAINED' status when no model exists yet.
    """

    def __init__(self):
        self._model = None
        self._scaler = None
        self._trained = False
        self._load_model()

    # ------------------------------------------------------------------
    # Model management
    # ------------------------------------------------------------------
    def _load_model(self) -> None:
        try:
            if ml_cfg.IF_MODEL_PATH.exists() and ml_cfg.IF_SCALER_PATH.exists():
                self._scaler = joblib.load(ml_cfg.IF_SCALER_PATH)
                self._model = joblib.load(ml_cfg.IF_MODEL_PATH)
                self._trained = True
                logger.info('Isolation Forest model loaded from %s', ml_cfg.IF_MODEL_PATH)
            else:
                logger.info('No trained model found — predictor in UNTRAINED state')
        except Exception as exc:
            logger.error('Failed to load model: %s', exc)
            self._trained = False

    def reload(self) -> None:
        """Reload model from disk (call after training)."""
        self._model = None
        self._scaler = None
        self._trained = False
        self._load_model()

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------
    def predict(self, processed_measurement: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict anomaly status for a single processed measurement.

        Returns a dict with:
          - prediction: 'NORMAL' | 'ANOMALY' | 'UNTRAINED'
          - anomaly_score: float in [0, 1] (higher = more anomalous)
          - confidence: None (Isolation Forest does not output calibrated probabilities)
          - model_name: str
          - details: dict with intermediate values
        """
        if not self._trained:
            return {
                'prediction': 'UNTRAINED',
                'anomaly_score': None,
                'confidence': None,
                'model_name': 'isolation_forest',
                'details': {'reason': 'Model has not been trained yet'},
            }

        features = extract_features(processed_measurement)
        if features is None:
            return {
                'prediction': 'INSUFFICIENT_DATA',
                'anomaly_score': None,
                'confidence': None,
                'model_name': 'isolation_forest',
                'details': {'reason': 'Feature extraction failed — missing measurement fields'},
            }

        try:
            X = features.reshape(1, -1)
            X_scaled = self._scaler.transform(X)
            raw_pred = self._model.predict(X_scaled)[0]        # 1 = normal, -1 = anomaly
            score_sample = self._model.score_samples(X_scaled)[0]

            # Normalise score_samples to [0, 1] anomaly score
            # score_samples is negative; more negative = more anomalous
            # Typical range for IsolationForest: [-0.5, 0.5]
            anomaly_score = max(0.0, min(1.0, -score_sample))

            prediction = 'ANOMALY' if raw_pred == -1 else 'NORMAL'

            return {
                'prediction': prediction,
                'anomaly_score': round(float(anomaly_score), 4),
                'confidence': None,   # IsolationForest does not output calibrated probabilities
                'model_name': 'isolation_forest',
                'details': {
                    'raw_prediction': int(raw_pred),
                    'raw_score': round(float(score_sample), 4),
                    'feature_vector': features.tolist(),
                },
            }
        except Exception as exc:
            logger.error('Prediction error: %s', exc)
            return {
                'prediction': 'ERROR',
                'anomaly_score': None,
                'confidence': None,
                'model_name': 'isolation_forest',
                'details': {'error': str(exc)},
            }

    @property
    def is_trained(self) -> bool:
        return self._trained

    def get_status(self) -> Dict[str, Any]:
        return {
            'trained': self._trained,
            'model_name': 'isolation_forest',
            'model_path': str(ml_cfg.IF_MODEL_PATH),
            'note': (
                'Anomaly detection uses Isolation Forest. '
                'Predictions reflect statistical anomalies in RF power measurements. '
                'This is not a validated jammer classifier.'
            ),
        }
