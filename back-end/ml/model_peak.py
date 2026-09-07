"""Peak-hour model.

Methodology (not direct hour regression):
  1. build hourly passage counts per (date, hour) for the operator;
  2. fit a regressor for the expected count of a given hour on a given date;
  3. at inference, predict all 24 hourly counts for the requested date and
     return argmax -> an integer hour in [0, 23].

This makes the output an integer, respects that hours are circular (the model
never "averages" 23:00 and 00:00), and lets us evaluate with circular metrics.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from . import RANDOM_SEED
from . import features as F

HOURS = list(range(24))


class PeakModel:
    """fit() on a (date, hour, count) frame; predict_peak_hour() on a list of dates."""

    def __init__(self, n_estimators: int = 120, max_depth: int = 6,
                 min_samples_leaf: int = 3, random_state: int = RANDOM_SEED):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_leaf = min_samples_leaf
        self.random_state = random_state
        self.feature_names_ = F.PEAK_FEATURES

    def fit(self, hourly: pd.DataFrame) -> "PeakModel":
        X = F.peak_matrix(hourly)
        y = hourly["count"].to_numpy(dtype=float)
        self.model_ = RandomForestRegressor(
            n_estimators=self.n_estimators, max_depth=self.max_depth,
            min_samples_leaf=self.min_samples_leaf,
            random_state=self.random_state, n_jobs=1)
        self.model_.fit(X, y)
        # global fallback: the most common actual peak hour in training
        peaks = (hourly.sort_values(["count", "hour"], ascending=[False, True])
                 .groupby("date").head(1))
        self.fallback_hour_ = int(peaks["hour"].mode().iloc[0]) if len(peaks) else 12
        return self

    def predict_hourly(self, dates) -> pd.DataFrame:
        dates = [pd.Timestamp(d).normalize() for d in dates]
        grid = pd.MultiIndex.from_product([dates, HOURS], names=["date", "hour"]).to_frame(index=False)
        grid["pred_count"] = np.clip(self.model_.predict(F.peak_matrix(grid)), 0.0, None)
        return grid

    def predict_peak_hour(self, dates) -> pd.DataFrame:
        grid = self.predict_hourly(dates)
        rows = []
        for date, g in grid.groupby("date"):
            g = g.sort_values(["pred_count", "hour"], ascending=[False, True])
            top = g.iloc[0]
            hour = int(top["hour"]) if np.isfinite(top["pred_count"]) and top["pred_count"] > 0 \
                else self.fallback_hour_
            rows.append({"date": pd.Timestamp(date).strftime("%Y-%m-%d"),
                         "predicted_hour": int(hour),
                         "predicted_peak_count": round(float(top["pred_count"]), 3)})
        return pd.DataFrame(rows)

    REQUIRED_COLUMNS = ("date",)

    @classmethod
    def validate_dates(cls, dates) -> None:
        try:
            [pd.Timestamp(d) for d in dates]
        except Exception as exc:                  # noqa: BLE001
            raise ValueError(f"could not parse requested dates: {exc}") from exc
