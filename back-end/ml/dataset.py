"""Load the passage data and build the two supervised tables.

Single source of truth: ``ml/data/passages.csv`` — a verbatim export of the
seeded ``Passages`` table joined to ``Toll`` (see ``ml/README.md`` for the exact
regeneration command). Everything downstream is derived from it deterministically.
"""
from __future__ import annotations

import os

import pandas as pd

from . import paths

TOLLS_CSV = os.path.join(paths.DATA_DIR, "tolls.csv")


def load_passages() -> pd.DataFrame:
    """Return one row per passage: timestamp, date, hour, tollID, company, charge."""
    df = pd.read_csv(paths.PASSAGES_CSV, dtype={"tollID": str, "company": str})
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
    df["date"] = df["timestamp"].dt.normalize()
    df["hour"] = df["timestamp"].dt.hour.astype(int)
    df = df.sort_values(["timestamp", "tollID"]).reset_index(drop=True)
    return df


def load_tolls() -> pd.DataFrame:
    """Return every toll station: tollID, company (+ name/lat/lon)."""
    return pd.read_csv(TOLLS_CSV, dtype={"tollID": str, "company": str})


def stations_for(operator: str, tolls: pd.DataFrame | None = None) -> list[str]:
    tolls = load_tolls() if tolls is None else tolls
    return sorted(tolls.loc[tolls["company"] == operator, "tollID"].unique().tolist())


def unique_dates(passages: pd.DataFrame | None = None) -> list[pd.Timestamp]:
    passages = load_passages() if passages is None else passages
    return sorted(passages["date"].unique().tolist())


# --------------------------------------------------------------------------
# Passage-volume table:  one row per (station, date) for an operator, with the
# passage count (0 where the station recorded nothing that day).
# --------------------------------------------------------------------------
def volume_table(operator: str,
                 passages: pd.DataFrame | None = None,
                 tolls: pd.DataFrame | None = None) -> pd.DataFrame:
    passages = load_passages() if passages is None else passages
    tolls = load_tolls() if tolls is None else tolls

    op_pass = passages[passages["company"] == operator]
    dates = sorted(passages["date"].unique().tolist())
    stations = stations_for(operator, tolls)
    if not dates or not stations:
        return pd.DataFrame(columns=["tollID", "date", "total_passages"])

    grid = pd.MultiIndex.from_product([stations, dates], names=["tollID", "date"]).to_frame(index=False)
    counts = (op_pass.groupby(["tollID", "date"]).size()
              .rename("total_passages").reset_index())
    out = grid.merge(counts, on=["tollID", "date"], how="left")
    out["total_passages"] = out["total_passages"].fillna(0).astype(int)
    return out.sort_values(["date", "tollID"]).reset_index(drop=True)


# --------------------------------------------------------------------------
# Peak-hour table:  one row per (date, hour 0..23) for an operator, with the
# passage count in that hour.  The label for a date is argmax(count over hours).
# --------------------------------------------------------------------------
def hourly_table(operator: str, passages: pd.DataFrame | None = None) -> pd.DataFrame:
    passages = load_passages() if passages is None else passages
    op_pass = passages[passages["company"] == operator]
    dates = sorted(passages["date"].unique().tolist())
    if not dates:
        return pd.DataFrame(columns=["date", "hour", "count"])

    grid = pd.MultiIndex.from_product([dates, range(24)], names=["date", "hour"]).to_frame(index=False)
    counts = (op_pass.groupby(["date", "hour"]).size().rename("count").reset_index())
    out = grid.merge(counts, on=["date", "hour"], how="left")
    out["count"] = out["count"].fillna(0).astype(int)
    return out.sort_values(["date", "hour"]).reset_index(drop=True)


def actual_peak_hours(operator: str, passages: pd.DataFrame | None = None) -> pd.DataFrame:
    """One row per date: the hour with the most passages (ties -> earliest hour)."""
    h = hourly_table(operator, passages)
    if h.empty:
        return pd.DataFrame(columns=["date", "peak_hour", "day_total"])
    rows = []
    for date, g in h.groupby("date"):
        g = g.sort_values(["count", "hour"], ascending=[False, True])
        top = g.iloc[0]
        rows.append({"date": date, "peak_hour": int(top["hour"]), "day_total": int(g["count"].sum())})
    return pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
