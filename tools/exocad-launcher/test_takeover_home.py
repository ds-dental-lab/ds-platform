# -*- coding: utf-8 -*-
"""옛 폴더 찾기·치우기 — 내 자리는 절대 안 건드림 (2026-10-19, 1.3.8)"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

import takeover


class HomeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def _agent_dir(self, name: str) -> Path:
        d = self.root / name
        (d / "runtime").mkdir(parents=True)
        (d / "scan_agent.py").write_text("# x", encoding="utf-8")
        return d

    def test_agent_home_of(self):
        d = self._agent_dir("덴플로우 에이전트 1.3.2")
        self.assertEqual(takeover.agent_home_of(d / "runtime" / "pythonw.exe"), d)
        # 모양이 다르면 모른다고 합니다 — 엉뚱한 폴더를 지우지 않게
        self.assertIsNone(takeover.agent_home_of(self.root / "python.exe"))
        self.assertIsNone(takeover.agent_home_of(None))

    def test_safe_to_remove(self):
        old = self._agent_dir("덴플로우 에이전트 1.3.2")
        new = self._agent_dir("덴플로우 에이전트 1.3.8")
        self.assertTrue(takeover.safe_to_remove(old, new))
        # 내 자리 / 내 자리를 품은 폴더 / 에이전트 모양이 아닌 폴더 — 전부 아니오
        self.assertFalse(takeover.safe_to_remove(new, new))
        self.assertFalse(takeover.safe_to_remove(self.root, new))
        self.assertFalse(takeover.safe_to_remove(None, new))
        plain = self.root / "덴플로우 에이전트 빈것"
        plain.mkdir()
        self.assertFalse(takeover.safe_to_remove(plain, new))
        other = self._agent_dir("다른 프로그램")
        self.assertFalse(takeover.safe_to_remove(other, new))

    def test_remove_old_home(self):
        old = self._agent_dir("덴플로우 에이전트 1.3.2")
        self.assertTrue(takeover.remove_old_home(old, tries=2))
        self.assertFalse(old.exists())

    def test_run_file_carries_home(self):
        takeover.configure(self.root)
        try:
            takeover.write_run("1.3.8", self.root / "덴플로우 에이전트 1.3.8")
            self.assertTrue(takeover.read_run()["home"].endswith("덴플로우 에이전트 1.3.8"))
        finally:
            takeover.clear_run()

    @unittest.skipUnless(sys.platform == "win32", "윈도우 전용")
    def test_exe_of_pid_self(self):
        exe = takeover.exe_of_pid(os.getpid())
        self.assertEqual(Path(sys.executable).resolve(), exe.resolve())


if __name__ == "__main__":
    unittest.main()
