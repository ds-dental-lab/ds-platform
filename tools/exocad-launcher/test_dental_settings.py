# -*- coding: utf-8 -*-
"""
임시치아 자르기 **확정값** (사용자 2026-10-23 "이 값으로 저장해 줘").

★ 인증 필라멘트로 여러 번 뽑아 손으로 떼어 보고 정한 값입니다. 다른 일을 하다
  모르고 바뀌면 출력물이 달라지는데, 자른 결과만 보고는 알기 어렵습니다.
  바꿀 때는 이 시험도 **일부러** 같이 고치세요 — 그게 이 시험의 목적입니다.
"""
import unittest

import orca_profile as o

#: 2026-10-23 확정 — 위 간격은 층(0.16) 단위로 반올림돼 0.32 가 실제 값입니다
CONFIRMED = {
    "layer_height": "0.16",
    "support_top_z_distance": "0.32",
    "support_object_xy_distance": "0.35",
    "support_interface_spacing": "0.15",
    "support_interface_top_layers": "3",
    "support_base_pattern_spacing": "2",
    "support_threshold_angle": "60",
    "support_on_build_plate_only": "1",
    "raft_layers": "2",
    "raft_contact_distance": "0",
    "raft_first_layer_density": "100%",
    "raft_first_layer_expansion": "1.5",
    "skirt_loops": "0",
}


class ConfirmedSettings(unittest.TestCase):
    def test_values_are_the_confirmed_ones(self):
        for key, want in CONFIRMED.items():
            self.assertEqual(o.DENTAL.get(key), want, f"{key} 가 확정값({want})과 다릅니다")

    def test_orca_accepts_every_key(self):
        # 오르카가 모르는 칸이면 조용히 버려집니다 — 펼쳐 넣어 보며 확인
        data = o.flatten("BBL", o.VERIFIED["process"])
        missed = o.apply(data, {k: o.DENTAL[k] for k in CONFIRMED})
        self.assertEqual(missed, [])


if __name__ == "__main__":
    unittest.main()
