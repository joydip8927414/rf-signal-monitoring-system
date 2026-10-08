import logging
from typing import Dict, Any, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_FEATURE_NAMES = [
    'signal_dbm',
    'noise_dbm',
    'snr_db',
    'rolling_mean_dbm',
    'rolling_std_db',
    'rate_of_change_db',
    'detector_voltage',
]


def extract_features(processed: Dict[str, Any]) -> Optional[np.ndarray]:
    """
    Extract a numeric feature vector from a processed measurement dict.
    Returns None if required fields are missing.
    Feature order must be consistent — used by both training and inference.
    """
    vec = []
    for name in _FEATURE_NAMES:
        val = processed.get(name)
        if val is None:
            return None
        vec.append(float(val))
    return np.array(vec, dtype=np.float32)


def feature_names() -> List[str]:
    return list(_FEATURE_NAMES)


def feature_vector_from_list(measurements: List[Dict[str, Any]]) -> Optional[np.ndarray]:
    """Build a 2-D feature matrix from a list of processed measurements."""
    rows = []
    for m in measurements:
        vec = extract_features(m)
        if vec is not None:
            rows.append(vec)
    if not rows:
        return None
    return np.vstack(rows)
