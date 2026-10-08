"""
Pure NumPy Isolation Forest Implementation.

Provides a 100% Python/NumPy implementation of Isolation Forest anomaly detection
that serves as a fallback when C-compiled scikit-learn DLLs are blocked by Windows
Application Control (WDAC / AppLocker) or missing dependencies.
"""

import logging
import math
from typing import List, Optional
import numpy as np

logger = logging.getLogger(__name__)


def c_factor(n: int) -> float:
    """Average path length of unsuccessful search in Binary Search Tree."""
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (math.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)


class PureNumpyIsolationTree:
    """Individual Isolation Tree built using random feature/split partitioning."""

    def __init__(self, max_depth: int):
        self.max_depth = max_depth
        self.feature_idx: Optional[int] = None
        self.split_val: Optional[float] = None
        self.left: Optional['PureNumpyIsolationTree'] = None
        self.right: Optional['PureNumpyIsolationTree'] = None
        self.size: int = 0
        self.is_leaf: bool = False

    def fit(self, X: np.ndarray, depth: int = 0, rng: Optional[np.random.RandomState] = None) -> None:
        n_samples, n_features = X.shape
        self.size = n_samples

        if depth >= self.max_depth or n_samples <= 1:
            self.is_leaf = True
            return

        feat_mins = X.min(axis=0)
        feat_maxs = X.max(axis=0)
        valid_feats = np.where(feat_maxs > feat_mins)[0]

        if len(valid_feats) == 0:
            self.is_leaf = True
            return

        self.feature_idx = int(rng.choice(valid_feats))
        min_v = float(feat_mins[self.feature_idx])
        max_v = float(feat_maxs[self.feature_idx])
        self.split_val = float(rng.uniform(min_v, max_v))

        left_mask = X[:, self.feature_idx] < self.split_val
        right_mask = ~left_mask

        if left_mask.sum() == 0 or right_mask.sum() == 0:
            self.is_leaf = True
            return

        self.left = PureNumpyIsolationTree(self.max_depth)
        self.left.fit(X[left_mask], depth + 1, rng)

        self.right = PureNumpyIsolationTree(self.max_depth)
        self.right.fit(X[right_mask], depth + 1, rng)

    def path_length(self, x: np.ndarray, depth: int = 0) -> float:
        if self.is_leaf or self.feature_idx is None:
            return float(depth) + c_factor(self.size)

        if x[self.feature_idx] < self.split_val:
            return self.left.path_length(x, depth + 1)
        else:
            return self.right.path_length(x, depth + 1)


class PureNumpyIsolationForest:
    """
    Pure NumPy Isolation Forest Anomaly Detector.
    Matches scikit-learn's IsolationForest interface (fit, predict, score_samples).
    """

    def __init__(self, n_estimators: int = 100, contamination: float = 0.1, random_state: int = 42):
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state
        self.trees: List[PureNumpyIsolationTree] = []
        self.threshold_: float = -0.5
        self.n_samples_train: int = 0

    def fit(self, X: np.ndarray) -> 'PureNumpyIsolationForest':
        rng = np.random.RandomState(self.random_state)
        n_samples = X.shape[0]
        self.n_samples_train = n_samples

        max_depth = int(math.ceil(math.log2(max(n_samples, 2))))
        self.trees = []
        subsample_size = min(256, n_samples)

        for _ in range(self.n_estimators):
            idx = rng.choice(n_samples, size=subsample_size, replace=False)
            tree = PureNumpyIsolationTree(max_depth=max_depth)
            tree.fit(X[idx], depth=0, rng=rng)
            self.trees.append(tree)

        scores = self.score_samples(X)
        self.threshold_ = float(np.percentile(scores, self.contamination * 100))
        return self

    def score_samples(self, X: np.ndarray) -> np.ndarray:
        c = c_factor(min(256, self.n_samples_train))
        if c == 0:
            return np.zeros(X.shape[0])

        paths = np.zeros((X.shape[0], len(self.trees)))
        for i, x in enumerate(X):
            for t_idx, tree in enumerate(self.trees):
                paths[i, t_idx] = tree.path_length(x)

        avg_paths = paths.mean(axis=1)
        scores = - (2.0 ** (- avg_paths / c))
        return scores

    def predict(self, X: np.ndarray) -> np.ndarray:
        scores = self.score_samples(X)
        return np.where(scores < self.threshold_, -1, 1)


def get_isolation_forest_model(contamination: float = 0.1, n_estimators: int = 100, random_state: int = 42):
    """
    Factory function that returns scikit-learn IsolationForest if binary DLLs are executable,
    or falls back automatically to PureNumpyIsolationForest.
    """
    try:
        from sklearn.ensemble import IsolationForest
        m = IsolationForest(contamination=contamination, n_estimators=n_estimators, random_state=random_state, n_jobs=1)
        # Test on dummy data to ensure no Application Control policy DLL error occurs during fit
        m.fit(np.random.randn(10, 2))
        logger.info("Using scikit-learn IsolationForest model")
        return IsolationForest(contamination=contamination, n_estimators=n_estimators, random_state=random_state, n_jobs=1)
    except Exception as exc:
        logger.info("scikit-learn IsolationForest unavailable (%s); using PureNumpyIsolationForest fallback", exc)
        return PureNumpyIsolationForest(contamination=contamination, n_estimators=n_estimators, random_state=random_state)
