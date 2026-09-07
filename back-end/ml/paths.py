"""Canonical filesystem locations and the operator list.

Nothing here writes; callers create directories as needed.
"""
from __future__ import annotations

import os

ML_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(ML_DIR)

# --- committed inputs -------------------------------------------------------
DATA_DIR = os.path.join(ML_DIR, "data")
PASSAGES_CSV = os.path.join(DATA_DIR, "passages.csv")

# --- committed outputs ----------------------------------------------------
ARTIFACTS_DIR = os.path.join(ML_DIR, "artifacts")          # <version>/volume|peak/<OP>.joblib
EVALUATION_DIR = os.path.join(ML_DIR, "evaluation")        # <version>/... , legacy/...

# --- legacy (kept until the new pipeline is verified) --------------------
LEGACY_VOLUME_DIR = os.path.join(BACKEND_DIR, "models_passages")
LEGACY_PEAK_DIR = os.path.join(BACKEND_DIR, "models_peak_hours")

# The eight motorway operators, in a fixed order.
OPERATORS = ["AM", "EG", "GE", "KO", "MO", "NAO", "NO", "OO"]


def artifact_dir(version: str, task: str) -> str:
    """<ARTIFACTS_DIR>/<version>/<task>  (task = 'volume' | 'peak')."""
    return os.path.join(ARTIFACTS_DIR, version, task)


def artifact_path(version: str, task: str, operator: str) -> str:
    return os.path.join(artifact_dir(version, task), f"{operator}.joblib")


def evaluation_dir(version: str) -> str:
    return os.path.join(EVALUATION_DIR, version)
