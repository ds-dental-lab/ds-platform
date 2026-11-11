"""내보내기 거절·지난 파일 치우기 (2026-11-11 치과 첫 실전)"""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import export_tag  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._path = export_tag.PATH
        export_tag.PATH = Path(self.tmp.name) / "launcher" / "expected-export.json"

    def tearDown(self):
        export_tag.PATH = self._path
        self.tmp.cleanup()


class RefuseTest(Base):
    def test_no_tag_no_refusal(self):
        self.assertFalse(export_tag.refuse("치식이 서로 다릅니다"))
        self.assertIsNone(export_tag.refused("o1"))

    def test_refusal_is_read_by_that_order_only(self):
        export_tag.write("o1", [25])
        self.assertTrue(export_tag.refuse("치식이 서로 다릅니다 — 파일 이름 [25] · 정보 파일 [25, 33]", "x_25-25-crown.stl"))
        self.assertIn("정보 파일 [25, 33]", export_tag.refused("o1"))
        self.assertIsNone(export_tag.refused("o2"))

    def test_first_reason_is_kept(self):
        export_tag.write("o1", [25])
        export_tag.refuse("첫 까닭")
        export_tag.refuse("둘째 까닭")
        self.assertEqual(export_tag.refused("o1"), "첫 까닭")

    def test_clear_removes_refusal(self):
        export_tag.write("o1", [25])
        export_tag.refuse("까닭")
        export_tag.clear("o1")
        self.assertIsNone(export_tag.refused("o1"))
        self.assertIsNone(export_tag.read())


class SweepTest(Base):
    def test_moves_old_exports_only(self):
        d = Path(self.tmp.name) / "dl"
        d.mkdir()
        for n in ("a_25-25-crown.stl", "a_33-33-crown.stl", "a_25.constructionInfo", "b_26-27-26-27-bridge.stl",
                  "scan-upperjaw.stl", "notes.txt"):
            (d / n).write_text("x", encoding="utf-8")
        self.assertEqual(export_tag.sweep(d), 4)
        self.assertEqual(sorted(p.name for p in d.iterdir() if p.is_file()), ["notes.txt", "scan-upperjaw.stl"])
        self.assertTrue((d / export_tag.KEEP_FOLDER / "a_25.constructionInfo").is_file())

    def test_purges_after_three_days(self):
        d = Path(self.tmp.name) / "dl"
        keep = d / export_tag.KEEP_FOLDER
        keep.mkdir(parents=True)
        old, new = keep / "old-crown.stl", keep / "new-crown.stl"
        old.write_text("x", encoding="utf-8")
        new.write_text("x", encoding="utf-8")
        now = time.time()
        os.utime(old, (now - 4 * 86400, now - 4 * 86400))
        export_tag.sweep(d, now)
        self.assertFalse(old.exists())
        self.assertTrue(new.exists())

    def test_missing_folder_is_quiet(self):
        self.assertEqual(export_tag.sweep(Path(self.tmp.name) / "none"), 0)


if __name__ == "__main__":
    unittest.main()
