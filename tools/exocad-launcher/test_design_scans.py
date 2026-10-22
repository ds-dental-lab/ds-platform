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

    def test_medit_default_names(self):
        # 메딧 Link 기본 내보내기 이름 — 2026-10-22 시험에서 아래턱을 못 찾던 것
        make(self.dir, "2026-09-09-홍길동-maxillary.stl", "2026-09-09-홍길동-mandibular.stl",
             "2026-09-09-홍길동-occlusionfirst.stl")
        prep, anta = pick(candidates(self.dir), 16)
        self.assertEqual((prep.name, anta.name), ("2026-09-09-홍길동-maxillary.stl", "2026-09-09-홍길동-mandibular.stl"))
        prep, anta = pick(candidates(self.dir), 36)
        self.assertEqual(prep.name, "2026-09-09-홍길동-mandibular.stl")

    def test_obj_is_candidate_and_converts(self):
        obj = self.dir / "2026-09-09-홍길동-maxillary.obj"
        obj.write_text("\n".join(["# <MEDIT>", "v 0 0 0", "v 1 0 0", "v 0 1 0", "v 1 1 0", "f 1/1 2/2 3/3", "f 1 2 4 3", ""]), encoding="utf-8")
        make(self.dir, "2026-09-09-홍길동-mandibular.obj")
        found = candidates(self.dir)
        self.assertEqual(len(found), 2)
        from design_scans import to_stl
        stl = to_stl(obj)
        self.assertEqual(stl.suffix, ".stl")
        self.assertTrue(stl.exists())
        # 삼각형 1 + 사각형 부채꼴 2 = 3면 → 84 + 3*50 바이트
        self.assertEqual(stl.stat().st_size, 84 + 3 * 50)
        self.assertIs(to_stl(stl), stl)

    def test_gingiva_and_preop_are_skipped(self):
        # DS Core 내보내기 모양 — 잇몸·삭제 전 스캔이 같이 와도 위턱 후보는 하나
        make(self.dir, "x-upperjaw.ply", "x-upperjaw-gingiva.ply", "x-lowerjaw.ply", "x-upperjaw-situ.ply")
        prep, anta = pick(candidates(self.dir), 16)
        self.assertEqual((prep.name, anta.name), ("x-upperjaw.ply", "x-lowerjaw.ply"))

    def test_ensure_meshes_without_dscore_settings(self):
        from unittest import mock
        import design_scans
        make(self.dir, "2026-10-01_환자.dxd")
        with mock.patch("dscore.has_settings", return_value=False):
            with self.assertRaises(PickError) as cm:
                design_scans.ensure_meshes(self.dir, "ORD", say=lambda m: None)  # noqa
        self.assertIn("DS Core", str(cm.exception))

    def test_ensure_meshes_noop_when_meshes_exist(self):
        import design_scans
        make(self.dir, "a-upperjaw.stl", "x.dxd")
        got, converted = design_scans.ensure_meshes(self.dir, "ORD", say=lambda m: None)
        self.assertEqual([p.name for p in got], ["a-upperjaw.stl"])
        self.assertEqual(converted, [])

    def test_dxd_only_stops_with_clear_message(self):
        make(self.dir, "2026-10-01_환자.dxd")
        with self.assertRaises(PickError) as cm:
            candidates(self.dir)
        self.assertIn("STL", str(cm.exception))

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
