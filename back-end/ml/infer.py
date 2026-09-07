"""python -m ml.infer <task> ...   — request-path inference for the REST API.

Never trains. Loads a committed v2 bundle, validates inputs, and prints one JSON
object to stdout. Non-zero exit + a JSON {"error": {...}} on any failure, with no
filesystem paths or stack traces.

    python -m ml.infer volume --operator NAO --date 2022-03-15 --stations NAO01,NAO02
    python -m ml.infer peak   --operator NAO --from 2022-01-10 --to 2022-01-20
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys

import pandas as pd

import os

from . import ARTIFACT_VERSION, SCHEMA_VERSION, paths
from .artifacts import ArtifactError, load_bundle

MAX_PEAK_DAYS = 62

_EVAL_CACHE: dict = {}


def _eval_summary(task: str, operator: str) -> dict | None:
    """Compact held-out-test result for this operator, from the committed
    ml/evaluation/v2/metrics.json (produced by `python -m ml.evaluate_all`)."""
    if "data" not in _EVAL_CACHE:
        path = os.path.join(paths.evaluation_dir(ARTIFACT_VERSION), "metrics.json")
        try:
            with open(path) as fh:
                _EVAL_CACHE["data"] = json.load(fh)
        except Exception:                        # noqa: BLE001
            _EVAL_CACHE["data"] = None
    root = _EVAL_CACHE["data"]
    if not root:
        return None
    key = "volume" if task == "passage_volume" else "peak_hour"
    pc = root.get(key, {}).get("per_company", {}).get(operator)
    if not pc or "model" not in pc:
        return None
    ref = pc.get("sanity_check_baselines", {})
    common = {
        "split": "chronological held-out test",
        "test_dates": root["split"]["test"],
        "note": "held-out result, shown for the integration demo; the baseline is "
                "a sanity check, not a target",
    }
    if key == "volume":
        b = min(ref.items(), key=lambda kv: kv[1]["mae"]) if ref else None
        return {**common,
                "test_mae": round(pc["model"]["mae"], 3),
                "test_rmse": round(pc["model"]["rmse"], 3),
                "sanity_check_baseline": (
                    {"name": b[0], "test_mae": round(b[1]["mae"], 3)} if b else None)}
    b = max(ref.items(), key=lambda kv: kv[1]["within_1_acc"]) if ref else None
    return {**common,
            "exact_hour_accuracy": round(pc["model"]["exact_acc"], 3),
            "within_1_hour_accuracy": round(pc["model"]["within_1_acc"], 3),
            "mean_circular_abs_error_hours": round(pc["model"]["mean_circular_abs_error"], 2),
            "sanity_check_baseline": ({"name": b[0]} if b else None)}


def _fail(code: str, message: str, http: int = 400) -> int:
    print(json.dumps({"error": {"code": code, "message": message}, "http_status": http}))
    return 1


def _parse_date(s: str) -> dt.date:
    return dt.datetime.strptime(s, "%Y-%m-%d").date()


OBSERVED_MIN = dt.date(2021, 12, 31)
OBSERVED_MAX = dt.date(2022, 1, 14)


def _model_info(meta: dict) -> dict:
    prov = meta.get("provenance", {}) or {}
    return {
        "artifact_version": ARTIFACT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "model_type": meta.get("model_type"),
        "trained_on": meta.get("training_data_source"),
        "train_date_range": meta.get("train_date_range"),
        "test_date_range": meta.get("test_date_range"),
        "provenance": {
            "git": prov.get("git"),
            "code_sha256": prov.get("code_sha256"),
            "data_sha256": prov.get("data_sha256"),
            "created_at": prov.get("created_at"),
        },
        "evaluation": "chronological held-out test; see docs/ML_METHODOLOGY.md",
        "replaceable": "This is an integration demo. The same API and artifact "
                       "contract serves a replacement bundle trained on real "
                       "client data or a client-provided model without changing "
                       "the application.",
    }


def _date_context(dates: list[str]) -> dict:
    """Flag requests outside the ~2-week observed window as extrapolation."""
    ds = [dt.date.fromisoformat(d) for d in dates]
    outside = [d.isoformat() for d in ds if d < OBSERVED_MIN or d > OBSERVED_MAX]
    return {
        "observed_data_range": [OBSERVED_MIN.isoformat(), OBSERVED_MAX.isoformat()],
        "held_out_test_dates": ["2022-01-13", "2022-01-14"],
        "extrapolation": bool(outside),
        "dates_outside_observed_window": outside,
        "message": ("all requested dates fall inside the observed window"
                    if not outside else
                    "one or more requested dates are outside the ~2-week observed "
                    "window - the output is an unvalidated extrapolation, shown to "
                    "exercise the integration, not as a forecast"),
    }


def run_volume(args) -> int:
    if args.operator not in paths.OPERATORS:
        return _fail("UNKNOWN_OPERATOR", f"operator '{args.operator}' is not supported", 400)
    try:
        _parse_date(args.date)
    except ValueError:
        return _fail("BAD_DATE", "date must be YYYY-MM-DD", 400)
    stations = [s.strip() for s in (args.stations or "").split(",") if s.strip()]
    if not stations:
        return _fail("NO_STATIONS", "no toll stations supplied for this operator", 422)

    try:
        bundle = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "volume", args.operator))
    except ArtifactError as exc:
        return _fail("MODEL_UNAVAILABLE", str(exc), 503)

    model = bundle["pipeline"]
    frame = pd.DataFrame({"tollID": stations, "date": [args.date] * len(stations)})
    try:
        model.validate_frame(frame)
        preds = model.predict(frame)
    except Exception as exc:                      # noqa: BLE001
        return _fail("INFERENCE_FAILED", f"could not produce a forecast: {exc}", 500)

    known = set(getattr(model, "station_index_", {}))
    rows = [{"tollID": s, "predicted_passages": round(float(p), 3),
             "station_seen_in_training": s in known}
            for s, p in zip(stations, preds)]
    print(json.dumps({
        "task": "passage_volume", "operator": args.operator, "date": args.date,
        "predictions": [r["predicted_passages"] for r in rows],
        "stations": rows,
        "total_predicted_passages": round(float(sum(p for p in preds)), 3),
        "model": _model_info(bundle["meta"]),
        "evaluation": _eval_summary("passage_volume", args.operator),
        "date_context": _date_context([args.date]),
        "limitations": bundle["meta"].get("notes") or
        "educational sample (~2 weeks, 2022); integration demo, not a validated forecast",
    }))
    return 0


def run_peak(args) -> int:
    if args.operator not in paths.OPERATORS:
        return _fail("UNKNOWN_OPERATOR", f"operator '{args.operator}' is not supported", 400)
    try:
        d0, d1 = _parse_date(args.date_from), _parse_date(args.date_to)
    except ValueError:
        return _fail("BAD_DATE", "from/to must be YYYY-MM-DD", 400)
    if d1 < d0:
        return _fail("BAD_RANGE", "'from' must be on or before 'to'", 400)
    days = (d1 - d0).days + 1
    if days > MAX_PEAK_DAYS:
        return _fail("RANGE_TOO_LARGE", f"at most {MAX_PEAK_DAYS} days per request", 400)

    try:
        bundle = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "peak", args.operator))
    except ArtifactError as exc:
        return _fail("MODEL_UNAVAILABLE", str(exc), 503)

    model = bundle["pipeline"]
    dates = [(d0 + dt.timedelta(days=i)).isoformat() for i in range(days)]
    try:
        model.validate_dates(dates)
        out = model.predict_peak_hour(dates)
    except Exception as exc:                      # noqa: BLE001
        return _fail("INFERENCE_FAILED", f"could not produce a prediction: {exc}", 500)

    records = [{"passage_date": r["date"], "company": args.operator,
                "predicted_hour": int(r["predicted_hour"])}
               for _, r in out.iterrows()]
    print(json.dumps({
        "task": "peak_hour", "operator": args.operator,
        "predictions": records,
        "model": _model_info(bundle["meta"]),
        "evaluation": _eval_summary("peak_hour", args.operator),
        "date_context": _date_context(dates),
        "limitations": bundle["meta"].get("notes") or
        "very sparse sample; hour is an integer 0-23 chosen as argmax of 24 "
        "predicted hourly volumes; integration demo, not a validated prediction",
    }))
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="ml.infer")
    sub = p.add_subparsers(dest="task", required=True)
    v = sub.add_parser("volume")
    v.add_argument("--operator", required=True)
    v.add_argument("--date", required=True)
    v.add_argument("--stations", required=True)
    k = sub.add_parser("peak")
    k.add_argument("--operator", required=True)
    k.add_argument("--from", dest="date_from", required=True)
    k.add_argument("--to", dest="date_to", required=True)
    args = p.parse_args(argv)
    try:
        return run_volume(args) if args.task == "volume" else run_peak(args)
    except Exception as exc:                      # noqa: BLE001
        return _fail("INTERNAL", f"unexpected inference error: {type(exc).__name__}", 500)


if __name__ == "__main__":
    sys.exit(main())
