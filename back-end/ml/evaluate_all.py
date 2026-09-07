"""python -m ml.evaluate_all

Load the committed v2 bundles (no retraining) and evaluate them on the held-out
TEST dates. The naive baselines are reported next to the model results purely as
**sanity checks** - "is the model doing anything a mean wouldn't" - not as a
target to beat. The test dates were not used for model selection or tuning; this
step is rerun unchanged only for reproducibility.

Writes:
    ml/evaluation/v2/metrics.json                 machine-readable, everything
    ml/evaluation/v2/per_company_volume.csv       one row per operator
    ml/evaluation/v2/per_company_peak.csv
    ml/evaluation/v2/predictions_volume_test.csv   actual vs predicted, per row
    ml/evaluation/v2/predictions_peak_test.csv
    ml/evaluation/v2/plots/*.png                   (skipped if matplotlib absent)
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
from .artifacts import load_bundle, provenance
from .splits import chronological_split


def evaluate_volume(passages, tolls, split):
    dev = set(split.train) | set(split.val)
    rows_pred, per_company, scores = [], {}, {}
    for op in paths.OPERATORS:
        vt = D.volume_table(op, passages, tolls)
        dev_df = vt[vt["date"].isin(dev)]
        test_df = vt[vt["date"].isin(set(split.test))]
        if test_df.empty:
            per_company[op] = {"error": "no test rows"}
            continue

        bundle = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "volume", op))
        model = bundle["pipeline"]
        y = test_df["total_passages"].to_numpy(float)
        yhat = model.predict(test_df[["tollID", "date"]])

        ref = {cls.name: M.regression_scores(y, cls().fit(dev_df).predict(test_df))
               for cls in B.VOLUME_BASELINES}
        nz = y > 0
        per_company[op] = {
            "model": M.regression_scores(y, yhat),
            "sanity_check_baselines": ref,
            # like-for-like with the legacy figures, which only ever saw non-zero
            # station-days; the zero-inflated full-grid numbers are what the API
            # actually predicts.
            "model_on_nonzero_actuals": M.regression_scores(y[nz], yhat[nz]) if nz.any() else {},
            "test_zero_frac": float((~nz).mean()),
        }
        scores[op] = per_company[op]["model"]

        for (_, r), p in zip(test_df.iterrows(), yhat):
            rows_pred.append({"operator": op, "tollID": r["tollID"],
                              "date": pd.Timestamp(r["date"]).strftime("%Y-%m-%d"),
                              "actual": int(r["total_passages"]), "predicted": round(float(p), 3)})

    return per_company, M.aggregate(scores), pd.DataFrame(rows_pred)


def evaluate_peak(passages, split):
    dev = set(split.train) | set(split.val)
    rows_pred, per_company, scores = [], {}, {}
    for op in paths.OPERATORS:
        peaks = D.actual_peak_hours(op, passages)
        test_p = peaks[peaks["date"].isin(set(split.test))]
        if test_p.empty:
            per_company[op] = {"error": "no test dates"}
            continue

        bundle = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "peak", op))
        model = bundle["pipeline"]
        pred = model.predict_peak_hour(test_p["date"].tolist())
        y = test_p["peak_hour"].to_numpy()
        yhat = pred["predicted_hour"].to_numpy()

        train_p = peaks[peaks["date"].isin(dev)]
        ref = {cls.name: M.peak_hour_scores(y, cls().fit(train_p).predict(test_p["date"].tolist()))
               for cls in B.PEAK_BASELINES}
        per_company[op] = {"model": M.peak_hour_scores(y, yhat), "sanity_check_baselines": ref}
        scores[op] = per_company[op]["model"]
        for (_, r), h in zip(test_p.iterrows(), yhat):
            rows_pred.append({"operator": op,
                              "date": pd.Timestamp(r["date"]).strftime("%Y-%m-%d"),
                              "actual_peak_hour": int(r["peak_hour"]),
                              "predicted_peak_hour": int(h),
                              "day_total_passages": int(r["day_total"])})

    vals = [s for s in scores.values() if s.get("n")]
    agg = {"macro": {
        "exact_acc": float(np.mean([s["exact_acc"] for s in vals])) if vals else None,
        "within_1_acc": float(np.mean([s["within_1_acc"] for s in vals])) if vals else None,
        "mean_circular_abs_error": float(np.mean([s["mean_circular_abs_error"] for s in vals])) if vals else None,
        "n_companies": len(vals),
    }}
    return per_company, agg, pd.DataFrame(rows_pred)


def _plots(out_dir, vol_df, peak_df, vol_pc):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as exc:                      # noqa: BLE001
        return {"made": False, "reason": f"matplotlib unavailable: {exc}"}
    pdir = os.path.join(out_dir, "plots")
    os.makedirs(pdir, exist_ok=True)

    if len(vol_df):
        fig, ax = plt.subplots(figsize=(5, 5))
        ax.scatter(vol_df["actual"], vol_df["predicted"], alpha=0.4, s=18)
        lim = max(1, vol_df[["actual", "predicted"]].to_numpy().max())
        ax.plot([0, lim], [0, lim], "k--", lw=1)
        ax.set_xlabel("actual passages / station-day"); ax.set_ylabel("predicted")
        ax.set_title("Passage volume - held-out test (all operators)")
        fig.tight_layout(); fig.savefig(os.path.join(pdir, "volume_actual_vs_pred.png"), dpi=110)
        plt.close(fig)

    ops = [o for o in paths.OPERATORS if isinstance(vol_pc.get(o), dict) and "model" in vol_pc[o]]
    if ops:
        fig, ax = plt.subplots(figsize=(7, 4))
        x = np.arange(len(ops)); w = 0.35
        ax.bar(x - w / 2, [vol_pc[o]["model"]["mae"] for o in ops], w, label="model")
        ax.bar(x + w / 2, [min(b["mae"] for b in vol_pc[o]["sanity_check_baselines"].values()) for o in ops],
               w, label="mean baseline (sanity check)")
        ax.set_xticks(x); ax.set_xticklabels(ops); ax.set_ylabel("held-out test MAE")
        ax.set_title("Passage volume - model vs mean baseline (sanity check)"); ax.legend()
        fig.tight_layout(); fig.savefig(os.path.join(pdir, "volume_mae_vs_baseline.png"), dpi=110)
        plt.close(fig)

    if len(peak_df):
        fig, ax = plt.subplots(figsize=(5, 5))
        ax.scatter(peak_df["actual_peak_hour"], peak_df["predicted_peak_hour"], alpha=0.5, s=30)
        ax.plot([0, 23], [0, 23], "k--", lw=1)
        ax.set_xlabel("actual peak hour"); ax.set_ylabel("predicted peak hour")
        ax.set_xlim(-1, 24); ax.set_ylim(-1, 24)
        ax.set_title("Peak hour - held-out test")
        fig.tight_layout(); fig.savefig(os.path.join(pdir, "peak_hour_actual_vs_pred.png"), dpi=110)
        plt.close(fig)
    return {"made": True, "dir": os.path.relpath(pdir, paths.BACKEND_DIR)}


def main() -> int:
    passages = D.load_passages()
    tolls = D.load_tolls()
    split = chronological_split(D.unique_dates(passages))

    vol_pc, vol_agg, vol_df = evaluate_volume(passages, tolls, split)
    peak_pc, peak_agg, peak_df = evaluate_peak(passages, split)

    out_dir = paths.evaluation_dir(ARTIFACT_VERSION)
    os.makedirs(out_dir, exist_ok=True)
    vol_df.to_csv(os.path.join(out_dir, "predictions_volume_test.csv"), index=False)
    peak_df.to_csv(os.path.join(out_dir, "predictions_peak_test.csv"), index=False)

    def pc_frame(pc):
        rows = []
        for op, d in pc.items():
            if "model" not in d:
                rows.append({"operator": op, "error": d.get("error")})
                continue
            row = {"operator": op, **{f"model_{k}": v for k, v in d["model"].items()}}
            for bn, bs in d["sanity_check_baselines"].items():
                for k, v in bs.items():
                    row[f"baseline_{bn}_{k}"] = v
            rows.append(row)
        return pd.DataFrame(rows)

    pc_frame(vol_pc).to_csv(os.path.join(out_dir, "per_company_volume.csv"), index=False)
    pc_frame(peak_pc).to_csv(os.path.join(out_dir, "per_company_peak.csv"), index=False)

    plots = _plots(out_dir, vol_df, peak_df, vol_pc)

    report = {
        "version": ARTIFACT_VERSION,
        "random_seed": RANDOM_SEED,
        "provenance": provenance(),
        "purpose": "Integration demo. This step measures the shipped artifacts on "
                   "the held-out dates for reproducibility; the baselines are "
                   "sanity checks, not a target. No selection or tuning happens here.",
        "evaluation": "single held-out chronological TEST split; no retraining; "
                      "baselines fit on TRAIN+VAL",
        "split": split.summary(),
        "volume": {"per_company": vol_pc, "aggregate": vol_agg},
        "peak_hour": {"per_company": peak_pc, "aggregate": peak_agg},
        "plots": plots,
        "caveat": "TEST = 2 dates inside a ~2-week sample. These numbers show the "
                  "integration works end to end; they are not evidence of "
                  "predictive skill and are not comparable to the legacy figures "
                  "(different target population and evaluation).",
    }
    with open(os.path.join(out_dir, "metrics.json"), "w") as fh:
        json.dump(report, fh, indent=2, default=str)

    print(f"=== v2 held-out evaluation ({split.summary()['test']}) — integration demo ===")
    print("\nvolume — model MAE vs mean-baseline MAE (sanity check, lower = closer to the mean):")
    for op, d in vol_pc.items():
        if "model" not in d:
            print(f"  {op:4s} {d.get('error')}"); continue
        b = min(d["sanity_check_baselines"].items(), key=lambda kv: kv[1]["mae"])
        print(f"  {op:4s} model MAE={d['model']['mae']:.3f}   {b[0]} MAE={b[1]['mae']:.3f}")
    print(f"  aggregate (macro): {vol_agg['macro']}")

    print("\npeak hour — model vs baseline (circular metrics):")
    for op, d in peak_pc.items():
        if "model" not in d:
            print(f"  {op:4s} {d.get('error')}"); continue
        print(f"  {op:4s} model exact={d['model']['exact_acc']:.2f} within1={d['model']['within_1_acc']:.2f} "
              f"circErr={d['model']['mean_circular_abs_error']:.2f}")
    print(f"  aggregate (macro): {peak_agg['macro']}")
    print(f"\n  {report['caveat']}")
    print(f"\nwrote {os.path.relpath(out_dir, paths.BACKEND_DIR)}/  (metrics.json + CSVs + plots={plots.get('made')})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
