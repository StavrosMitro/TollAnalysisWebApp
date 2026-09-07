"""python -m ml.smoke_test

Load every committed v2 bundle and exercise inference the way the API will,
asserting the guarantees the frontend and API rely on. Exits non-zero on any
failure. No database, no network.
"""
from __future__ import annotations

import sys
import traceback

import numpy as np
import pandas as pd

from . import ARTIFACT_VERSION, paths
from .artifacts import ArtifactError, load_bundle


def check_volume(op: str) -> list[str]:
    errs: list[str] = []
    bundle = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "volume", op))
    model = bundle["pipeline"]
    meta = bundle["meta"]
    if meta["task"] != "passage_volume" or meta["operator"] != op:
        errs.append(f"{op} volume: metadata task/operator mismatch")

    known = list(model.station_index_.keys())[:3] or [f"{op}01"]
    frame = pd.DataFrame({
        "tollID": known + ["___UNSEEN___"],
        "date": ["2025-07-15"] * (len(known) + 1),
    })
    model.validate_frame(frame)
    pred = model.predict(frame)
    if len(pred) != len(frame):
        errs.append(f"{op} volume: wrong prediction length")
    if not np.all(np.isfinite(pred)):
        errs.append(f"{op} volume: non-finite prediction {pred}")
    if np.any(pred < 0):
        errs.append(f"{op} volume: negative prediction {pred}")
    # unknown station must still yield a finite, non-negative number
    if not (np.isfinite(pred[-1]) and pred[-1] >= 0):
        errs.append(f"{op} volume: unknown-station fallback broken ({pred[-1]})")
    return errs


def check_peak(op: str) -> list[str]:
    errs: list[str] = []
    bundle = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "peak", op))
    model = bundle["pipeline"]
    meta = bundle["meta"]
    if meta["task"] != "peak_hour":
        errs.append(f"{op} peak: metadata task mismatch")

    dates = ["2025-07-15", "2025-12-25"]
    model.validate_dates(dates)
    out = model.predict_peak_hour(dates)
    if list(out.columns[:2]) != ["date", "predicted_hour"]:
        errs.append(f"{op} peak: unexpected columns {list(out.columns)}")
    for h in out["predicted_hour"]:
        if not (isinstance(h, (int, np.integer)) and 0 <= int(h) <= 23):
            errs.append(f"{op} peak: predicted_hour {h!r} is not an int in [0,23]")
    return errs


def check_rejects_bad_schema() -> list[str]:
    """A bundle with an incompatible schema_version must be refused."""
    import os
    import tempfile
    import joblib

    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "bad.joblib")
        joblib.dump({"schema_version": "99.0.0", "pipeline": object(), "meta": {}}, p)
        try:
            load_bundle(p)
        except ArtifactError:
            return []
        return ["load_bundle accepted an incompatible schema_version"]


def main() -> int:
    failures: list[str] = []

    try:
        errs = check_rejects_bad_schema()
        failures += errs
        print(f"  {'schema-guard':17s} {'OK' if not errs else 'FAIL'}")
    except Exception:                             # noqa: BLE001
        failures.append("schema-rejection check crashed:\n" + traceback.format_exc())

    for op in paths.OPERATORS:
        for name, fn in (("volume", check_volume), ("peak", check_peak)):
            try:
                errs = fn(op)
                failures += errs
                print(f"  {op:4s} {name:6s} {'OK' if not errs else 'FAIL'}")
            except (ArtifactError, Exception) as exc:  # noqa: BLE001
                failures.append(f"{op} {name}: {exc}")
                print(f"  {op:4s} {name:6s} ERROR {exc}")

    # missing-artifact path
    try:
        load_bundle(paths.artifact_path(ARTIFACT_VERSION, "volume", "ZZZ"))
        failures.append("missing artifact did not raise")
    except ArtifactError:
        print("  missing-artifact -> ArtifactError OK")

    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(" -", f)
        return 1
    print("\nall smoke checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
