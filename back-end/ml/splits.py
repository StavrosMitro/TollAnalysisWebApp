"""Chronological, date-based splitting.

The unit of splitting is the *unique calendar date*, never the row: the same
date must not appear in two splits through different stations or hours. The
final test dates are not touched until model and feature decisions are frozen.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class DateSplit:
    train: list[pd.Timestamp]
    val: list[pd.Timestamp]
    test: list[pd.Timestamp]

    def as_dict(self):
        fmt = lambda xs: [pd.Timestamp(x).strftime("%Y-%m-%d") for x in xs]
        return {"train": fmt(self.train), "val": fmt(self.val), "test": fmt(self.test)}

    def summary(self):
        def rng(xs):
            if not xs:
                return {"n": 0, "min": None, "max": None}
            return {"n": len(xs),
                    "min": pd.Timestamp(min(xs)).strftime("%Y-%m-%d"),
                    "max": pd.Timestamp(max(xs)).strftime("%Y-%m-%d")}
        return {"train": rng(self.train), "val": rng(self.val), "test": rng(self.test)}


def chronological_split(dates, train_frac=0.70, val_frac=0.15) -> DateSplit:
    """Split sorted unique dates into train / val / test by position.

    With very few dates each split still gets at least one date where possible
    (test is filled first from the tail, then val, then the rest is train).
    """
    uniq = sorted(pd.Timestamp(d) for d in pd.unique(pd.Series(list(dates))))
    n = len(uniq)
    if n < 3:
        raise ValueError(f"need at least 3 unique dates to split, got {n}")

    n_test = max(1, round(n * (1 - train_frac - val_frac)))
    n_val = max(1, round(n * val_frac))
    if n_test + n_val >= n:                      # keep >=1 for train
        n_test = 1
        n_val = 1
    n_train = n - n_val - n_test

    train = uniq[:n_train]
    val = uniq[n_train:n_train + n_val]
    test = uniq[n_train + n_val:]
    split = DateSplit(train=train, val=val, test=test)
    assert_no_leakage(split)
    return split


def assert_no_leakage(split: DateSplit) -> None:
    tr, va, te = set(split.train), set(split.val), set(split.test)
    assert tr and va and te, "every split must be non-empty"
    assert not (tr & va) and not (va & te) and not (tr & te), "date overlap between splits"
    assert max(split.train) < min(split.val), "max(train) must be < min(val)"
    assert max(split.val) < min(split.test), "max(val) must be < min(test)"


def rolling_origin(dates, min_train=5, horizon=1):
    """Expanding-window folds over the (train+val) period for hyper-parameter
    sanity checks. Yields (train_dates, eval_dates) tuples."""
    uniq = sorted(pd.Timestamp(d) for d in pd.unique(pd.Series(list(dates))))
    for i in range(min_train, len(uniq) - horizon + 1):
        yield uniq[:i], uniq[i:i + horizon]


def rows_for_dates(frame: pd.DataFrame, dates, date_col="date") -> pd.DataFrame:
    keep = {pd.Timestamp(d) for d in dates}
    return frame[frame[date_col].map(lambda d: pd.Timestamp(d) in keep)].reset_index(drop=True)
