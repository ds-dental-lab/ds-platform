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


if __name__ == "__main__":
    unittest.main()
