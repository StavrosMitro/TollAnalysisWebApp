# `ml/` — traffic-forecasting pipeline

Reproducible, honestly-evaluated ML for the passage-volume and peak-hour
forecasts. Full write-up: [`docs/ML_METHODOLOGY.md`](../../docs/ML_METHODOLOGY.md).

Everything runs in the **pinned application container** (the host Python is not
supported). A `ml` compose service wraps it:

```bash
docker compose --profile ml run --rm ml -m ml.validate_data
docker compose --profile ml run --rm ml -m ml.evaluate_legacy
docker compose --profile ml run --rm ml -m ml.train_all
docker compose --profile ml run --rm ml -m ml.evaluate_all
docker compose --profile ml run --rm ml -m ml.smoke_test
docker compose --profile ml run --rm ml -m ml.tests
```

## Layout

| path | what |
|---|---|
| `data/passages.csv`, `data/tolls.csv` | **the only training source** — see below |
| `paths.py` `dataset.py` `features.py` `splits.py` `metrics.py` `baselines.py` | pipeline building blocks |
| `model_volume.py` `model_peak.py` | the two self-contained model classes |
| `artifacts.py` | versioned bundle save/load + metadata schema + version guards |
| `validate_data.py` `train_all.py` `evaluate_all.py` `evaluate_legacy.py` `smoke_test.py` `infer.py` `tests.py` | CLI entry points |
| `artifacts/v2/` | committed model bundles (`<task>/<OP>.joblib` + `.json` sidecar + `index.json`) |
| `evaluation/` | `data_audit.json`, `legacy/metrics.json`, `v2/metrics.json` + CSVs + plots |
| `predict.py` `train.py` `predict_peak_hours.py` `train_peak_hours.py` | **legacy**, no longer used by the API — kept until v2 is accepted |
| `input/ results/ training_data/ training_data_peak_hours/ input_peak_hours/ results_peak_hour/` | **orphaned** legacy CSVs — cleanup candidates |

## Regenerating `data/passages.csv` and `data/tolls.csv`

They are verbatim exports of the seeded database. With the stack up:

```bash
docker compose exec -T db mysql -uroot -proot_local_only toll_analysis -B -e "
  SELECT p.timestamp, p.tollID, t.OpID AS company, p.charge
  FROM Passages p JOIN Toll t ON p.tollID = t.Toll_id
  ORDER BY p.timestamp, p.tollID, p.passage_id;" \
  | sed 's/\t/,/g' > back-end/ml/data/passages.csv

docker compose exec -T db mysql -uroot -proot_local_only toll_analysis -B -e "
  SELECT Toll_id AS tollID, OpID AS company, name, latitude, longitude
  FROM Toll ORDER BY OpID, Toll_id;" \
  | sed 's/\t/,/g' > back-end/ml/data/tolls.csv
```

`python -m ml.validate_data` re-checks `passages.csv` against the live seed DB
(when reachable) and warns on any drift.
