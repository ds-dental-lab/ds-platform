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


class RuleSweepTest(unittest.TestCase):
    """docs/bridge_rules.md 의 고르기 — 오늘 실측 숫자 그대로 (2026-11-03)"""

    def test_plan_cases(self):
        from dentbird_params import rule_plan
        # 상악 25-27 폰틱 26, 24·28? 24 만 화면에 있음
        self.assertEqual(rule_plan([25, 26, 27], [21, 22, 23, 24, 25, 26, 27]), ([25], [26, 27]))  # 28 없음 → 27 은 안쪽
        # 하악 34-35 양쪽 자연치
        self.assertEqual(rule_plan([34, 35], [33, 34, 35, 36]), ([34, 35], []))
        # 상악 16-17, 15 있고 18 없음
        self.assertEqual(rule_plan([16, 17], [15, 16, 17]), ([16], [17]))

    def test_25_27_peak_at_010(self):
        from dentbird_params import sweep_best, sweep_should_stop
        h = [(-0.05, {"25-26": 1.2, "26-27": 1.8})]
        self.assertFalse(sweep_should_stop(h))
        h.append((-0.10, {"25-26": 1.7, "26-27": 3.2}))
        self.assertFalse(sweep_should_stop(h))
        h.append((-0.20, {"25-26": 0.9, "26-27": 2.0}))
        self.assertTrue(sweep_should_stop(h))
        self.assertEqual(sweep_best(h), -0.10)

    def test_16_17_locks(self):
        from dentbird_params import sweep_best, sweep_should_stop
        h = [(-0.05, {"17-16": 0.3}), (-0.10, {"17-16": None})]
        self.assertTrue(sweep_should_stop(h))
        self.assertEqual(sweep_best(h), -0.05)

    def test_locked_at_start_keeps_going(self):
        # 2026-11-04 R08 하악 35-37 36 폰틱 — 처음엔 안 닿아 잠김, 더 겹치면 열린다고 보고 계속
        from dentbird_params import sweep_best, sweep_should_stop
        h = [(-0.05, {"37-36": None, "36-35": None})]
        self.assertFalse(sweep_should_stop(h))
        h.append((-0.10, {"37-36": 1.1, "36-35": None}))
        self.assertFalse(sweep_should_stop(h))
        h.append((-0.15, {"37-36": 2.0, "36-35": 1.4}))
        self.assertFalse(sweep_should_stop(h))
        h.append((-0.20, {"37-36": 2.6, "36-35": 1.1}))
        self.assertFalse(sweep_should_stop(h))
        h.append((-0.25, {"37-36": 2.0, "36-35": 0.9}))
        self.assertTrue(sweep_should_stop(h))
        self.assertEqual(sweep_best(h), -0.20)

    def test_both_natural_reach_constants(self):
        # 2026-11-04 R10 상악 15-16: -0.10 에서 + 0.0 → 더 겹쳐 + 를 열어야 함. R11(같은 유형)은 -0.10 에서 3.9 로 충분
        from dentbird_params import RULE_BOTH, RULE_BOTH_REACH, RULE_PLUS_MIN_AREA, sweep_best, sweep_should_stop
        self.assertEqual(RULE_BOTH_REACH[0], -0.15)
        self.assertLess(RULE_BOTH_REACH[-1], RULE_BOTH)
        h = [(RULE_BOTH, {"16-15": 0.0}), (-0.15, {"16-15": 1.1}), (-0.20, {"16-15": 2.4})]
        self.assertFalse(sweep_should_stop(h))
        self.assertGreaterEqual(2.4, RULE_PLUS_MIN_AREA)
        self.assertEqual(sweep_best(h), -0.20)

    def test_stretch_handle_and_junction(self):
        # 2026-11-05 이동 및 변형 — R40 화면 그대로: 상자 693-893, 46 이 오른쪽
        from dentbird_params import _junction_area, pick_handle
        circles = [(693, 516), (793, 416), (793, 616), (893, 516)]
        self.assertEqual(pick_handle(circles, (1.0, 0.0)), (893, 516))
        self.assertEqual(pick_handle(circles, (-0.9, 0.1)), (693, 516))
        self.assertEqual(_junction_area({"46-47": 0.3}, 47, 46), ("46-47", 0.3))
        self.assertEqual(_junction_area({"37-36": 0.4, "34-33": 0.1}, 33, 34), ("34-33", 0.1))

    def test_no_shadowed_functions(self):
        # 2026-11-06: 새 _settle 이 원래 _settle 을 덮어 인접 거리 조정이 깨졌음 — 이름이 겹치면 실패
        import ast, collections
        for name in ("dentbird_params.py", "batch_review.py", "dentbird_macro.py"):
            src = (Path(__file__).resolve().parent / name).read_text(encoding="utf-8")
            defs = [n.name for n in ast.parse(src).body if isinstance(n, ast.FunctionDef)]
            self.assertEqual([k for k, v in collections.Counter(defs).items() if v > 1], [], name)

    def test_all_locked_falls_back(self):
        from dentbird_params import sweep_best
        self.assertEqual(sweep_best([(-0.05, {"a": None})]), -0.05)

    def test_choice(self):
        from dentbird_params import junction_choice
        self.assertEqual(junction_choice(3.2), "+")
        self.assertEqual(junction_choice(0.3), "+")   # 2026-11-05: 0.2~0.4 도 + (원형 7곳 모두 비정상)
        self.assertEqual(junction_choice(0.0), "원형")  # 안 닿음
        self.assertEqual(junction_choice(None), "원형")



class SliderStepsTest(unittest.TestCase):
    def test_steps(self):
        from dentbird_params import slider_steps
        self.assertEqual(slider_steps(5.0, 8.0), 30)
        self.assertEqual(slider_steps(10.0, 8.0), -20)
        self.assertEqual(slider_steps(8.0, 8.0), 0)
        self.assertEqual(slider_steps(7.96, 8.0), 0)


class ConnectorAreaTest(unittest.TestCase):
    def test_area(self):
        from dentbird_params import connector_area
        self.assertEqual(connector_area("약함 0.1mm²"), 0.1)
        self.assertEqual(connector_area("최적 12.5mm²"), 12.5)
        self.assertEqual(connector_area("크기 초과 29.0mm²"), 29.0)
        self.assertIsNone(connector_area(""))

    def test_across(self):
        from dentbird_params import CONNECTOR, connector_across
        self.assertEqual(connector_across({}), CONNECTOR["횡단"])
        self.assertEqual(connector_across({"26": {"폭": 12.2, "교두": 6.4}, "27": {"폭": 12.3, "교두": 6.9}}), 7.9)
        self.assertEqual(connector_across({"26": {"폭": 10.4, "교두": 5.7}, "27": {"폭": 10.6, "교두": 5.9}}), 7.2)
        self.assertEqual(connector_across({"26": {"폭": 12.2, "교두": 0.0}}), 7.6)  # 교두 못 찾으면 폭 x 0.62
        self.assertEqual(connector_across({"26": {"폭": 5.0, "교두": 2.0}}), 5.0)
        self.assertEqual(connector_across({"43": {"폭": 8.0, "교두": 0.7}, "44": {"폭": 9.7, "교두": 1.0}}), 5.0)  # 봉우리 하나 → 폭
        self.assertEqual(connector_across({"26": {"폭": 30.0, "교두": 20.0}}), 10.0)

    def test_tall(self):
        from dentbird_params import CONNECTOR, connector_tall
        self.assertEqual(connector_tall({}), CONNECTOR["수직"])
        self.assertEqual(connector_tall({"26": {"높이": 6.4}, "27": {"높이": 5.6}}), 2.8)
        self.assertEqual(connector_tall({"26": {"높이": 8.2}, "27": {"높이": 8.5}}), 4.1)


class ProximalPlanTest(unittest.TestCase):
    def test_neighbors(self):
        from dentbird_params import fdi_neighbors
        self.assertEqual(fdi_neighbors(26), [25, 27])
        self.assertEqual(fdi_neighbors(11), [21, 12])
        self.assertEqual(fdi_neighbors(31), [41, 32])
        self.assertEqual(fdi_neighbors(28), [27])

    def test_single_contact(self):
        from dentbird_params import PROXIMAL_INNER, PROXIMAL_NATURAL, proximal_plan
        # 26-27, 25 는 있고 28 은 없음 → 26 먼저 -0.02, 27 마지막 -0.5
        self.assertEqual(proximal_plan([26, 27], [], [11, 21, 22, 23, 24, 25, 26, 27]),
                         [(26, PROXIMAL_NATURAL), (27, PROXIMAL_INNER)])

    def test_both_contact_two_units(self):
        from dentbird_params import PROXIMAL_BOTH, proximal_plan
        self.assertEqual(proximal_plan([26, 27], [], [25, 26, 27, 28]), [(26, PROXIMAL_BOTH), (27, PROXIMAL_BOTH)])

    def test_both_contact_with_pontic(self):
        from dentbird_params import PROXIMAL_INNER, PROXIMAL_NATURAL, proximal_plan
        # 25-27 폰틱 26, 24·28 자연치 → 25·27 먼저, 폰틱 26 마지막
        self.assertEqual(proximal_plan([25, 27], [26], [24, 25, 26, 27, 28]),
                         [(25, PROXIMAL_NATURAL), (27, PROXIMAL_NATURAL), (26, PROXIMAL_INNER)])

    def test_no_natural(self):
        from dentbird_params import PROXIMAL_INNER, proximal_plan
        self.assertEqual(proximal_plan([26, 27], [], [26, 27]), [(26, PROXIMAL_INNER), (27, PROXIMAL_INNER)])


if __name__ == "__main__":
    unittest.main()
