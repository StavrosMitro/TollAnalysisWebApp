"""Versioned model bundles: preprocessing + estimator + metadata in one file.

A bundle is a dict saved with joblib:

    {
      "schema_version": "2.0.0",
      "pipeline":  <fitted sklearn estimator/pipeline>,
      "meta": { ... see REQUIRED_META ... }
    }

Loading refuses a bundle whose schema_version major differs from this code's,
or whose library versions differ from the running interpreter, with a clear
non-sensitive error.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import platform
import subprocess

import joblib
import numpy as np
import pandas as pd
import sklearn

from . import SCHEMA_VERSION

_ML_DIR = os.path.dirname(os.path.abspath(__file__))

REQUIRED_META = [
    "model_type", "task", "operator", "target",
    "feature_names", "training_data_source",
    "train_date_range", "val_date_range", "test_date_range",
    "row_counts", "random_seed", "library_versions",
    "metrics", "baseline_metrics", "created_at",
    "provenance",
]


def library_versions() -> dict:
    return {
        "python": platform.python_version(),
        "scikit_learn": sklearn.__version__,
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "joblib": joblib.__version__,
    }


def git_commit() -> dict:
    def _run(*args):
        try:
            out = subprocess.run(["git", *args], capture_output=True, text=True,
                                 timeout=5, cwd=_ML_DIR)
            return out.stdout.strip() or None
        except Exception:
            return None
    return {"commit": _run("rev-parse", "--short", "HEAD"),
            "dirty": bool(_run("status", "--porcelain"))}


def _sha256_files(paths) -> str:
    """One digest over the given files, in sorted order (path + bytes)."""
    h = hashlib.sha256()
    for p in sorted(paths):
        if not os.path.exists(p):
            continue
        h.update(os.path.relpath(p, _ML_DIR).encode())
        with open(p, "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()


def code_sha256() -> str:
    """Digest of the modules that determine an artifact's behaviour."""
    mods = ["__init__.py", "paths.py", "dataset.py", "features.py", "splits.py",
            "metrics.py", "baselines.py", "artifacts.py",
            "model_volume.py", "model_peak.py", "train_all.py"]
    return _sha256_files(os.path.join(_ML_DIR, m) for m in mods)


def data_sha256() -> dict:
    from . import paths
    return {
        "passages_csv": _sha256_files([paths.PASSAGES_CSV]),
        "tolls_csv": _sha256_files([os.path.join(paths.DATA_DIR, "tolls.csv")]),
    }


def provenance() -> dict:
    """Everything needed to answer 'what produced this artifact'."""
    return {
        "git": git_commit(),
        "code_sha256": code_sha256(),
        "data_sha256": data_sha256(),
        "library_versions": library_versions(),
        "created_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
    }


def build_meta(**kw) -> dict:
    meta = dict(kw)
    meta.setdefault("created_at", _dt.datetime.now(_dt.timezone.utc).isoformat())
    meta.setdefault("library_versions", library_versions())
    meta.setdefault("provenance", provenance())
    meta.setdefault("random_seed", 42)
    missing = [k for k in REQUIRED_META if k not in meta]
    if missing:
        raise ValueError(f"artifact metadata missing required keys: {missing}")
    return meta


def save_bundle(path: str, pipeline, meta: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump({"schema_version": SCHEMA_VERSION, "pipeline": pipeline, "meta": meta},
                path, compress=3)
    with open(os.path.splitext(path)[0] + ".json", "w") as fh:
        json.dump({"schema_version": SCHEMA_VERSION, **meta}, fh, indent=2, default=str)


class ArtifactError(RuntimeError):
    pass


def load_bundle(path: str, *, strict_versions: bool = True) -> dict:
    if not os.path.exists(path):
        raise ArtifactError(f"model artifact not found: {os.path.basename(path)}")
    try:
        bundle = joblib.load(path)
    except Exception as exc:                      # noqa: BLE001
        raise ArtifactError(f"could not read model artifact {os.path.basename(path)}: {exc}") from exc

    got = str(bundle.get("schema_version", "0"))
    if got.split(".")[0] != SCHEMA_VERSION.split(".")[0]:
        raise ArtifactError(
            f"model artifact schema {got} is incompatible with this build "
            f"(expected {SCHEMA_VERSION.split('.')[0]}.x)")

    if strict_versions:
        want = library_versions()
        have = bundle.get("meta", {}).get("library_versions", {})
        for lib in ("scikit_learn", "numpy"):
            if have.get(lib) and have[lib] != want[lib]:
                raise ArtifactError(
                    f"model artifact was built with {lib} {have[lib]} but this "
                    f"runtime has {want[lib]}; refusing to load")
    for key in ("pipeline", "meta"):
        if key not in bundle:
            raise ArtifactError(f"model artifact {os.path.basename(path)} missing '{key}'")
    return bundle


def write_index(version_dir: str, entries: list[dict]) -> None:
    os.makedirs(version_dir, exist_ok=True)
    with open(os.path.join(version_dir, "index.json"), "w") as fh:
        json.dump({"generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
                   "artifacts": entries}, fh, indent=2, default=str)
