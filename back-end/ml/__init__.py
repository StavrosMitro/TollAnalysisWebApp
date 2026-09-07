"""Reproducible, honestly-evaluated ML pipeline for TollAnalysis.

Modules:
    paths          canonical filesystem locations + the operator list
    dataset        load passages, build the passage-volume and peak-hour tables
    features       deterministic calendar features (identical in train + inference)
    splits         chronological, date-based train/validation/test split + guards
    metrics        MAE / RMSE / sMAPE and circular-hour metrics
    baselines      the naive baselines every model is compared against
    artifacts      versioned model+preprocessing bundles with metadata
    model_volume   passage-volume model (per operator)
    model_peak     peak-hour model (24 hourly-volume predictions -> argmax hour)

Command-line entry points (run inside the pinned container, see ml/README.md):
    python -m ml.validate_data
    python -m ml.train_all
    python -m ml.evaluate_all
    python -m ml.evaluate_legacy
    python -m ml.smoke_test
"""

ARTIFACT_VERSION = "v2"
SCHEMA_VERSION = "2.0.0"
RANDOM_SEED = 42
