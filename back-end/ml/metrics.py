"""Zero-safe regression metrics and circular-hour metrics.

R-squared is deliberately omitted from the headline numbers: with tiny, mostly
low-count targets it is unstable and easy to misread.
"""
from __future__ import annotations

import numpy as np


def _arr(x):
    return np.asarray(x, dtype=float).ravel()


def mae(y_true, y_pred) -> float:
    yt, yp = _arr(y_true), _arr(y_pred)
    return float(np.mean(np.abs(yt - yp))) if yt.size else float("nan")


def rmse(y_true, y_pred) -> float:
    yt, yp = _arr(y_true), _arr(y_pred)
    return float(np.sqrt(np.mean((yt - yp) ** 2))) if yt.size else float("nan")


def smape(y_true, y_pred) -> float:
    """Symmetric MAPE in [0, 200]. Pairs where both are 0 contribute 0."""
    yt, yp = _arr(y_true), _arr(y_pred)
    if not yt.size:
        return float("nan")
    denom = np.abs(yt) + np.abs(yp)
    mask = denom > 0
    if not mask.any():
        return 0.0
    return float(np.mean(200.0 * np.abs(yp[mask] - yt[mask]) / denom[mask]))


def regression_scores(y_true, y_pred) -> dict:
    yt = _arr(y_true)
    return {
        "mae": mae(yt, y_pred),
        "rmse": rmse(yt, y_pred),
        "smape": smape(yt, y_pred),
        "n": int(yt.size),
    }


def aggregate(per_company: dict[str, dict]) -> dict:
    """macro = unweighted mean of company scores; weighted = by sample count."""
    rows = [(c, s) for c, s in per_company.items() if s and s.get("n", 0) > 0]
    if not rows:
        return {"macro": {}, "weighted": {}}
    keys = ["mae", "rmse", "smape"]
    macro = {k: float(np.mean([s[k] for _, s in rows if not np.isnan(s.get(k, np.nan))])) for k in keys}
    total = sum(s["n"] for _, s in rows)
    weighted = {k: float(sum(s[k] * s["n"] for _, s in rows
                             if not np.isnan(s.get(k, np.nan))) / total) for k in keys}
    macro["n_companies"] = len(rows)
    weighted["n"] = total
    return {"macro": macro, "weighted": weighted}


# --- circular hour metrics --------------------------------------------------
def circular_hour_distance(a, b, period: int = 24):
    d = np.abs(_arr(a) - _arr(b))
    return np.minimum(d, period - d)


def peak_hour_scores(y_true_hour, y_pred_hour) -> dict:
    yt, yp = _arr(y_true_hour), _arr(y_pred_hour)
    if not yt.size:
        return {"exact_acc": float("nan"), "within_1_acc": float("nan"),
                "mean_circular_abs_error": float("nan"), "n": 0}
    dist = circular_hour_distance(yt, yp)
    return {
        "exact_acc": float(np.mean(dist == 0)),
        "within_1_acc": float(np.mean(dist <= 1)),
        "mean_circular_abs_error": float(np.mean(dist)),
        "n": int(yt.size),
    }
