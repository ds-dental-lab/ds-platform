# -*- coding: utf-8 -*-
"""이름표(export_tag)와 본 파일 표(temp_watch.key_of) — 2026-10-16 점검"""

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import export_tag


class Tag(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(export_tag, "PATH", Path(self.tmp.name) / "tag.json")
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_write_read_fits(self):
        export_tag.write("order-1", [17])
        tag = export_tag.read()
        self.assertEqual(tag["orderId"], "order-1")
        self.assertTrue(export_tag.fits(tag, [17]))
        self.assertFalse(export_tag.fits(tag, [16]))

    def test_old_tag_is_ignored(self):
        export_tag.write("order-1", [17])
        with mock.patch.object(time, "time", return_value=time.time() + export_tag.MAX_AGE + 1):
            self.assertIsNone(export_tag.read())

    def test_clear_only_own(self):
        export_tag.write("order-1", [17])
        export_tag.clear("order-2")
        self.assertIsNotNone(export_tag.read())
        export_tag.clear("order-1")
        self.assertIsNone(export_tag.read())

    def test_no_tag_fits_nothing(self):
        self.assertFalse(export_tag.fits(None, [17]))


class SeenKey(unittest.TestCase):
    def test_same_name_new_content_is_new(self):
        # ★ 덴트버드는 같은 스캔이면 같은 이름으로 내보냅니다 — 이름만 보면 놓칩니다
        from temp_watch import key_of
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "Maxilla_Base_17-17-crown.stl"
            p.write_bytes(b"a" * 10)
            first = key_of(p)
            p.unlink()
            p.write_bytes(b"b" * 20)
            os.utime(p, (time.time() + 5, time.time() + 5))
            self.assertNotEqual(first, key_of(p))


if __name__ == "__main__":
    unittest.main()
