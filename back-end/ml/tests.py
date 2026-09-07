"""python -m ml.tests   — the containerised ML test suite.

Runs inside the pinned application image (same scikit-learn as request-path
inference); no host Python, no network. Covers feature determinism, split
integrity, baselines, zero-safe + circular metrics, preprocessing/model
consistency, unknown-station handling, artifact metadata + version guards,
integer peak-hour output, and end-to-end `ml.infer` behaviour.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd

from . import ARTIFACT_VERSION, paths
from . import dataset as D
from . import features as F
from . import metrics as M
from . import baselines as B
from .artifacts import ArtifactError, REQUIRED_META, load_bundle, build_meta
from .model_volume import VolumeModel
from .model_peak import PeakModel
from .splits import chronological_split, assert_no_leakage, DateSplit, rows_for_dates


PASSAGES = D.load_passages()
DATES = D.unique_dates(PASSAGES)
SPLIT = chronological_split(DATES)


class Features(unittest.TestCase):
    def test_deterministic(self):
        d = pd.Series(["2022-01-01", "2022-06-15", "2022-12-31"])
        a = F.date_features(d)
        b = F.date_features(d.copy())
        pd.testing.assert_frame_equal(a, b)
        self.assertEqual(list(a.columns), F.DATE_FEATURES)

    def test_volume_matrix_unknown_station_is_minus_one(self):
        idx = {"NAO01": 0, "NAO02": 1}
        m = F.volume_matrix(pd.DataFrame({"tollID": ["NAO02", "ZZ99"], "date": ["2022-01-01"] * 2}), idx)
        self.assertEqual(list(m["station_code"]), [1, -1])

    def test_train_and_infer_use_same_columns(self):
        vt = D.volume_table("NAO", PASSAGES)
        model = VolumeModel().fit(vt)
        train_cols = list(F.volume_matrix(vt.head(3), model.station_index_).columns)
        infer_cols = list(F.volume_matrix(pd.DataFrame({"tollID": ["NAO01"], "date": ["2025-01-01"]}),
                                          model.station_index_).columns)
        self.assertEqual(train_cols, infer_cols)
        self.assertEqual(train_cols, model.feature_names_)


class Splits(unittest.TestCase):
    def test_chronological_guarantees(self):
        assert_no_leakage(SPLIT)
        self.assertLess(max(SPLIT.train), min(SPLIT.val))
        self.assertLess(max(SPLIT.val), min(SPLIT.test))
        self.assertEqual(set(), set(SPLIT.train) & set(SPLIT.test))

    def test_no_row_leaks_across_split_for_any_operator(self):
        for op in paths.OPERATORS:
            vt = D.volume_table(op, PASSAGES)
            tr = set(rows_for_dates(vt, SPLIT.train)["date"])
            te = set(rows_for_dates(vt, SPLIT.test)["date"])
            self.assertEqual(set(), tr & te, op)

    def test_rejects_overlap(self):
        d = [pd.Timestamp("2022-01-01"), pd.Timestamp("2022-01-02"), pd.Timestamp("2022-01-03")]
        bad = DateSplit(train=d[:2], val=[d[1]], test=[d[2]])
        with self.assertRaises(AssertionError):
            assert_no_leakage(bad)

    def test_needs_three_dates(self):
        with self.assertRaises(ValueError):
            chronological_split(["2022-01-01", "2022-01-02"])


class Baselines(unittest.TestCase):
    def test_global_mean(self):
        tr = pd.DataFrame({"tollID": ["A", "A", "B"], "total_passages": [0, 2, 1], "date": ["x"] * 3})
        b = B.GlobalMeanBaseline().fit(tr)
        self.assertAlmostEqual(b.predict(tr)[0], 1.0)

    def test_per_station_mean_and_unknown_fallback(self):
        tr = pd.DataFrame({"tollID": ["A", "A", "B"], "total_passages": [0, 2, 3], "date": ["x"] * 3})
        b = B.PerStationMeanBaseline().fit(tr)
        te = pd.DataFrame({"tollID": ["A", "B", "NEW"], "date": ["x"] * 3})
        got = b.predict(te)
        self.assertAlmostEqual(got[0], 1.0)
        self.assertAlmostEqual(got[1], 3.0)
        self.assertAlmostEqual(got[2], (0 + 2 + 3) / 3)   # unknown -> global

    def test_peak_hour_mode_is_integer(self):
        tp = pd.DataFrame({"date": pd.to_datetime(["2022-01-01", "2022-01-02", "2022-01-03"]),
                           "peak_hour": [8, 8, 17]})
        h = B.GlobalPeakHourBaseline().fit(tp).predict(tp["date"])
        self.assertTrue(np.issubdtype(h.dtype, np.integer))
        self.assertEqual(int(h[0]), 8)


class Metrics(unittest.TestCase):
    def test_smape_zero_safe(self):
        self.assertEqual(M.smape([0, 0], [0, 0]), 0.0)
        self.assertFalse(np.isnan(M.smape([0, 1], [0.5, 1])))

    def test_mae_rmse(self):
        self.assertAlmostEqual(M.mae([1, 3], [1, 1]), 1.0)
        self.assertAlmostEqual(M.rmse([0, 0], [3, 4]), 3.5355339, places=5)

    def test_circular_distance(self):
        self.assertEqual(list(M.circular_hour_distance([23, 0, 12], [0, 23, 12])), [1, 1, 0])

    def test_peak_hour_scores(self):
        s = M.peak_hour_scores([0, 12], [1, 12])
        self.assertEqual(s["exact_acc"], 0.5)
        self.assertEqual(s["within_1_acc"], 1.0)
        self.assertAlmostEqual(s["mean_circular_abs_error"], 0.5)


class ModelBehaviour(unittest.TestCase):
    def test_volume_predictions_finite_nonnegative(self):
        for op in paths.OPERATORS:
            vt = D.volume_table(op, PASSAGES)
            m = VolumeModel().fit(vt)
            frame = pd.DataFrame({"tollID": list(m.station_index_)[:2] + ["___NEW___"],
                                  "date": ["2025-07-15"] * 3})
            p = m.predict(frame)
            self.assertTrue(np.all(np.isfinite(p)), op)
            self.assertTrue(np.all(p >= 0), op)
            self.assertEqual(len(p), 3)

    def test_volume_validate_frame(self):
        with self.assertRaises(ValueError):
            VolumeModel.validate_frame(pd.DataFrame({"date": ["2022-01-01"]}))

    def test_peak_output_is_integer_hour(self):
        for op in paths.OPERATORS:
            m = PeakModel().fit(D.hourly_table(op, PASSAGES))
            out = m.predict_peak_hour(["2025-07-15", "2025-12-25"])
            for h in out["predicted_hour"]:
                self.assertIsInstance(int(h), int)
                self.assertGreaterEqual(int(h), 0)
                self.assertLessEqual(int(h), 23)

    def test_repeatable_fit(self):
        vt = D.volume_table("NAO", PASSAGES)
        f = pd.DataFrame({"tollID": ["NAO01", "NAO05"], "date": ["2025-01-01"] * 2})
        p1 = VolumeModel().fit(vt).predict(f)
        p2 = VolumeModel().fit(vt).predict(f)
        np.testing.assert_array_almost_equal(p1, p2)


class Artifacts(unittest.TestCase):
    def test_every_bundle_loads_with_full_metadata(self):
        for task in ("volume", "peak"):
            for op in paths.OPERATORS:
                b = load_bundle(paths.artifact_path(ARTIFACT_VERSION, task, op))
                for key in REQUIRED_META:
                    self.assertIn(key, b["meta"], f"{task}/{op}:{key}")
                self.assertEqual(b["meta"]["operator"], op)

    def test_missing_artifact_raises(self):
        with self.assertRaises(ArtifactError):
            load_bundle(paths.artifact_path(ARTIFACT_VERSION, "volume", "NOPE"))

    def test_incompatible_schema_rejected(self):
        import joblib
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "b.joblib")
            joblib.dump({"schema_version": "99.0.0", "pipeline": None, "meta": {}}, p)
            with self.assertRaises(ArtifactError):
                load_bundle(p)

    def test_incompatible_library_rejected(self):
        import joblib
        meta = {"library_versions": {"scikit_learn": "0.0.0-fake", "numpy": "0.0.0"}}
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "b.joblib")
            joblib.dump({"schema_version": "2.0.0", "pipeline": None, "meta": meta}, p)
            with self.assertRaises(ArtifactError):
                load_bundle(p, strict_versions=True)

    def test_build_meta_requires_keys(self):
        with self.assertRaises(ValueError):
            build_meta(model_type="x")

    def test_provenance_records_code_and_data_hashes(self):
        from .artifacts import code_sha256, data_sha256
        for op in ("NAO", "GE"):
            meta = load_bundle(paths.artifact_path(ARTIFACT_VERSION, "volume", op))["meta"]
            prov = meta["provenance"]
            self.assertRegex(prov["code_sha256"], r"^[0-9a-f]{64}$")
            self.assertRegex(prov["data_sha256"]["passages_csv"], r"^[0-9a-f]{64}$")
            self.assertRegex(prov["data_sha256"]["tolls_csv"], r"^[0-9a-f]{64}$")
            # the recorded data hash matches the committed dataset right now
            self.assertEqual(prov["data_sha256"], data_sha256())
        # code hash is stable across calls
        self.assertEqual(code_sha256(), code_sha256())


class InferCLI(unittest.TestCase):
    def _run(self, *args):
        p = subprocess.run([sys.executable, "-m", "ml.infer", *args],
                           capture_output=True, text=True, cwd=paths.BACKEND_DIR,
                           env={**os.environ, "PYTHONPATH": paths.BACKEND_DIR})
        last = [l for l in p.stdout.strip().splitlines() if l.strip()]
        return p.returncode, (json.loads(last[-1]) if last else {})

    def test_volume_ok(self):
        rc, out = self._run("volume", "--operator", "NAO", "--date", "2022-01-14",
                            "--stations", "NAO01,NAO02,ZZ99")
        self.assertEqual(rc, 0)
        self.assertEqual(len(out["predictions"]), 3)
        self.assertTrue(all(np.isfinite(x) and x >= 0 for x in out["predictions"]))
        self.assertEqual(out["model"]["artifact_version"], ARTIFACT_VERSION)
        # provenance is surfaced; no competitive "beats baseline" framing
        self.assertRegex(out["model"]["provenance"]["code_sha256"], r"^[0-9a-f]{64}$")
        self.assertNotIn("beats_baseline", json.dumps(out))
        self.assertIn("sanity_check_baseline", out["evaluation"])

    def test_held_out_date_is_not_extrapolation(self):
        rc, out = self._run("volume", "--operator", "NAO", "--date", "2022-01-14", "--stations", "NAO01")
        self.assertEqual(rc, 0)
        self.assertFalse(out["date_context"]["extrapolation"])

    def test_far_date_flagged_as_extrapolation(self):
        rc, out = self._run("volume", "--operator", "NAO", "--date", "2025-06-01", "--stations", "NAO01")
        self.assertEqual(rc, 0)
        self.assertTrue(out["date_context"]["extrapolation"])
        self.assertIn("2025-06-01", out["date_context"]["dates_outside_observed_window"])

    def test_peak_ok_integer(self):
        rc, out = self._run("peak", "--operator", "EG", "--from", "2022-01-13", "--to", "2022-01-14")
        self.assertEqual(rc, 0)
        for rec in out["predictions"]:
            self.assertIsInstance(rec["predicted_hour"], int)
            self.assertTrue(0 <= rec["predicted_hour"] <= 23)
        self.assertFalse(out["date_context"]["extrapolation"])

    def test_rejects_unknown_operator(self):
        rc, out = self._run("volume", "--operator", "ZZ", "--date", "2022-05-01", "--stations", "X")
        self.assertNotEqual(rc, 0)
        self.assertEqual(out["error"]["code"], "UNKNOWN_OPERATOR")

    def test_rejects_bad_date(self):
        rc, out = self._run("peak", "--operator", "NAO", "--from", "nope", "--to", "2022-01-16")
        self.assertNotEqual(rc, 0)
        self.assertEqual(out["error"]["code"], "BAD_DATE")

    def test_never_trains_no_pkl_write(self):
        before = {p for p in os.listdir(paths.artifact_dir(ARTIFACT_VERSION, "volume"))}
        self._run("volume", "--operator", "NAO", "--date", "2022-01-14", "--stations", "NAO01")
        after = {p for p in os.listdir(paths.artifact_dir(ARTIFACT_VERSION, "volume"))}
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main(verbosity=2)
