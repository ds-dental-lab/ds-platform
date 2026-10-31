# -*- coding: utf-8 -*-
"""probe.py — '지금 버셀에 물을까' 규칙 (2026-10-27)."""
from __future__ import annotations

import unittest

from probe import FORCE_ASK_SECONDS, Gate, decide


class DecideTest(unittest.TestCase):
    def test_db_says_no_then_skip(self):
        self.assertFalse(decide("design", {"design": False, "reslice": True}, last_ask=100, now=110))

    def test_db_says_yes_then_ask(self):
        self.assertTrue(decide("design", {"design": True, "reslice": False}, last_ask=100, now=110))

    def test_kind_is_separate(self):
        got = {"design": False, "reslice": True}
        self.assertFalse(decide("design", got, 100, 110))
        self.assertTrue(decide("reslice", got, 100, 110))

    def test_cannot_probe_then_ask(self):
        # DB 에 못 닿으면 옛길(버셀) 그대로
        self.assertTrue(decide("design", None, last_ask=100, now=110))

    def test_force_ask_after_a_minute(self):
        # DB 가 '없다' 고 해도 1분에 한 번은 묻습니다 — 조건이 어긋나도 1분 안에는 집히게
        self.assertFalse(decide("design", {"design": False}, last_ask=100, now=100 + FORCE_ASK_SECONDS - 1))
        self.assertTrue(decide("design", {"design": False}, last_ask=100, now=100 + FORCE_ASK_SECONDS))

    def test_exocad_kind(self):
        got = {"design": False, "reslice": False, "exocad": True}
        self.assertTrue(decide("exocad", got, 100, 110))
        self.assertFalse(decide("exocad", {**got, "exocad": False}, 100, 110))

    def test_old_db_without_kind_then_ask(self):
        # 마이그레이션 전이면 'exocad' 칸이 없습니다 — 없다고 치면 단추가 1분씩 늦습니다
        self.assertTrue(decide("exocad", {"design": False, "reslice": False}, 100, 110))

    def test_gate_without_secret_asks_every_time(self):
        # probe_secret 이 없으면 이 길을 안 씁니다 (되돌리기 = 설정 한 줄)
        g = Gate("design")
        g.asked(now=1000)
        self.assertTrue(g.should_ask(None, now=1001))


if __name__ == "__main__":
    unittest.main()
