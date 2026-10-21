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

    def test_server_role_needs_only_its_two(self):
        # ★ 서버 PC (2026-10-20): 설계 일꾼·임시치아만 맡음 — exocad vbs·런처 설정은 안 물음
        self._all_ready()
        (self.appdata / "DenFlow" / "watchers.json").write_text(
            json.dumps({"installed": ["덴플로우 임시치아 지켜보기.vbs", "덴플로우 설계 일꾼.vbs"]}, ensure_ascii=False),
            encoding="utf-8",
        )
        (self.appdata / "DenFlow" / "launcher" / "config.json").unlink()
        s = self.appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        (s / "덴플로우 exocad 지켜보기.vbs").unlink()
        self.assertEqual(self.check(), [])
        self.assertEqual(watch_common.expected_scripts(self.appdata), ["temp_watch", "design_worker"])

    def test_server_role_still_misses_its_own(self):
        self._all_ready()
        (self.appdata / "DenFlow" / "watchers.json").write_text(
            json.dumps({"installed": ["덴플로우 설계 일꾼.vbs"]}, ensure_ascii=False), encoding="utf-8")
        s = self.appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        (s / "덴플로우 설계 일꾼.vbs").unlink()
        self.assertEqual(self.check(), ["시작프로그램 덴플로우 설계 일꾼.vbs"])

    def test_broken_list_falls_back_to_all(self):
        self._all_ready()
        (self.appdata / "DenFlow" / "watchers.json").write_text("{bad", encoding="utf-8")
        self.assertEqual(self.check(), [])
        self.assertEqual(len(watch_common.expected_watchers(self.appdata)), 3)

    def test_only_picks_known_scripts(self):
        self.assertEqual(set(install_watch._chosen(["x", "--only", "design_worker", "temp_watch"]).values()),
                         {"design_worker.py", "temp_watch.py"})
        self.assertEqual(len(install_watch._chosen(["x"])), 3)
        with self.assertRaises(SystemExit):
            install_watch._chosen(["x", "--only", "nope"])

    def test_remember_seeds_from_startup_folder(self):
        # ★ 2026-10-21: 목록 파일이 없으면 시작프로그램 폴더의 실제 vbs 를 출발점으로
        import os
        startup = self.appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        startup.mkdir(parents=True)
        (startup / "덴플로우 exocad 지켜보기.vbs").write_text("", encoding="utf-8")
        (startup / "덴플로우 설계 일꾼.vbs").write_text("", encoding="utf-8")
        old_env, old_startup = os.environ.get("APPDATA"), install_watch.STARTUP
        os.environ["APPDATA"] = str(self.appdata)
        install_watch.STARTUP = startup
        try:
            install_watch._remember([], ["덴플로우 설계 일꾼.vbs"])
        finally:
            install_watch.STARTUP = old_startup
            if old_env is None:
                del os.environ["APPDATA"]
            else:
                os.environ["APPDATA"] = old_env
        self.assertEqual(watch_common.expected_scripts(self.appdata), ["exocad_watch"])

    def test_vbs_names_match_installer(self):
        self.assertEqual(set(watch_common.STARTUP_VBS), set(install_watch.WATCHERS))


if __name__ == "__main__":
    unittest.main()
