# -*- coding: utf-8 -*-
"""출력 담당의 단계 보고 — 끊겨도 잃지 않기 (2026-10-16 점검)"""

import unittest
from pathlib import Path
from unittest import mock

import print_loop


class Report(unittest.TestCase):
    def worker(self):
        with mock.patch.object(print_loop, "build_printer", return_value=object()):
            return print_loop.PrintWorker("t", {}, Path("."), say=lambda m: None)

    def test_step_report_kept_when_offline_then_sent(self):
        w = self.worker()
        offline = {"ok": False, "error": "서버에 닿지 못했습니다 — x"}
        with mock.patch.object(print_loop, "_post", return_value=offline), mock.patch.object(print_loop.time, "sleep"):
            w.report("job", step="done")
        self.assertEqual(len(w.pending), 1)
        with mock.patch.object(print_loop, "_post", return_value={"ok": True}) as p:
            w.flush()
        self.assertEqual(w.pending, [])
        self.assertEqual(p.call_args[0][1]["step"], "done")

    def test_db_hiccup_is_retried_not_dropped(self):
        w = self.worker()
        sick = {"ok": False, "error": "JWT expired"}
        with mock.patch.object(print_loop, "_post", return_value=sick), mock.patch.object(print_loop.time, "sleep"):
            w.report("job", step="printing", percent=0)
        self.assertEqual(len(w.pending), 1)

    def test_rejection_is_not_kept(self):
        w = self.worker()
        no = {"ok": False, "error": "printing 에서 queued 로는 갈 수 없습니다"}
        with mock.patch.object(print_loop, "_post", return_value=no):
            w.report("job", step="done")
        self.assertEqual(w.pending, [])

    def test_percent_is_not_kept(self):
        w = self.worker()
        with mock.patch.object(print_loop, "_post", return_value={"ok": False, "error": "서버에 닿지 못했습니다"}):
            w.report("job", percent=40)
        self.assertEqual(w.pending, [])

    def test_flush_keeps_order_and_stops_when_still_offline(self):
        w = self.worker()
        w.pending = [("job", {"step": "printing"}), ("job", {"step": "done"})]
        with mock.patch.object(print_loop, "_post", return_value={"ok": False, "error": "서버에 닿지 못했습니다"}):
            w.flush()
        self.assertEqual([b["step"] for _, b in w.pending], ["printing", "done"])



class RefreshPrinterTest(unittest.TestCase):
    """2026-11-05 새 프린터 — 칸을 바꾸면 껐다 켜지 않아도 새 프린터로 붙음"""

    def test_rebuilds_when_settings_change(self):
        cfg = {"printer_kind": "bambu", "printer_serial": "OLD", "printer_code": "1111", "printer_last_ip": "10.0.0.5"}
        w = print_loop.PrintWorker("t", cfg, Path("."), say=lambda m: None)
        first = w.printer
        w.refresh_printer()
        self.assertIs(w.printer, first)  # 그대로면 안 만듦
        cfg["printer_serial"] = "NEW"
        cfg["printer_code"] = "2222"
        w.refresh_printer()
        self.assertIsNot(w.printer, first)
        self.assertEqual((w.printer.serial, w.printer.access_code), ("NEW", "2222"))

    def test_rebuilds_when_found_new_address(self):
        cfg = {"printer_kind": "bambu", "printer_serial": "S", "printer_code": "1", "printer_last_ip": "192.168.0.183"}
        w = print_loop.PrintWorker("t", cfg, Path("."), say=lambda m: None)
        cfg["printer_last_ip"] = "192.168.0.123"  # 「프린터 찾기」 가 새 주소를 적음
        w.refresh_printer()
        self.assertEqual(w.printer.host, "192.168.0.123")


class StatusRefindTest(unittest.TestCase):
    """적어 둔 주소에 안 닿으면 새로 찾아 붙음 (2026-11-05)"""

    def test_refinds_on_timeout(self):
        import printer_send
        p = printer_send.BambuPrinter(access_code="c", serial="S", host="192.168.0.183")
        tried = []

        class Fake:
            def __init__(self): self.on_message = None
            def connect(self, host, *_a, **_k):
                tried.append(host)
                if host == "192.168.0.183":
                    raise TimeoutError("timed out")
            def loop_start(self): pass
            def loop_stop(self): pass
            def disconnect(self): pass

        p._mqtt = lambda: Fake()
        p._refind = lambda: "192.168.0.123"
        p.status(0)
        self.assertEqual(tried, ["192.168.0.183", "192.168.0.123"])
        self.assertEqual(p.host, "192.168.0.123")



class ClaimGateTest(unittest.TestCase):
    """DB 먼저 묻기 (2026-11-05) — '없다' 면 버셀에 안 가고, 1분마다 한 번은 감, DB 가 말 없으면 감"""

    def _w(self):
        return print_loop.PrintWorker("t" * 20, {}, Path("."), say=lambda m: None)

    def test_first_time_always_asks(self):
        self.assertTrue(self._w().should_claim(now=1000.0, probe=lambda t: {"print": False, "warm": False}))

    def test_db_says_nothing(self):
        w = self._w()
        w.last_ask = 1000.0
        self.assertFalse(w.should_claim(now=1010.0, probe=lambda t: {"print": False, "warm": True}))
        self.assertTrue(w.warm_hint)  # 데우기 신호는 DB 답에서

    def test_db_says_something(self):
        w = self._w()
        w.last_ask = 1000.0
        self.assertTrue(w.should_claim(now=1010.0, probe=lambda t: {"print": True, "warm": False}))

    def test_db_silent_falls_back(self):
        w = self._w()
        w.last_ask = 1000.0
        self.assertTrue(w.should_claim(now=1010.0, probe=lambda t: None))

    def test_safety_net(self):
        w = self._w()
        w.last_ask = 1000.0
        self.assertTrue(w.should_claim(now=1000.0 + print_loop.CLAIM_FORCE_SECONDS, probe=lambda t: {"print": False}))

    def test_tick_skips_vercel(self):
        w = self._w()
        w.last_ask = time_now = __import__("time").time()
        w.should_claim = lambda: False
        w.claim = lambda: self.fail("버셀에 물으면 안 됨")
        w.keep_warm = lambda: None
        self.assertFalse(w.tick())


if __name__ == "__main__":
    unittest.main()
