"""Passage-volume model: expected passage count for a (station, date).

Self-contained: the fitted object carries the station vocabulary, the estimator
and the fallback rule, so training and inference share one code path and there
is no separate encoder to fall out of sync.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from . import RANDOM_SEED
from . import features as F


class VolumeModel:
    """fit() on a (tollID, date, total_passages) frame; predict() on (tollID, date)."""

    # Small, regularised forest: the per-station daily signal in this sample is
    # near-noise, so shallow trees both curb overfitting and keep the artifact
    # small. These are fixed, not tuned on any split.
    def __init__(self, n_estimators: int = 120, max_depth: int = 6,
                 min_samples_leaf: int = 3, random_state: int = RANDOM_SEED):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_leaf = min_samples_leaf
        self.random_state = random_state
        self.feature_names_ = F.VOLUME_FEATURES

    def fit(self, frame: pd.DataFrame) -> "VolumeModel":
        stations = sorted(frame["tollID"].astype(str).unique().tolist())
        self.station_index_ = {s: i for i, s in enumerate(stations)}
        self.global_mean_ = float(frame["total_passages"].mean()) if len(frame) else 0.0
        self.per_station_mean_ = (frame.groupby("tollID")["total_passages"].mean()
                                  .astype(float).to_dict())
        X = F.volume_matrix(frame, self.station_index_)
        y = frame["total_passages"].to_numpy(dtype=float)
        self.model_ = RandomForestRegressor(
            n_estimators=self.n_estimators, max_depth=self.max_depth,
            min_samples_leaf=self.min_samples_leaf,
            random_state=self.random_state, n_jobs=1)
        self.model_.fit(X, y)
        return self

    def predict(self, frame: pd.DataFrame) -> np.ndarray:
        frame = frame.copy()
        frame["tollID"] = frame["tollID"].astype(str)
        known = frame["tollID"].isin(self.station_index_)
        out = np.empty(len(frame), dtype=float)

        if known.any():
            Xk = F.volume_matrix(frame.loc[known], self.station_index_)
            out[known.to_numpy()] = self.model_.predict(Xk)
        if (~known).any():
            # explicit, documented fallback for stations unseen in training
            out[(~known).to_numpy()] = [
                self.per_station_mean_.get(s, self.global_mean_)
                for s in frame.loc[~known, "tollID"]
            ]

        out = np.clip(out, 0.0, None)
        if not np.all(np.isfinite(out)):
            out = np.nan_to_num(out, nan=self.global_mean_, posinf=self.global_mean_, neginf=0.0)
        return out

    # --- schema validation for inference -------------------------------
    REQUIRED_COLUMNS = ("tollID", "date")

    @classmethod
    def validate_frame(cls, frame: pd.DataFrame) -> None:
        missing = [c for c in cls.REQUIRED_COLUMNS if c not in frame.columns]
        if missing:
            raise ValueError(f"input is missing required column(s): {missing}")
