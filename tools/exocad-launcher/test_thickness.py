# -*- coding: utf-8 -*-
"""두께 재기 (2026-10-28) — 속이 빈 상자로 답을 아는 경우."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from thickness import Thickness, measure  # noqa: E402


def box(size: float, inward: bool) -> np.ndarray:
    """정육면체 12면. inward=True 면 법선이 안쪽(속 빈 상자의 안쪽 껍질)"""
    s = size / 2
    v = np.array([[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
                  [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]], dtype=np.float64)
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4),
         (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
    tris = v[np.array(f)]
    if inward:
        tris = tris[:, ::-1]
    return tris


class HollowBoxTest(unittest.TestCase):
    def test_wall_is_known(self):
        # 바깥 10mm, 안 8.4mm → 벽 0.8mm
        tris = np.vstack([box(10.0, False), box(8.4, True)])
        th = measure(tris, samples=24)
        self.assertAlmostEqual(th.minimum, 0.8, places=3)
        self.assertAlmostEqual(th.median, 0.8, places=3)
        self.assertEqual(th.below[0.6], 0.0)
        self.assertEqual(th.below[0.8], 0.0)
        self.assertFalse(th.risky())

    def test_thin_wall_is_risky(self):
        # 벽 0.3mm — 선폭 아래
        tris = np.vstack([box(10.0, False), box(9.4, True)])
        th = measure(tris, samples=24)
        self.assertAlmostEqual(th.minimum, 0.3, places=3)
        self.assertEqual(th.below[0.45], 1.0)
        self.assertTrue(th.risky())
        self.assertIn("구멍", th.describe())

    def test_solid_box_thickness_is_full_size(self):
        th = measure(box(10.0, False), samples=12)
        self.assertAlmostEqual(th.minimum, 10.0, places=3)

    def test_empty(self):
        th = measure(np.zeros((0, 3, 3)))
        self.assertEqual(th.samples, 0)
        self.assertFalse(th.risky())

    def test_describe_lists_thresholds(self):
        t = Thickness(100, 0.5, 1.2, {0.45: 0.0, 0.6: 0.03, 0.8: 0.2}, 0.0)
        s = t.describe()
        self.assertIn("0.60 미만 3.0%", s)
        self.assertNotIn("구멍", s)


if __name__ == "__main__":
    unittest.main()
