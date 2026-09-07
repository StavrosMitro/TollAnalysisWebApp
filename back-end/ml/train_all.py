"""python -m ml.train_all

Deterministically train the v2 passage-volume and peak-hour models for every
operator and write versioned bundles to ml/artifacts/v2/. Hyper-parameters are
fixed (not searched). The final TEST dates are not used for model selection or
tuning: the deployed model is fit on TRAIN+VAL, and VAL metrics (from a
TRAIN-only fit) plus baseline VAL metrics are recorded in the bundle metadata as
sanity checks. Held-out TEST metrics are produced separately, unchanged, by
`python -m ml.evaluate_all` for reproducibility.

Each bundle records its provenance: the SHA-256 of the source modules and of the
dataset files that produced it, plus git state and library versions.

Run twice and diff to confirm determinism (model predictions are identical; only
the `created_at` provenance field changes).
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

from . import ARTIFACT_VERSION, RANDOM_SEED, paths
from . import dataset as D
from . import metrics as M
from . import baselines as B
from .artifacts import build_meta, save_bundle, write_index, provenance
from .model_volume import VolumeModel
from .model_peak import PeakModel
from .splits import chronological_split, rolling_origin


def _val_scores_volume(vt, split):
    tr = vt[vt["date"].isin(set(split.train))]
    va = vt[vt["date"].isin(set(split.val))]
    if tr.empty or va.empty:
        return {}, {}
    model = VolumeModel().fit(tr)
    m = M.regression_scores(va["total_passages"], model.predict(va[["tollID", "date"]]))
    bl = {}
    for cls in B.VOLUME_BASELINES:
        b = cls().fit(tr)
        bl[cls.name] = M.regression_scores(va["total_passages"], b.predict(va))
    return m, bl


def _val_scores_peak(op, passages, split):
    hourly = D.hourly_table(op, passages)
    peaks = D.actual_peak_hours(op, passages)
    tr_h = hourly[hourly["date"].isin(set(split.train))]
    va_p = peaks[peaks["date"].isin(set(split.val))]
    if tr_h.empty or va_p.empty:
        return {}, {}
    model = PeakModel().fit(tr_h)
    pred = model.predict_peak_hour(va_p["date"].tolist())
    m = M.peak_hour_scores(va_p["peak_hour"].to_numpy(), pred["predicted_hour"].to_numpy())
    tr_p = peaks[peaks["date"].isin(set(split.train))]
    bl = {}
    for cls in B.PEAK_BASELINES:
        b = cls().fit(tr_p)
        bl[cls.name] = M.peak_hour_scores(va_p["peak_hour"].to_numpy(), b.predict(va_p["date"].tolist()))
    return m, bl


def _rolling_sanity_volume(vt, split):
    """Expanding-window MAE over the train+val period (no test)."""
    dev_dates = sorted(set(split.train) | set(split.val))
    maes = []
    for tr_d, ev_d in rolling_origin(dev_dates, min_train=max(3, len(dev_dates) // 2)):
        tr = vt[vt["date"].isin(set(tr_d))]
        ev = vt[vt["date"].isin(set(ev_d))]
        if tr.empty or ev.empty:
            continue
        maes.append(M.mae(ev["total_passages"], VolumeModel(n_estimators=100).fit(tr).predict(ev[["tollID", "date"]])))
    return {"folds": len(maes), "mean_mae": float(np.mean(maes)) if maes else None}


def train() -> dict:
    passages = D.load_passages()
    tolls = D.load_tolls()
    dates = D.unique_dates(passages)
    split = chronological_split(dates)
    dev_dates = set(split.train) | set(split.val)      # TRAIN + VAL for the deployed fit

    index_entries = []
    summary = {"version": ARTIFACT_VERSION, "seed": RANDOM_SEED,
               "split": split.summary(), "operators": {}}

    for op in paths.OPERATORS:
        vt = D.volume_table(op, passages, tolls)
        hourly = D.hourly_table(op, passages)
        peaks = D.actual_peak_hours(op, passages)
        n_pass = int((passages["company"] == op).sum())
        demo_only = n_pass < 30
        op_summary = {"raw_passages": n_pass, "demonstration_only": demo_only}

        # --- volume -------------------------------------------------------
        v_dev = vt[vt["date"].isin(dev_dates)]
        v_model = VolumeModel().fit(v_dev)
        v_val, v_val_bl = _val_scores_volume(vt, split)
        v_meta = build_meta(
            model_type="RandomForestRegressor(n_estimators=120, max_depth=6, min_samples_leaf=3) + station vocabulary",
            task="passage_volume", operator=op, target="passages per station-day",
            feature_names=v_model.feature_names_,
            training_data_source="ml/data/passages.csv (seeded Passages 2021-12-31..2022-01-14)",
            train_date_range=split.summary()["train"],
            val_date_range=split.summary()["val"],
            test_date_range=split.summary()["test"],
            row_counts={"train_val_grid": int(len(v_dev)),
                        "stations": int(v_dev["tollID"].nunique()) if len(v_dev) else 0,
                        "raw_passages": n_pass,
                        "target_zero_frac": float((v_dev["total_passages"] == 0).mean()) if len(v_dev) else None},
            random_seed=RANDOM_SEED,
            metrics={"validation_sanity_check": v_val,
                     "rolling_origin_sanity_check": _rolling_sanity_volume(vt, split),
                     "held_out_test": "see ml/evaluation/v2/metrics.json (ml.evaluate_all)"},
            baseline_metrics={"validation_sanity_check": v_val_bl,
                              "not_applicable": B.VOLUME_BASELINE_NA},
            notes=("Integration demo. Per-station daily counts in this ~2-week "
                   "sample are near-binary and sparse; the model exists to "
                   "exercise the training/serving contract, not to forecast."),
        )
        v_path = paths.artifact_path(ARTIFACT_VERSION, "volume", op)
        save_bundle(v_path, v_model, v_meta)
        index_entries.append({"task": "volume", "operator": op,
                              "file": os.path.relpath(v_path, paths.ML_DIR),
                              "val_mae": v_val.get("mae"), "demonstration_only": demo_only})
        op_summary["volume"] = {"val": v_val, "val_baselines": v_val_bl}

        # --- peak hour --------------------------------------------------
        h_dev = hourly[hourly["date"].isin(dev_dates)]
        p_model = PeakModel().fit(h_dev)
        p_val, p_val_bl = _val_scores_peak(op, passages, split)
        p_meta = build_meta(
            model_type="RandomForestRegressor(n_estimators=120, max_depth=6, min_samples_leaf=3) on 24 hourly volumes -> argmax",
            task="peak_hour", operator=op, target="hour of day with most passages (int 0-23)",
            feature_names=p_model.feature_names_,
            training_data_source="ml/data/passages.csv (hourly counts per date)",
            train_date_range=split.summary()["train"],
            val_date_range=split.summary()["val"],
            test_date_range=split.summary()["test"],
            row_counts={"train_val_hour_rows": int(len(h_dev)),
                        "labelled_dates_total": int(len(peaks)),
                        "mean_day_total": float(peaks["day_total"].mean()) if len(peaks) else 0.0,
                        "raw_passages": n_pass},
            random_seed=RANDOM_SEED,
            metrics={"validation_sanity_check": p_val,
                     "held_out_test": "see ml/evaluation/v2/metrics.json (ml.evaluate_all)"},
            baseline_metrics={"validation_sanity_check": p_val_bl},
            notes=("Integration demo. Very sparse: most days have < 1 "
                   "passage/hour and several hours tie for the peak; the model "
                   "exists to exercise the training/serving contract."),
        )
        p_path = paths.artifact_path(ARTIFACT_VERSION, "peak", op)
        save_bundle(p_path, p_model, p_meta)
        index_entries.append({"task": "peak", "operator": op,
                              "file": os.path.relpath(p_path, paths.ML_DIR),
                              "val_within_1_acc": p_val.get("within_1_acc"),
                              "demonstration_only": True})
        op_summary["peak"] = {"val": p_val, "val_baselines": p_val_bl}
        summary["operators"][op] = op_summary

    write_index(os.path.join(paths.ARTIFACTS_DIR, ARTIFACT_VERSION), index_entries)
    return summary


def main() -> int:
    summary = train()
    os.makedirs(paths.evaluation_dir(ARTIFACT_VERSION), exist_ok=True)
    with open(os.path.join(paths.evaluation_dir(ARTIFACT_VERSION), "train_summary.json"), "w") as fh:
        json.dump({"provenance": provenance(), **summary}, fh, indent=2, default=str)
    print(f"=== trained {ARTIFACT_VERSION} ===  split={summary['split']}")
    for op, s in summary["operators"].items():
        v = s["volume"]["val"]; p = s["peak"]["val"]
        print(f"  {op:4s} vol val MAE={v.get('mae')}  peak val within1={p.get('within_1_acc')}"
              f"{'   [demo-only]' if s['demonstration_only'] else ''}")
    print(f"\nartifacts -> ml/artifacts/{ARTIFACT_VERSION}/  (index.json)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
