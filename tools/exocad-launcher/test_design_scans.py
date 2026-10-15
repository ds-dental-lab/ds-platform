# -*- coding: utf-8 -*-
"""design_scans — 어느 스캔을 올릴지 (2026-10-15)"""

import tempfile
import unittest
import zipfile
from pathlib import Path

from design_scans import PickError, candidates, pick, unzip_all


def make(folder: Path, *names: str) -> None:
    for n in names:
        (folder / n).write_bytes(b"solid x")


class Pick(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_medit_upper_tooth(self):
        # 한복계1 17 — 실제로 받은 묶음 그대로
        make(self.dir, "Maxilla_Base.stl", "Maxilla_Base.ply", "Mandible_Base.stl", "Mandible_Base.ply",
             "Occlusion_FirstBase.stl", "Occlusion_FirstBase.ply")
        prep, anta = pick(candidates(self.dir), 17)
        self.assertEqual((prep.name, anta.name), ("Maxilla_Base.stl", "Mandible_Base.stl"))

    def test_lower_tooth_swaps(self):
        make(self.dir, "Maxilla_Base.stl", "Mandible_Base.stl")
        prep, anta = pick(candidates(self.dir), 36)
        self.assertEqual((prep.name, anta.name), ("Mandible_Base.stl", "Maxilla_Base.stl"))

    def test_exocad_role_names_win(self):
        # 이름이 역할을 말하면 치식과 상관없이 그대로
        make(self.dir, "홍길동-PreparationScan.stl", "홍길동-AntagonistScan.stl", "홍길동-upperjaw.stl")
        prep, anta = pick(candidates(self.dir), 36)
        self.assertIn("Preparation", prep.name)
        self.assertIn("Antagonist", anta.name)

    def test_ply_only(self):
        make(self.dir, "upperjaw.ply", "lowerjaw.ply")
        prep, _ = pick(candidates(self.dir), 26)
        self.assertEqual(prep.name, "upperjaw.ply")

    def test_ambiguous_stops(self):
        make(self.dir, "upperjaw.stl", "upperjaw_2.stl", "lowerjaw.stl")
        with self.assertRaises(PickError):
            pick(candidates(self.dir), 16)

    def test_missing_stops(self):
        make(self.dir, "upperjaw.stl")
        with self.assertRaises(PickError):
            pick(candidates(self.dir), 16)

    def test_unzip_and_nested(self):
        z = self.dir / "case.zip"
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("in/Maxilla_Base.stl", "x")
            zf.writestr("in/Mandible_Base.stl", "x")
        unzip_all(self.dir)
        prep, _ = pick(candidates(self.dir), 17)
        self.assertEqual(prep.name, "Maxilla_Base.stl")

    def test_zip_slip_blocked(self):
        z = self.dir / "bad.zip"
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("../evil.stl", "x")
        with self.assertRaises(PickError):
            unzip_all(self.dir)


if __name__ == "__main__":
    unittest.main()
