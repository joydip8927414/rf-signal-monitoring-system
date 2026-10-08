import logging
from typing import Optional, Dict, Any, List

import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler

from config import ml_cfg
from rf_processing.features import feature_vector_from_list, feature_names
from ml.isolation_forest import get_isolation_forest_model, PureNumpyIsolationForest, PureNumpyIsolationTree

logger = logging.getLogger(__name__)


def train_isolation_forest(measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Train an Isolation Forest anomaly detector on historical measurements.

    Args:
        measurements: List of processed measurement dicts (from process_measurement).

    Returns:
        Dict with training results / metadata.
    """
    X = feature_vector_from_list(measurements)
    if X is None or len(X) < ml_cfg.MIN_TRAIN_SAMPLES:
        msg = (
            f'Not enough valid samples to train '
            f'(need {ml_cfg.MIN_TRAIN_SAMPLES}, got {len(X) if X is not None else 0})'
        )
        logger.warning(msg)
        return {'success': False, 'reason': msg}

    logger.info('Training Isolation Forest on %d samples, features: %s', len(X), feature_names())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = get_isolation_forest_model(
        contamination=ml_cfg.IF_CONTAMINATION,
        n_estimators=ml_cfg.IF_N_ESTIMATORS,
        random_state=42,
    )
    model.fit(X_scaled)

    # Persist
    joblib.dump(scaler, ml_cfg.IF_SCALER_PATH)
    joblib.dump(model, ml_cfg.IF_MODEL_PATH)

    # Evaluate on training set (informational only — not a substitute for holdout validation)
    scores = model.score_samples(X_scaled)
    predictions = model.predict(X_scaled)
    n_anomalies = int(np.sum(predictions == -1))

    result = {
        'success': True,
        'n_samples': len(X),
        'n_features': X.shape[1],
        'feature_names': feature_names(),
        'n_anomalies_detected': n_anomalies,
        'anomaly_ratio': round(n_anomalies / len(X), 4),
        'score_mean': round(float(np.mean(scores)), 4),
        'score_std': round(float(np.std(scores)), 4),
        'model_path': str(ml_cfg.IF_MODEL_PATH),
        'scaler_path': str(ml_cfg.IF_SCALER_PATH),
        'note': (
            'Isolation Forest training score (training set only). '
            'A holdout validation set is required for reliable performance estimates.'
        ),
    }
    logger.info('Training complete: %s', result)
    return result
