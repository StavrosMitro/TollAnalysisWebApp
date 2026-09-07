"""Deterministic calendar features.

The SAME function is used to build the training matrix and the inference matrix,
so training and serving can never diverge. No feature depends on the target or
on any information unavailable when a future date is requested.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Column order is part of the artifact contract - do not reorder.
DATE_FEATURES = [
    "day_of_week",     # 0=Mon .. 6=Sun
    "month",           # 1..12
    "day_of_year",     # 1..366
    "is_weekend",      # 0/1
    "dow_sin", "dow_cos",
    "doy_sin", "doy_cos",
]

VOLUME_FEATURES = ["station_code"] + DATE_FEATURES
PEAK_FEATURES = ["hour", "hour_sin", "hour_cos"] + DATE_FEATURES


def date_features(dates: pd.Series) -> pd.DataFrame:
    d = pd.to_datetime(pd.Series(dates).reset_index(drop=True))
    dow = d.dt.dayofweek.astype(int)
    month = d.dt.month.astype(int)
    doy = d.dt.dayofyear.astype(int)
    out = pd.DataFrame({
        "day_of_week": dow,
        "month": month,
        "day_of_year": doy,
        "is_weekend": (dow >= 5).astype(int),
        "dow_sin": np.sin(2 * np.pi * dow / 7.0),
        "dow_cos": np.cos(2 * np.pi * dow / 7.0),
        "doy_sin": np.sin(2 * np.pi * doy / 365.0),
        "doy_cos": np.cos(2 * np.pi * doy / 365.0),
    })
    return out[DATE_FEATURES]


def hour_features(hours: pd.Series) -> pd.DataFrame:
    h = pd.Series(hours).reset_index(drop=True).astype(int)
    return pd.DataFrame({
        "hour": h,
        "hour_sin": np.sin(2 * np.pi * h / 24.0),
        "hour_cos": np.cos(2 * np.pi * h / 24.0),
    })


def volume_matrix(frame: pd.DataFrame, station_index: dict[str, int]) -> pd.DataFrame:
    """frame needs columns: tollID, date. Unknown stations -> code -1."""
    codes = frame["tollID"].map(lambda s: station_index.get(str(s), -1)).astype(int)
    feats = date_features(frame["date"])
    feats.insert(0, "station_code", codes.reset_index(drop=True))
    return feats[VOLUME_FEATURES]


def peak_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    """frame needs columns: date, hour."""
    feats = date_features(frame["date"])
    hf = hour_features(frame["hour"])
    out = pd.concat([hf.reset_index(drop=True), feats.reset_index(drop=True)], axis=1)
    return out[PEAK_FEATURES]
