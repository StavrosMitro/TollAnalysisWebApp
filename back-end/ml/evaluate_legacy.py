"""python -m ml.evaluate_legacy

Record the EXISTING approach's behaviour before it is replaced, so the
*methodology* problems it had (random split, encoder mismatch, direct hour
regression) are documented with numbers. Does not touch models_passages/*.pkl or
models_peak_hours/*.pkl. Writes ml/evaluation/legacy/metrics.json (+ CSVs).

These figures are NOT directly comparable with the v2 held-out numbers: the
target populations differ (legacy volume = non-zero station-days only; v2 =
the full station x date grid the API predicts), and the evaluation differs.
They document methodology, not a horse race.

Two things are measured:

1. Legacy methodology, re-run on the current seeded data
   - passage volume: RandomForest on [tollID(LabelEncoded), Year, Month, Day,
     DayOfYear] over the observed (non-zero) station-days only, exactly as the
     old train.py / data_for_nop did; evaluated under BOTH a random 80/20 split
     (random_state=42, as shipped) and a chronological date split.
   - peak hour: RandomForest regressing hour_of_day directly on
     [day_of_week, month, year] over the per-date argmax-hour rows (ties kept),
     as old train_peak_hours.py / get_most_passages_for_date_and_company did;
     random and chronological splits.

2. The shipped .pkl artifacts, scored on the current data (chronological test
   dates) using the old predict.py feature construction - including its
   fit-a-fresh-LabelEncoder-at-predict-time behaviour - to show what the
   deployed models actually produce.
"""
from __future__ import annotations

import json
import os
import pickle
import sys

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from . import RANDOM_SEED, paths
from . import dataset as D
from . import metrics as M
from .artifacts import library_versions
from .splits import chronological_split

LEGACY_DATE_FEATURES = ["Year", "Month", "Day", "DayOfYear"]


def _legacy_calendar(dates: pd.Series) -> pd.DataFrame:
    d = pd.to_datetime(dates)
    return pd.DataFrame({
        "Year": d.dt.year, "Month": d.dt.month,
        "Day": d.dt.day, "DayOfYear": d.dt.dayofyear,
    })


# ---------------------------------------------------------------- volume
def legacy_volume_table(op: str, passages: pd.DataFrame) -> pd.DataFrame:
    """data_for_nop: GROUP BY (tollID, date) COUNT - observed station-days only."""
    g = (passages[passages["company"] == op]
         .groupby(["tollID", "date"]).size().rename("total_passages").reset_index())
    return g.sort_values(["date", "tollID"]).reset_index(drop=True)


def _fit_eval_volume(train_df, test_df):
    le = LabelEncoder()
    # old train.py: fit encoder on the training tollIDs
    le.fit(train_df["tollID"])

    def to_X(df, encoder):
        cal = _legacy_calendar(df["date"]).reset_index(drop=True)
        # unseen stations at predict time would raise; the old code fit a NEW
        # encoder on the input, so mirror that: unknown -> fresh code space.
        codes = []
        for s in df["tollID"]:
            codes.append(int(np.where(encoder.classes_ == s)[0][0]) if s in encoder.classes_ else -1)
        cal.insert(0, "tollID", codes)
        return cal[["tollID"] + LEGACY_DATE_FEATURES]

    X_tr, y_tr = to_X(train_df, le), train_df["total_passages"].to_numpy(float)
    X_te, y_te = to_X(test_df, le), test_df["total_passages"].to_numpy(float)
    model = RandomForestRegressor(n_estimators=100, random_state=RANDOM_SEED, n_jobs=1)
    model.fit(X_tr, y_tr)
    pred = np.clip(model.predict(X_te), 0, None)
    return M.regression_scores(y_te, pred)


def _shipped_volume_scores(op: str, passages: pd.DataFrame, test_dates) -> dict:
    pkl = os.path.join(paths.LEGACY_VOLUME_DIR, f"model_{op}.pkl")
    if not os.path.exists(pkl):
        return {"error": "no shipped artifact"}
    with open(pkl, "rb") as fh:
        model = pickle.load(fh)
    tbl = legacy_volume_table(op, passages)
    test = tbl[tbl["date"].isin(set(pd.Timestamp(d) for d in test_dates))]
    if test.empty:
        return {"error": "no test rows"}
    # old predict.py: fit a fresh LabelEncoder on the input's unique tollIDs
    le = LabelEncoder().fit(test["tollID"].unique())
    cal = _legacy_calendar(test["date"]).reset_index(drop=True)
    cal.insert(0, "tollID", le.transform(test["tollID"]))
    try:
        pred = np.clip(model.predict(cal[["tollID"] + LEGACY_DATE_FEATURES]), 0, None)
    except Exception as exc:                      # noqa: BLE001
        return {"error": f"prediction failed: {exc}"}
    return M.regression_scores(test["total_passages"].to_numpy(float), pred)


# ---------------------------------------------------------------- peak hour
def legacy_peak_table(op: str, passages: pd.DataFrame) -> pd.DataFrame:
    """get_most_passages_for_date_and_company: per-date argmax hour, ties kept."""
    op_pass = passages[passages["company"] == op]
    if op_pass.empty:
        return pd.DataFrame(columns=["passage_date", "hour_of_day"])
    counts = op_pass.groupby(["date", "hour"]).size().rename("c").reset_index()
    rows = []
    for date, g in counts.groupby("date"):
        mx = g["c"].max()
        for h in sorted(g.loc[g["c"] == mx, "hour"]):
            rows.append({"passage_date": date, "hour_of_day": int(h)})
    return pd.DataFrame(rows)


def _fit_eval_peak(train_df, test_df):
    def to_X(df):
        d = pd.to_datetime(df["passage_date"])
        return pd.DataFrame({"day_of_week": d.dt.dayofweek, "month": d.dt.month, "year": d.dt.year})
    model = RandomForestRegressor(n_estimators=100, random_state=RANDOM_SEED, n_jobs=1)
    model.fit(to_X(train_df), train_df["hour_of_day"].to_numpy(float))
    raw = model.predict(to_X(test_df))
    yt = test_df["hour_of_day"].to_numpy(float)
    sc = M.regression_scores(yt, raw)                       # MAE/RMSE on the raw hour
    sc.update(M.peak_hour_scores(yt, np.rint(raw)))          # + circular, on rounded
    sc["note"] = "raw fractional hour output; circular metrics use round()"
    return sc


def evaluate() -> dict:
    passages = D.load_passages()
    dates = D.unique_dates(passages)
    split = chronological_split(dates)
    test_dates = split.test

    report = {
        "purpose": "record the existing ML approach's behaviour and its "
                   "methodology problems before replacement",
        "not_comparable_with_v2": "different target population (legacy = non-zero "
                                  "station-days only) and evaluation; this is not "
                                  "a comparison of accuracy",
        "random_seed": RANDOM_SEED,
        "library_versions": library_versions(),
        "data_source": "ml/data/passages.csv (seeded Passages, 2021-12-31..2022-01-14)",
        "legacy_feature_sets": {
            "volume": ["tollID(LabelEncoded)"] + LEGACY_DATE_FEATURES,
            "peak_hour": ["day_of_week", "month", "year"],
        },
        "chronological_test_dates": [str(pd.Timestamp(d).date()) for d in test_dates],
        "volume": {"random_split": {}, "chronological_split": {}, "shipped_artifacts_on_test": {}},
        "peak_hour": {"random_split": {}, "chronological_split": {}},
    }

    for op in paths.OPERATORS:
        vt = legacy_volume_table(op, passages)
        if len(vt) >= 10:
            tr, te = train_test_split(vt, test_size=0.2, random_state=RANDOM_SEED)
            report["volume"]["random_split"][op] = _fit_eval_volume(tr, te)
            tr_c = vt[vt["date"].isin(set(split.train + split.val))]
            te_c = vt[vt["date"].isin(set(split.test))]
            if len(tr_c) and len(te_c):
                report["volume"]["chronological_split"][op] = _fit_eval_volume(tr_c, te_c)
        report["volume"]["shipped_artifacts_on_test"][op] = _shipped_volume_scores(op, passages, test_dates)

        pt = legacy_peak_table(op, passages)
        if len(pt) >= 8:
            tr, te = train_test_split(pt, test_size=0.2, random_state=RANDOM_SEED)
            report["peak_hour"]["random_split"][op] = _fit_eval_peak(tr, te)
            tr_c = pt[pt["passage_date"].isin(set(split.train + split.val))]
            te_c = pt[pt["passage_date"].isin(set(split.test))]
            if len(tr_c) >= 3 and len(te_c):
                report["peak_hour"]["chronological_split"][op] = _fit_eval_peak(tr_c, te_c)

    for task in ("volume", "peak_hour"):
        for kind in ("random_split", "chronological_split"):
            report[task][kind + "_aggregate"] = M.aggregate(report[task][kind])
    return report


def main() -> int:
    report = evaluate()
    out_dir = os.path.join(paths.EVALUATION_DIR, "legacy")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "metrics.json"), "w") as fh:
        json.dump(report, fh, indent=2, default=str)

    def show(task):
        print(f"\n=== legacy {task} ===")
        for kind in ("random_split", "chronological_split"):
            agg = report[task][f"{kind}_aggregate"]
            print(f"  {kind}: macro={agg.get('macro')} weighted={agg.get('weighted')}")
            for op, s in report[task][kind].items():
                print(f"     {op:4s} {s}")
    show("volume")
    print("\n  shipped volume .pkl on chronological test dates:")
    for op, s in report["volume"]["shipped_artifacts_on_test"].items():
        print(f"     {op:4s} {s}")
    show("peak_hour")
    print(f"\nwrote {os.path.relpath(os.path.join(out_dir, 'metrics.json'), paths.BACKEND_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
