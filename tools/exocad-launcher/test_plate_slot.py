# -*- coding: utf-8 -*-
"""출력판 자리 돌리기 — 자리·과잉 압출 선·기록 파일 (2026-10-21)"""
import json
import math
import tempfile
import unittest
from pathlib import Path

import numpy as np

import orca_profile as o
import plate_slot as ps
from orient import drop_to_bed


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


class SlotTest(unittest.TestCase):
    def test_consecutive_slots_are_far_apart(self):
        # 바로 앞 크라운이 남아 있어도 안 겹치게 — 이어지는 둘은 45mm 넘게 (고리로)
        n = len(ps.SLOTS)
        for i in range(n):
            a, b = ps.SLOTS[i], ps.SLOTS[(i + 1) % n]
            self.assertGreaterEqual(_dist(a, b), 45.0, f"{a} → {b}")

    def test_recent_three_are_apart(self):
        # 두세 번 안 비워도 — 최근 세 자리끼리 30mm 넘게
        n = len(ps.SLOTS)
        for i in range(n):
            for j in (1, 2, 3):
                a, b = ps.SLOTS[i], ps.SLOTS[(i + j) % n]
                self.assertGreaterEqual(_dist(a, b), 30.0, f"{i}+{j}: {a} → {b}")

    def test_every_cell_once(self):
        # 판 전체를 고르게 — 5열×4행 칸을 한 번씩, 빠짐·겹침 없이 (2026-10-23)
        cells = {(x, y) for x in ps.COLS for y in ps.ROWS}
        self.assertEqual(len(ps.SLOTS), 20)
        self.assertEqual(set(ps.SLOTS), cells)

    def test_slots_stay_inside_plate_margins(self):
        # 앞쪽(Y<10 과잉 압출 선)·뒤쪽(Y>170 노즐 닦기)·양옆 — 크라운 반 폭 ≈7mm + 여유
        for x, y in ps.SLOTS:
            self.assertTrue(20 <= x <= 160 and 30 <= y <= 150, (x, y))

    def test_purge_shift_keeps_line_on_plate(self):
        # 원래 선 X68→115. 옮겨도 판(0~180) 안
        for dx in ps.PURGE_SHIFTS:
            self.assertGreaterEqual(68 + dx, 0)
            self.assertLessEqual(115 + dx, 180)

    def test_take_rotates_and_persists(self):
        with tempfile.TemporaryDirectory() as t:
            state = Path(t) / "slot.json"
            seen = [ps.take(state) for _ in range(ps.CYCLE + 1)]
            self.assertEqual([s.index for s in seen[: len(ps.SLOTS)]], list(range(len(ps.SLOTS))))
            # 한 바퀴 돌면 처음으로
            self.assertEqual(seen[ps.CYCLE].index, seen[0].index)
            self.assertEqual(seen[ps.CYCLE].purge, seen[0].purge)
            self.assertEqual(json.loads(state.read_text(encoding="utf-8"))["next"], 1)

    def test_broken_state_starts_over(self):
        with tempfile.TemporaryDirectory() as t:
            state = Path(t) / "slot.json"
            state.write_text("{{{", encoding="utf-8")
            self.assertEqual(ps.take(state).index, 0)
            self.assertEqual(ps.take(state).index, 1)

    def test_label_names_the_spot(self):
        self.assertEqual(ps.slot_at(0).label, "자리 1/20 (앞에서 1줄 · 왼쪽에서 2칸)")
        self.assertEqual(ps.slot_at(1).label, "자리 2/20 (앞에서 4줄 · 왼쪽에서 5칸)")


class PlacementTest(unittest.TestCase):
    def test_drop_to_bed_at_moves_center(self):
        cube = np.array([[[0, 0, -1], [2, 0, -1], [0, 2, 1]]], dtype=np.float64)
        moved = drop_to_bed(cube, bed=(180, 180), at=(55.0, 110.0))
        pts = moved.reshape(-1, 3)
        lo, hi = pts.min(axis=0), pts.max(axis=0)
        self.assertAlmostEqual((lo[0] + hi[0]) / 2, 55.0)
        self.assertAlmostEqual((lo[1] + hi[1]) / 2, 110.0)
        self.assertAlmostEqual(lo[2], 0.0)

    def test_drop_to_bed_without_at_centers(self):
        cube = np.array([[[0, 0, 0], [2, 0, 0], [0, 2, 1]]], dtype=np.float64)
        pts = drop_to_bed(cube, bed=(180, 180)).reshape(-1, 3)
        self.assertAlmostEqual((pts[:, 0].min() + pts[:, 0].max()) / 2, 90.0)


class PurgeLineTest(unittest.TestCase):
    def test_shift_moves_only_purge_lines(self):
        m = o.flatten("BBL", o.VERIFIED["machine"])
        g0 = m["machine_start_gcode"]
        n = o.shift_purge_line(m, -45.0)
        g1 = m["machine_start_gcode"]
        self.assertGreater(n, 0)
        self.assertEqual(g0.count("\n"), g1.count("\n"))
        changed = [b for a, b in zip(g0.split("\n"), g1.split("\n")) if a != b]
        self.assertEqual(len(changed), n)
        for line in changed:
            self.assertTrue(line.strip().startswith("G0 X"), line)
        # 늘 긋는 선의 시작점이 왼쪽으로
        self.assertIn("G0 X23 Y-2.5", g1)
        self.assertNotIn("G0 X68 Y-2.5", g1)
        # 노즐 닦기(뒤쪽)·똥 통(X-13.5) 은 그대로
        self.assertIn("G1 X-13.5 Y0 Z10", g1)
        self.assertEqual(g0.count("Y185"), g1.count("Y185"))

    def _always_section(self, g: str) -> list[str]:
        lines = g.split("\n")
        a = next(i for i, x in enumerate(lines) if x.strip().startswith(";===== extrude cali test"))
        b = next(i for i, x in enumerate(lines) if i > a and x.strip().startswith(";========turn off light"))
        return [x.strip() for x in lines[a:b] if x.strip().startswith("G0 ")]

    def test_vertical_course_draws_along_y(self):
        # 왼쪽 가장자리 세로 — X 는 4 에 고정, Y 가 45 에서 47mm (2026-10-23)
        m = o.flatten("BBL", o.VERIFIED["machine"])
        g0 = m["machine_start_gcode"]
        n = o.move_purge_line(m, 4.0, 45.0, vertical=True)
        g1 = m["machine_start_gcode"]
        self.assertGreater(n, 0)
        self.assertEqual(g0.count("\n"), g1.count("\n"))
        sec = self._always_section(g1)
        self.assertIn("G0 X4 Y45 F30000", sec)
        ys = [float(s.split(" Y")[1].split()[0]) for s in sec if " Y" in s]
        self.assertAlmostEqual(min(ys), 45.0)
        self.assertAlmostEqual(max(ys), 45.0 + o.PURGE_LENGTH)
        # 이 구간에 X 로 긋는 줄이 남지 않습니다 (시작점 말고)
        self.assertEqual([s for s in sec if s.startswith("G0 X") and not s.startswith("G0 X4 ")], [])
        # 압출량·속도 꼬리는 그대로
        self.assertIn("E10", g1)
        # 노즐 닦기(뒤쪽)·똥 통 은 그대로
        self.assertIn("G1 X-13.5 Y0 Z10", g1)
        self.assertEqual(g0.count("Y185"), g1.count("Y185"))

    def test_second_row_moves_y_too(self):
        m = o.flatten("BBL", o.VERIFIED["machine"])
        o.move_purge_line(m, 23.0, 4.0)
        sec = self._always_section(m["machine_start_gcode"])
        self.assertIn("G0 X23 Y4 F30000", sec)

    def test_courses_avoid_crown_slots(self):
        # 압출선(길이 47, 폭 넉넉히 4mm)이 크라운 자리(±10mm)에 안 걸립니다
        for x0, y0, vertical in ps.PURGE_COURSES:
            if vertical:
                box = (x0 - 2, y0, x0 + 2, y0 + o.PURGE_LENGTH)
            else:
                box = (x0, y0 - 2, x0 + o.PURGE_LENGTH, y0 + 2)
            # 앞쪽 끝 Y-2.5 는 원래 선 자리 — 판 앞 테두리까지 씁니다
            self.assertTrue(-3 <= box[0] and box[2] <= 180 and -5 <= box[1] and box[3] <= 170, (x0, y0))
            for sx, sy in ps.SLOTS:
                near = box[0] - 10 < sx < box[2] + 10 and box[1] - 10 < sy < box[3] + 10
                self.assertFalse(near, f"코스 {(x0, y0, vertical)} ↔ 자리 {(sx, sy)}")

    def test_courses_do_not_overlap_each_other(self):
        boxes = []
        for x0, y0, vertical in ps.PURGE_COURSES:
            boxes.append((x0 - 2, y0, x0 + 2, y0 + o.PURGE_LENGTH) if vertical else (x0, y0 - 2, x0 + o.PURGE_LENGTH, y0 + 2))
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                overlap = a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]
                self.assertFalse(overlap, (ps.PURGE_COURSES[i], ps.PURGE_COURSES[j]))

    def test_zero_shift_is_noop(self):
        m = o.flatten("BBL", o.VERIFIED["machine"])
        g0 = m["machine_start_gcode"]
        self.assertEqual(o.shift_purge_line(m, 0.0), 0)
        self.assertEqual(m["machine_start_gcode"], g0)


if __name__ == "__main__":
    unittest.main()
