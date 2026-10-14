# -*- coding: utf-8 -*-
"""스캔 이름 붙이기 — 실제로 올라온 이름들로 (2026-10-14).

    python test_place_name.py

★★ **이 자리는 조용히 틀립니다.** 이름이 겹치면 한 파일이 다른 파일을
  지우는데 화면에는 아무 말도 안 뜹니다. 실제로 삭제 전 스캔이 지대치
  스캔을 덮어썼고, 그러면 exocad 가 **안 깎은 치아 위에** 설계합니다.
  설계가 끝나고 나서야 사람이 압니다. 그래서 시험을 둡니다.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from launcher import place_name, working_jaw  # noqa: E402

F = "2026-10-14_김환자"
ok = bad = 0


def check(teeth, original, want, why):
    global ok, bad
    got = place_name(F, original, working_jaw(teeth))
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f"  X {original}: {got} (바란 것 {want}) — {why}")


# ★★ 사장님이 알려 준 규칙
check([14], "PreparationScan.stl", f"{F}-upperjaw.stl", "지대치(작업치) = 깎은 쪽")
check([14], "AntagonistScan.stl", f"{F}-lowerjaw.stl", "대합치 = 반대쪽")
check([46], "PreparationScan.stl", f"{F}-lowerjaw.stl", "하악이면 뒤집힙니다")
check([46], "AntagonistScan.stl", f"{F}-upperjaw.stl", "하악이면 뒤집힙니다")

# ★★ 이것이 지대치를 덮어쓰던 것
check([14], "PrePreparationScan.stl", f"{F}-upperjaw-situ.stl", "삭제 전은 -situ")
check([46], "PrePreparationScan.stl", f"{F}-lowerjaw-situ.stl", "삭제 전은 -situ")

# 이름에 악이 적혀 있으면 그게 이깁니다
check([14], "UpperJaw_PreOp.stl", f"{F}-upperjaw-situ.stl", "적힌 악 + 삭제 전")
check([46], "LowerJaw.ply", f"{F}-lowerjaw.ply", "적힌 악")

# 스캔바디는 깎은 쪽
check([14], "ScanbodyScan.stl", f"{F}-upperjaw-marker.stl", "스캔바디")

# 모르는 것은 건드리지 않습니다
check([14], "OcclusionScan.stl", "OcclusionScan.stl", "바이트는 그대로")
check([14], "뭔지모를것.stl", "뭔지모를것.stl", "모르면 그대로")
check([14], "메모.pdf", "메모.pdf", "그물이 아니면 그대로")
check([14, 46], "PreparationScan.stl", "PreparationScan.stl", "두 악이면 못 정합니다")

# ★ 셋이 서로 다른 이름이어야 합니다 — 같으면 하나가 사라집니다
names = {
    place_name(F, n, "upper")
    for n in ("PreparationScan.stl", "AntagonistScan.stl", "PrePreparationScan.stl")
}
if len(names) == 3:
    ok += 1
else:
    bad += 1
    print(f"  X 셋이 겹칩니다: {names}")

print(f"통과 {ok} · 실패 {bad}")
raise SystemExit(1 if bad else 0)
