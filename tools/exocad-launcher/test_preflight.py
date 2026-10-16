# -*- coding: utf-8 -*-
"""설계 PC 자기 점검 — 빠진 것을 정확히 짚는가 (2026-10-16)"""

import json
import tempfile
import unittest
from pathlib import Path

import install_watch
import watch_common


class PreflightTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.appdata = self.home / "AppData" / "Roaming"

    def tearDown(self):
        self.tmp.cleanup()

    def _all_ready(self):
        d = self.appdata / "DenFlow"
        (d / "launcher").mkdir(parents=True)
        (d / "design_agent.json").write_text(json.dumps({"token": "t"}), encoding="utf-8")
        (d / "launcher" / "config.json").write_text("{}", encoding="utf-8")
        (self.appdata / "OrcaSlicer").mkdir(parents=True)
        (self.appdata / "OrcaSlicer" / "OrcaSlicer.conf").write_text("", encoding="utf-8")
        s = self.appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        s.mkdir(parents=True)
        for n in watch_common.STARTUP_VBS:
            (s / n).write_text("", encoding="utf-8")

    def check(self):
        return watch_common.preflight(self.appdata, self.home)

    def test_all_missing(self):
        self.assertEqual(len(self.check()), 6)

    def test_all_ready(self):
        self._all_ready()
        self.assertEqual(self.check(), [])

    def test_launcher_config_missing(self):
        # ★ 2026-10-16 실제로 빠졌던 것
        self._all_ready()
        (self.appdata / "DenFlow" / "launcher" / "config.json").unlink()
        self.assertEqual(len(self.check()), 1)
        self.assertIn("config.json", self.check()[0])

    def test_empty_key_counts_as_missing(self):
        # ★ 진단 중에 빈 열쇠 파일이 생긴 적이 있습니다
        self._all_ready()
        (self.appdata / "DenFlow" / "design_agent.json").write_text("{}", encoding="utf-8")
        self.assertIn("설계 열쇠(design_agent.json)", self.check())

    def test_vbs_names_match_installer(self):
        self.assertEqual(set(watch_common.STARTUP_VBS), set(install_watch.WATCHERS))


if __name__ == "__main__":
    unittest.main()
