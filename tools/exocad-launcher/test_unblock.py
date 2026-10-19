# -*- coding: utf-8 -*-
"""'인터넷에서 받음' 표시 지우기 — 윈도우 대체 스트림이라 윈도우에서만 뜻이 있습니다 (2026-10-19)"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

from scan_agent import unblock_folder

MOTW = "[ZoneTransfer]\r\nZoneId=3\r\n"


@unittest.skipUnless(sys.platform == "win32", "윈도우 전용")
class UnblockTest(unittest.TestCase):
    def test_removes_mark_and_keeps_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "runtime").mkdir()
            marked = [root / "a.cmd", root / "runtime" / "pythonw.exe"]
            for p in marked:
                p.write_text("x", encoding="ascii")
                with open(f"{p}:Zone.Identifier", "w", encoding="ascii") as f:
                    f.write(MOTW)
            plain = root / "b.py"
            plain.write_text("y", encoding="ascii")

            self.assertEqual(unblock_folder(root), 2)
            for p in marked:
                self.assertFalse(os.path.exists(f"{p}:Zone.Identifier"))
                self.assertEqual(p.read_text(encoding="ascii"), "x")  # 본문은 그대로
            self.assertEqual(plain.read_text(encoding="ascii"), "y")
            # 두 번째는 지울 것이 없습니다
            self.assertEqual(unblock_folder(root), 0)


if __name__ == "__main__":
    unittest.main()
