# -*- coding: utf-8 -*-
r"""폴더에 떨어진 것 중 **무엇이 크라운인가** (2026-10-14).

    python test_temp_watch.py

★★ **이 자리는 조용히, 크게 틀립니다.** 덴트버드는 크라운 옆에 통짜
  상악·하악 스캔을 같이 내놓습니다. 그런데 치식 정보 파일을 머리글자로
  찾기 때문에 통짜 스캔한테도 치식이 붙습니다 — 거르지 않으면
  **악궁 전체를 잘라 치과에서 출력합니다.**
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from temp_watch import DESIGN_WORDS, is_design  # noqa: E402

ok = bad = 0


def check(name: str, want: bool, why: str) -> None:
    global ok, bad
    got = is_design(Path(name), DESIGN_WORDS)
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f'  X {name}: {got} (바란 것 {want}) — {why}')


# ★ 크라운은 보냅니다
check('2026-08-21_차정순-upperjaw_27-27-crown.stl', True, '덴트버드 크라운')
check('a-36-crown.stl', True, '짧은 이름도')

# ★★ 이것들이 이 시험의 전부입니다 — 하나라도 통과하면 악궁이 출력됩니다
check('2026-08-21_차정순-upperjaw.stl', False, '통짜 상악 스캔')
check('2026-08-21_차정순-lowerjaw.stl', False, '통짜 하악 스캔')
check('PreparationScan.stl', False, '치과가 올린 스캔')
check('AntagonistScan.stl', False, '치과가 올린 스캔')
check('PrePreparationScan.stl', False, '삭제 전 스캔')
check('27-Margin.stl', False, '마진 선')

# ★ 모르는 이름은 안 집습니다. 아무 일도 안 일어나는 쪽이 낫습니다
check('뭔가.stl', False, '모르는 이름')
check('2026-10-13_늘봄최영숙-13-12-11-waxup_cad.stl', False, 'exocad 출력물')

# ★ 브릿지 (2026-10-30 실측 이름) — 'crown' 이 없어도 집어야 합니다
check('8c6f86e2-af12-4e7f-883c-bf3d4e8958bc-upp_26-27-26-27-bridge.stl', True, '덴트버드 브릿지')
check('2026-08-21_차정순-upperjaw_25-27-25-27-bridge.stl', True, '스캔 낱말이 앞에 있어도 브릿지')

print(f'통과 {ok} · 실패 {bad}')
raise SystemExit(1 if bad else 0)
