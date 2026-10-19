# -*- coding: utf-8 -*-
"""바로가기를 파이썬 안에서 만들고 읽기 — 윈도우 전용 (2026-10-19)"""

import sys
import tempfile
import unittest
from pathlib import Path

import shell_link


@unittest.skipUnless(sys.platform == "win32", "윈도우 전용")
class ShellLinkTest(unittest.TestCase):
    def test_write_then_read_korean_path(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d) / "덴플로우 에이전트"
            root.mkdir()
            target = Path(sys.executable).resolve()
            lnk = root / "덴플로우 에이전트.lnk"
            ok = shell_link.write_link(lnk, target, args=f'"{root / "scan_agent.py"}" --tray',
                                       workdir=root, icon=target, minimized=True)
            self.assertTrue(ok)
            self.assertTrue(lnk.is_file())
            self.assertEqual(Path(shell_link.read_target(lnk)).resolve(), target)

    def test_missing_link_reads_none(self):
        self.assertIsNone(shell_link.read_target(Path(tempfile.gettempdir()) / "없는-바로가기.lnk"))


if __name__ == "__main__":
    unittest.main()
