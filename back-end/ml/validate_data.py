"""python -m ml.validate_data

Audit ``ml/data/passages.csv`` and the two derived training tables, print a
human-readable report, and write ``ml/evaluation/data_audit.json``. Exits non-zero
only on a structural problem (missing file, unparseable timestamps, empty table),
never merely because the sample is small.

If a database is reachable it also checks that ``passages.csv`` still matches the
seeded ``Passages`` table and warns (does not fail) on drift.
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

from . import paths
from . import dataset as D
from .splits import chronological_split


def _describe_series(s: pd.Series) -> dict:
    s = pd.to_numeric(s, errors="coerce")
    return {
        "count": int(s.notna().sum()),
        "min": float(s.min()) if len(s) else None,
        "max": float(s.max()) if len(s) else None,
        "mean": float(s.mean()) if len(s) else None,
        "median": float(s.median()) if len(s) else None,
        "zeros": int((s == 0).sum()),
        "zero_frac": float((s == 0).mean()) if len(s) else None,
    }


def _db_cross_check(passages: pd.DataFrame) -> dict:
    try:
        import mysql.connector  # noqa: WPS433
    except Exception as exc:                      # noqa: BLE001
        return {"checked": False, "reason": f"mysql connector unavailable: {exc}"}
    cfg = dict(
        host=os.environ.get("HOST", "db"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user="root",
        password=os.environ.get("MYSQL_ROOT_PASSWORD", "root_local_only"),
        database=os.environ.get("DATABASE", "toll_analysis"),
        connection_timeout=4,
    )
    try:
        conn = mysql.connector.connect(**cfg)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM Passages")
        db_rows = cur.fetchone()[0]
        cur.execute("SELECT MIN(timestamp), MAX(timestamp) FROM Passages")
        db_min, db_max = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as exc:                      # noqa: BLE001
        return {"checked": False, "reason": f"no DB connection: {exc}"}

    csv_rows = len(passages)
    match = (db_rows == csv_rows
             and str(db_min) == str(passages["timestamp"].min())
             and str(db_max) == str(passages["timestamp"].max()))
    return {
        "checked": True,
        "matches_seed_db": bool(match),
        "db_rows": int(db_rows), "csv_rows": int(csv_rows),
        "db_range": [str(db_min), str(db_max)],
        "csv_range": [str(passages["timestamp"].min()), str(passages["timestamp"].max())],
    }


def audit() -> dict:
    if not os.path.exists(paths.PASSAGES_CSV):
        raise SystemExit(f"missing {paths.PASSAGES_CSV} - see ml/README.md to regenerate it")

    passages = D.load_passages()
    tolls = D.load_tolls()
    dates = D.unique_dates(passages)

    report: dict = {
        "source": {
            "passages_csv": os.path.relpath(paths.PASSAGES_CSV, paths.BACKEND_DIR),
            "tolls_csv": os.path.relpath(D.TOLLS_CSV, paths.BACKEND_DIR),
            "how_generated": "verbatim export of the seeded Passages table joined "
                             "to Toll (db/init/02-data.sql) - see ml/README.md",
        },
        "passages": {
            "rows": int(len(passages)),
            "duplicate_rows": int(passages.duplicated().sum()),
            "missing_values": {c: int(passages[c].isna().sum()) for c in passages.columns},
            "unique_dates": len(dates),
            "date_min": str(min(dates).date()) if dates else None,
            "date_max": str(max(dates).date()) if dates else None,
            "sample_frequency": "irregular event log (one row per passage, minute timestamps)",
            "distinct_stations_with_passages": int(passages["tollID"].nunique()),
            "distinct_stations_total": int(tolls["tollID"].nunique()),
            "companies": sorted(passages["company"].unique().tolist()),
        },
        "db_cross_check": _db_cross_check(passages),
        "volume_task": {"per_operator": {}, "notes": []},
        "peak_task": {"per_operator": {}, "notes": []},
    }

    # multiple rows from the same date across stations?
    per_date_station = passages.groupby("date")["tollID"].nunique()
    report["passages"]["dates_with_multiple_stations"] = int((per_date_station > 1).sum())

    try:
        split = chronological_split(dates)
        report["proposed_split"] = split.summary()
    except Exception as exc:                      # noqa: BLE001
        report["proposed_split"] = {"error": str(exc)}

    for op in paths.OPERATORS:
        vt = D.volume_table(op, passages, tolls)
        peaks = D.actual_peak_hours(op, passages)
        hourly = D.hourly_table(op, passages)
        n_pass = int((passages["company"] == op).sum())

        report["volume_task"]["per_operator"][op] = {
            "grid_rows": int(len(vt)),
            "stations": int(vt["tollID"].nunique()) if len(vt) else 0,
            "unique_dates": int(vt["date"].nunique()) if len(vt) else 0,
            "target_total_passages": _describe_series(vt["total_passages"]) if len(vt) else {},
            "raw_passages": n_pass,
            "duplicate_rows": int(vt.duplicated().sum()) if len(vt) else 0,
        }
        report["peak_task"]["per_operator"][op] = {
            "labelled_dates": int(len(peaks)),
            "dates_with_ties_removed_earliest_kept": int(
                (hourly.groupby("date")["count"].transform("max") == hourly["count"])
                .groupby(hourly["date"]).sum().gt(1).sum()) if len(hourly) else 0,
            "peak_hour_distribution": (peaks["peak_hour"].value_counts().sort_index().to_dict()
                                       if len(peaks) else {}),
            "mean_day_total": float(peaks["day_total"].mean()) if len(peaks) else 0.0,
            "raw_passages": n_pass,
        }

    tiny = [op for op, v in report["volume_task"]["per_operator"].items()
            if v["raw_passages"] < 30]
    if tiny:
        msg = (f"operators with < 30 passages in the whole sample: {tiny} - "
               f"per-station volume and peak-hour models for these are demonstrations only")
        report["volume_task"]["notes"].append(msg)
        report["peak_task"]["notes"].append(msg)

    report["reproducibility"] = {
        "current_committed_models": "models_passages/*.pkl and models_peak_hours/*.pkl",
        "reproducible_from_this_source": False,
        "reason": "the legacy training tables (ml/training_data/*.csv, "
                  "ml/training_data_peak_hours/*.csv) do not match this export or "
                  "db/init/02-data.sql (different dates and counts); their exact "
                  "origin is undocumented. The v2 pipeline is built from "
                  "ml/data/passages.csv only.",
    }
    return report


def main() -> int:
    report = audit()
    os.makedirs(paths.EVALUATION_DIR, exist_ok=True)
    out = os.path.join(paths.EVALUATION_DIR, "data_audit.json")
    with open(out, "w") as fh:
        json.dump(report, fh, indent=2, default=str)

    p = report["passages"]
    print("=== passages.csv ===")
    print(f"  rows={p['rows']}  unique_dates={p['unique_dates']}  "
          f"range={p['date_min']}..{p['date_max']}")
    print(f"  stations with passages: {p['distinct_stations_with_passages']} / "
          f"{p['distinct_stations_total']}   duplicate rows: {p['duplicate_rows']}")
    print(f"  companies: {', '.join(p['companies'])}")
    dbc = report["db_cross_check"]
    if dbc.get("checked"):
        print(f"  DB cross-check: matches_seed_db={dbc['matches_seed_db']} "
              f"(db={dbc['db_rows']} csv={dbc['csv_rows']})")
    else:
        print(f"  DB cross-check: skipped ({dbc.get('reason')})")

    print("\n=== proposed chronological split ===")
    print(f"  {report.get('proposed_split')}")

    print("\n=== volume task (passage count per station-day) ===")
    for op, v in report["volume_task"]["per_operator"].items():
        t = v["target_total_passages"]
        print(f"  {op:4s} grid={v['grid_rows']:5d}  stations={v['stations']:3d}  "
              f"dates={v['unique_dates']:2d}  raw_passages={v['raw_passages']:4d}  "
              f"zero_frac={t.get('zero_frac'):.2f}  mean={t.get('mean'):.3f}  max={t.get('max')}")
    for n in report["volume_task"]["notes"]:
        print(f"  ! {n}")

    print("\n=== peak-hour task ===")
    for op, v in report["peak_task"]["per_operator"].items():
        print(f"  {op:4s} labelled_dates={v['labelled_dates']:2d}  "
              f"tie_dates={v['dates_with_ties_removed_earliest_kept']:2d}  "
              f"mean_day_total={v['mean_day_total']:.1f}  hours={v['peak_hour_distribution']}")

    print(f"\n=== reproducibility ===\n  {report['reproducibility']['reason']}")
    print(f"\nwrote {os.path.relpath(out, paths.BACKEND_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
