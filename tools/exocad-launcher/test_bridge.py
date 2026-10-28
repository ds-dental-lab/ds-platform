# -*- coding: utf-8 -*-
"""브릿지 가지의 순수 규칙 (2026-10-28) — 화면 없이 도는 것만.

    python test_bridge.py
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dentbird_macro import bridge_span, generation_done  # noqa: E402


class SpanTest(unittest.TestCase):
    def test_span_is_min_max(self):
        self.assertEqual(bridge_span([26, 27]), "26-27")
        self.assertEqual(bridge_span([27, 25, 26]), "25-27")

    def test_span_across_midline(self):
        # 덴트버드는 작은 번호-큰 번호로 부릅니다 (11·21 이면 '11-21')
        self.assertEqual(bridge_span([21, 11]), "11-21")


class GenerationDoneTest(unittest.TestCase):
    def test_single_done(self):
        self.assertTrue(generation_done("상태 크라운 26 생성됨 생성", 1))

    def test_two_units_one_done_still_busy(self):
        # ★ 실측 2026-10-28 — 둘 다 '생성됨' 이 적힌 채 '생성 중... 95%' 가 돌고 있었습니다
        self.assertFalse(generation_done("크라운 26 생성됨 크라운 27 생성됨 생성 중... 95%", 2))
        self.assertFalse(generation_done("크라운 26 생성됨 크라운 27 감지됨 디자인 준비 중... 0%", 2))

    def test_two_units_done(self):
        self.assertTrue(generation_done("브릿지 26-27 브릿지 준비됨 미조립 크라운 26 생성됨 크라운 27 생성됨 생성", 2))

    def test_three_units_needs_three(self):
        self.assertFalse(generation_done("폰틱 25 생성됨 크라운 26 생성됨 크라운 27 감지됨", 3))
        self.assertTrue(generation_done("폰틱 25 생성됨 크라운 26 생성됨 크라운 27 생성됨", 3))

    def test_complete_word_wins(self):
        self.assertTrue(generation_done("AI 디자인 생성 완료", 3))


if __name__ == "__main__":
    unittest.main()
