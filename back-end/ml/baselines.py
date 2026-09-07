"""Naive baselines every model is measured against.

A baseline may only use information available at prediction time: the API is
asked for a *future* date and given nothing else, so "last observed value" and
"7-day seasonal naive" are NOT usable here (there is no history at the requested
date and the sample spans ~2 weeks, with no full weekly cycle). Those are
recorded as "not applicable" rather than silently approximated.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


# --- passage volume -------------------------------------------------------
class GlobalMeanBaseline:
    name = "global_mean"

    def fit(self, train: pd.DataFrame):
        self.value_ = float(train["total_passages"].mean()) if len(train) else 0.0
        return self

    def predict(self, frame: pd.DataFrame):
        return np.full(len(frame), self.value_, dtype=float)


class PerStationMeanBaseline:
    name = "per_station_mean"

    def fit(self, train: pd.DataFrame):
        self.global_ = float(train["total_passages"].mean()) if len(train) else 0.0
        self.by_station_ = (train.groupby("tollID")["total_passages"].mean().to_dict()
                            if len(train) else {})
        return self

    def predict(self, frame: pd.DataFrame):
        return frame["tollID"].map(lambda s: self.by_station_.get(str(s), self.global_)).to_numpy(dtype=float)


VOLUME_BASELINES = [GlobalMeanBaseline, PerStationMeanBaseline]
VOLUME_BASELINE_NA = ["last_value", "seasonal_naive_7d"]  # not available at inference


# --- peak hour -----------------------------------------------------------
class GlobalPeakHourBaseline:
    """Predict the single most common actual peak hour in the training dates."""
    name = "global_peak_hour_mode"

    def fit(self, train_peaks: pd.DataFrame):
        if len(train_peaks):
            self.value_ = int(train_peaks["peak_hour"].mode().iloc[0])
        else:
            self.value_ = 12
        return self

    def predict(self, dates):
        return np.full(len(list(dates)), self.value_, dtype=int)


class DowPeakHourBaseline:
    """Most common training peak hour for the same day-of-week (falls back to global)."""
    name = "day_of_week_peak_hour_mode"

    def fit(self, train_peaks: pd.DataFrame):
        self.global_ = (int(train_peaks["peak_hour"].mode().iloc[0])
                        if len(train_peaks) else 12)
        self.by_dow_ = {}
        if len(train_peaks):
            tp = train_peaks.copy()
            tp["dow"] = pd.to_datetime(tp["date"]).dt.dayofweek
            for dow, g in tp.groupby("dow"):
                self.by_dow_[int(dow)] = int(g["peak_hour"].mode().iloc[0])
        return self

    def predict(self, dates):
        dows = pd.to_datetime(pd.Series(list(dates))).dt.dayofweek
        return dows.map(lambda d: self.by_dow_.get(int(d), self.global_)).to_numpy(dtype=int)


PEAK_BASELINES = [GlobalPeakHourBaseline, DowPeakHourBaseline]
