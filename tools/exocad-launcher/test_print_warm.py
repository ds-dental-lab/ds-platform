# -*- coding: utf-8 -*-
"""미리 데우기 — 언제 데우고 언제 끄나 (2026-10-23)"""
import unittest
from pathlib import Path
from unittest import mock

import print_loop as pl


class Worker(pl.PrintWorker):
    """프린터에 실제로 안 보내고 보낸 온도만 적습니다"""

    def __init__(self):
        self.say_log = []
        super().__init__("t", {"printer_kind": "mock"}, Path("."), say=self.say_log.append)
        self.sent = []

    def _bed(self, temp):
        self.sent.append(temp)
        return True


class Warm(unittest.TestCase):
    def setUp(self):
        self.t = 1000.0
        self.clock = mock.patch.object(pl.time, "time", lambda: self.t)
        self.clock.start()
        self.w = Worker()

    def tearDown(self):
        self.clock.stop()

    def tick(self, warm, seconds=10):
        self.w.warm_hint = warm
        self.w.keep_warm()
        self.t += seconds

    def test_warms_bed_only_and_repeats_every_two_minutes(self):
        for _ in range(13):  # 130초
            self.tick(True)
        self.assertEqual(self.w.sent, [pl.WARM_BED, pl.WARM_BED])

    def test_cools_when_work_disappears(self):
        self.tick(True)
        self.tick(False)
        self.assertEqual(self.w.sent, [pl.WARM_BED, 0])
        # 다시 안 식힙니다
        self.tick(False)
        self.assertEqual(self.w.sent, [pl.WARM_BED, 0])

    def test_gives_up_after_15_minutes_and_stays_off(self):
        self.tick(True, seconds=pl.WARM_MAX_SECONDS + 1)
        self.tick(True)
        self.assertEqual(self.w.sent[-1], 0)
        n = len(self.w.sent)
        for _ in range(30):
            self.tick(True, seconds=60)
        self.assertEqual(len(self.w.sent), n)  # 그 일이 끝날 때까지 다시 안 데움
        # 일이 끝나면 다음 일에 다시 데웁니다
        self.tick(False)
        self.tick(True)
        self.assertEqual(self.w.sent[-1], pl.WARM_BED)

    def test_nothing_when_no_hint(self):
        for _ in range(20):
            self.tick(False)
        self.assertEqual(self.w.sent, [])

    def test_mock_printer_never_heats(self):
        w = pl.PrintWorker("t", {"printer_kind": "mock"}, Path("."), say=lambda m: None)
        self.assertFalse(w._bed(55))


if __name__ == "__main__":
    unittest.main()
