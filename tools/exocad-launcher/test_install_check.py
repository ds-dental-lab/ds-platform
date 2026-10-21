# -*- coding: utf-8 -*-
"""설치 점검 — 판단 함수와 한 번에 돌리기 (2026-10-21)"""
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import install_check as ic


class ParseTest(unittest.TestCase):
    def test_sleep_minutes_korean_and_english(self):
        ko = "    현재 AC 전원 설정 인덱스: 0x00000708\n    현재 DC 전원 설정 인덱스: 0x0000012c"
        self.assertEqual(ic.parse_sleep_minutes(ko), 30)
        en = "Current AC Power Setting Index: 0x00000000\nCurrent DC Power Setting Index: 0x0000012c"
        self.assertEqual(ic.parse_sleep_minutes(en), 0)
        self.assertIsNone(ic.parse_sleep_minutes("아무것도 없음"))

    def test_antivirus_defender_only_is_fine(self):
        self.assertTrue(ic.judge_antivirus(["Windows Defender"]).ok)
        self.assertTrue(ic.judge_antivirus(["Microsoft Defender Antivirus", ""]).ok)

    def test_antivirus_other_needs_whitelist(self):
        it = ic.judge_antivirus(["Windows Defender", "AhnLab V3 Lite"])
        self.assertFalse(it.ok)
        self.assertIn("V3", it.detail)
        self.assertIn("예외", it.fix)

    def test_antivirus_unknown_is_info(self):
        self.assertIsNone(ic.judge_antivirus([]).ok)

    def test_clock_skew(self):
        now = datetime.now(timezone.utc)
        self.assertTrue(ic.judge_clock(now, now - timedelta(seconds=30)).ok)
        bad = ic.judge_clock(now, now - timedelta(minutes=10))
        self.assertFalse(bad.ok)
        self.assertIn("10분", bad.detail)
        self.assertIsNone(ic.judge_clock(now, None).ok)


class SingleChecks(unittest.TestCase):
    def test_link(self):
        self.assertFalse(ic.check_link({}).ok)
        self.assertTrue(ic.check_link({"token": "t", "clinic": "치ㅣ"}).ok)

    def test_folder_missing_and_present(self):
        self.assertFalse(ic.check_folder({}).ok)
        self.assertFalse(ic.check_folder({"folder": r"C:\no\such\folder"}).ok)
        with tempfile.TemporaryDirectory() as t:
            (Path(t) / "a.stl").write_bytes(b"x")
            it = ic.check_folder({"folder": t})
            self.assertTrue(it.ok)
            self.assertIn("1개", it.detail)

    def test_settings_dir_writable(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertTrue(ic.check_settings_dir(Path(t) / "sub").ok)

    def test_sleep_uses_runner(self):
        self.assertTrue(ic.check_sleep(lambda _c: "현재 AC 전원 설정 인덱스: 0x00000000").ok)
        it = ic.check_sleep(lambda _c: "현재 AC 전원 설정 인덱스: 0x00000384")
        self.assertFalse(it.ok)
        self.assertIn("15분", it.detail)

    def test_printer_off_is_info(self):
        items = ic.check_printer({"printer_kind": "mock"})
        self.assertIsNone(items[0].ok)

    def test_printer_missing_code(self):
        items = ic.check_printer({"printer_kind": "bambu", "printer_serial": "X"})
        self.assertFalse(items[0].ok)

    def test_printer_no_broadcast_no_sweep_hit(self):
        with mock.patch("printer_find.discover", return_value=[]),              mock.patch("printer_sweep.sweep", return_value=None):
            items = ic.check_printer({"printer_kind": "bambu", "printer_serial": "S", "printer_code": "C"}, seconds=0.1)
        self.assertFalse(items[0].ok)
        self.assertIn("훑어도 없습니다", items[0].detail)
        self.assertEqual(items[-1].name, "프린터 포트")

    def test_printer_no_broadcast_but_sweep_finds(self):
        # 방송은 막혔는데 훑어서 찾음 → 주소로 이어서 봄 (포트 검사는 닫힌 주소라 실패로 끝남)
        with mock.patch("printer_find.discover", return_value=[]),              mock.patch("printer_sweep.sweep", return_value="10.9.9.9"),              mock.patch.object(ic, "_port_open", return_value=False):
            items = ic.check_printer({"printer_kind": "bambu", "printer_serial": "S", "printer_code": "C"}, seconds=0.1)
        self.assertIn("10.9.9.9", items[0].detail)
        self.assertIn("방화벽", items[0].fix)
        self.assertEqual(items[1].name, "프린터 포트 8883·990")


class RunAllTest(unittest.TestCase):
    def test_run_all_keeps_going_when_a_check_breaks(self):
        said = []
        with mock.patch.object(ic, "check_site", return_value=(ic.Item("인터넷 → 덴플로우", True, "ok"), None)), \
             mock.patch.object(ic, "check_storage", return_value=ic.Item("인터넷 → 파일 저장소", True, "ok")), \
             mock.patch.object(ic, "check_sleep", return_value=ic.Item("절전", True, "ok")), \
             mock.patch.object(ic, "check_antivirus", return_value=ic.Item("백신", True, "ok")), \
             mock.patch.object(ic, "check_printer", side_effect=RuntimeError("boom")), \
             tempfile.TemporaryDirectory() as t:
            rep = ic.run_all(
                {"token": "t", "folder": t}, site="https://x", storage_url="https://y",
                settings_dir=Path(t), autostart=False, say=said.append,
            )
        names = [i.name for i in rep.items]
        self.assertIn("프린터", names)
        self.assertIsNone(rep.items[-1].ok)
        self.assertFalse(rep.ok)  # 자동 시작 꺼짐
        self.assertEqual([i.name for i in rep.bad], ["자동 시작"])
        self.assertTrue(any(line.startswith("[X] 자동 시작") for line in said))
        text = rep.text()
        self.assertIn("빠진 것 1", text)
        self.assertIn("→", text)


if __name__ == "__main__":
    unittest.main()
