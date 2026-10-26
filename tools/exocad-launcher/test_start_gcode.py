# -*- coding: utf-8 -*-
"""시작 G코드 손잡이 — 토출 보정·공진 측정·바닥 다지기를 끄는 자리 (2026-10-21)"""
import unittest

import orca_profile as o


class StartGcodeTest(unittest.TestCase):
    def test_leveling_flag_is_flipped_in_place(self):
        m = o.flatten("BBL", o.VERIFIED["machine"])
        g0 = m["machine_start_gcode"]
        self.assertIn(o.LEVELING_OFF[0], g0, "밤부 시작 G코드에 주석 손잡이가 있어야 합니다")
        self.assertTrue(o.skip_leveling(m))
        g1 = m["machine_start_gcode"]
        self.assertIn(o.LEVELING_OFF[1], g1)
        self.assertNotIn(o.LEVELING_OFF[0], g1)
        # 다른 줄은 손대지 않습니다 — 줄 수가 같습니다
        self.assertEqual(g0.count("\n"), g1.count("\n"))
        # 두 번 불러도 더 안 바뀝니다
        self.assertFalse(o.skip_leveling(m))

    def test_flow_cali_flag_same_shape(self):
        m = o.flatten("BBL", o.VERIFIED["machine"])
        self.assertTrue(o.skip_flow_cali(m))
        self.assertIn(o.CALI_OFF[1], m["machine_start_gcode"])

    def test_spread_applies_all_three(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as t:
            prof = o.spread(Path(t), o.pick())
            import json
            g = json.loads(prof.machine.read_text(encoding="utf-8"))["machine_start_gcode"]
            self.assertIn(o.CALI_OFF[1], g)
            self.assertIn(o.LEVELING_OFF[1], g)
            for line in o.VIBRATION_LINES:
                self.assertNotIn(line, g)
            end = json.loads(prof.machine.read_text(encoding="utf-8"))["machine_end_gcode"]
            self.assertNotIn("M1006", g)
            self.assertNotIn("M1006", end)

    def test_music_lines_only(self):
        # ★ 음악 줄만 빠지고 나머지는 그대로 (2026-10-26)
        m = o.flatten("BBL", o.VERIFIED["machine"])
        before = {k: m[k].split("\n") for k in ("machine_start_gcode", "machine_end_gcode")}
        gone = o.skip_music(m)
        self.assertGreater(gone, 0, "밤부 G코드에 음악 줄이 있어야 합니다")
        for k, lines in before.items():
            self.assertEqual(m[k].split("\n"), [x for x in lines if not x.strip().startswith("M1006")])
        self.assertEqual(o.skip_music(m), 0)


if __name__ == "__main__":
    unittest.main()
