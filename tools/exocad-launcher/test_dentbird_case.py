# -*- coding: utf-8 -*-
r"""크라운의 치식을 **어디서** 읽는가 (2026-10-15).

    python test_dentbird_case.py

★★★ 실제로 났던 일: 윤기두 16번 크라운이 정보 파일 없이 혼자 내보내졌는데,
  짝을 찾는 함수가 **아무 정보 파일이나** 집어 **다른 환자의 37번**으로
  읽었습니다. 37번 주문이 기다리고 있었다면 16번 크라운이 엉뚱한 환자
  자리로 출력됐습니다. 짝이 아니면 **아무것도 안 집어야** 합니다.
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dentbird_case import beside, fdi_range, teeth_from_name  # noqa: E402

ok = bad = 0


def eq(got, want, why):
    global ok, bad
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f"  X {why}: {got!r} (바란 것 {want!r})")


with tempfile.TemporaryDirectory() as tmp:
    d = Path(tmp)
    for n in ("2026-08-21_차정순-upperjaw_27.constructionInfo",
              "_00007-007-김선도.constructionInfo",
              "x_2.constructionInfo"):
        (d / n).write_text("", encoding="utf-8")

    # ★★★ 짝이 없으면 None — 남의 정보 파일을 집지 않습니다
    eq(beside(d / "restoration_upper_16-16-crown.stl"), None, "짝 없는 크라운")

    # 짝이면 찾습니다 (브라우저가 붙인 ' (3)' 꼬리가 있어도)
    got = beside(d / "2026-08-21_차정순-upperjaw_27-27-crown (3).stl")
    eq(got.name if got else None, "2026-08-21_차정순-upperjaw_27.constructionInfo", "제 짝")

    # 앞머리가 조금 겹친다고 짝이 아닙니다 ('x_2' 는 'x_27-…' 의 짝이 아님)
    eq(beside(d / "x_27-27-crown.stl"), None, "x_2 는 x_27 의 짝이 아님")

    # 하나뿐이어도 이름이 안 맞으면 안 집습니다
    solo = d / "solo"
    solo.mkdir()
    (solo / "다른환자_37.constructionInfo").write_text("", encoding="utf-8")
    eq(beside(solo / "restoration_upper_16-16-crown.stl"), None, "하나뿐인 남의 파일")

# 이름에서 읽는 치식
eq(teeth_from_name(Path("restoration_upper_16-16-crown.stl")), [16], "싱글")
eq(teeth_from_name(Path("a_27-27-crown (2).stl")), [27], "복사 꼬리")
eq(teeth_from_name(Path("a_24-26-crown.stl")), [24, 25, 26], "브릿지 — 범위를 폄 (2026-10-28)")
eq(teeth_from_name(Path("a_25-27-bridge.stl")), [25, 26, 27], "브릿지 — bridge 꼬리도")
eq(teeth_from_name(Path("8c6f86e2-af12-4e7f-883c-bf3d4e8958bc-upp_26-27-26-27-bridge.stl")), [26, 27], "브릿지 — 범위가 두 번 적힌 실제 이름 (2026-10-30)")
eq(teeth_from_name(Path("a_25-27-25-27-bridge (1).stl")), [25, 26, 27], "두 번 적힌 범위 + 복사 꼬리")
eq(teeth_from_name(Path("PreparationScan.stl")), [], "크라운 이름이 아님")
eq(fdi_range(13, 23), [13, 12, 11, 21, 22, 23], "정중선을 넘는 범위")
eq(fdi_range(23, 13), [13, 12, 11, 21, 22, 23], "거꾸로 줘도 같음")
eq(fdi_range(33, 43), [33, 32, 31, 41, 42, 43], "아래턱 정중선")
eq(fdi_range(16, 46), [], "위아래를 넘는 건 브릿지가 아님")
eq(fdi_range(27, 27), [27], "싱글")

print(f"통과 {ok} · 실패 {bad}")
raise SystemExit(1 if bad else 0)
