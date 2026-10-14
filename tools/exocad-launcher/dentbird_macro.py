# -*- coding: utf-8 -*-
r"""덴트버드를 대신 눌러 줍니다 (2026-10-14).

    python dentbird_macro.py <스캔1> <스캔2> ... --teeth 27

★★ **API 를 못 받아서 화면을 누릅니다.** 다행히 덴트버드가 단추마다
  `data-testid` 를 붙여 놨습니다 — 좌표나 한글 글자가 아니라 그 이름으로
  누르면 화면이 조금 바뀌어도 잘 안 깨집니다. DS Core 와 같은 방식입니다.

★★ **비밀번호를 안 씁니다.** 전용 크롬 프로필(dentbird_web.py)에 사람이
  한 번 로그인해 둔 세션을 그대로 씁니다.

★★★ **치식이 다르면 멈춥니다.** 덴트버드가 치식을 스스로 잡는데, 틀렸을
  때 아무도 모르는 것이 제일 위험합니다 — 엉뚱한 이의 크라운이 치과에서
  그대로 출력됩니다. 화면에 적힌 치식(`…tooth-info-setter`)을 읽어
  주문서 치식과 견주고, 다르면 **사람을 부릅니다.**

★ 파일은 **숨은 입력칸**(`input[type=file]`)에 바로 넣습니다. 파일 고르기
  창이 안 뜹니다 (DS Core 때 20초를 0초로 만든 그 수법).

적어 둔 길 (실측 2026-10-14):
    신규 → Dentbird Crown        사이드바 '신규' → 유형에서 Crown
    #file-input                  스캔을 그대로 밀어 넣음
    import-next-btn              AI 분류 끝난 뒤
    (AI 케이스 분석)              /crown/preparation 으로 넘어감
    tooth-info-setter            "크라운 27" ← **여기서 치식 확인**
    preset-select                "Preset - 3D Printing"
    workspace-preparation-design-btn   설계 시작
    viewer-dialog-export-button  내보내기 (케이스 목록에서)
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from dentbird_web import attach, alive  # noqa: E402

CROWN_URL = "https://ai.dentbird.com/crown/new-crown"

#: 화면이 바뀌기를 기다리는 한도. AI 분석이 제일 깁니다
WAIT_SECONDS = 300
STEP = 5


class Stop(Exception):
    """사람이 봐야 하는 자리. 조용히 넘어가지 않습니다"""


def text(d) -> str:
    return d.execute_script("return document.body.innerText || '';")


def wait_gone(d, word: str, why: str) -> None:
    """그 말이 사라질 때까지. 안 사라지면 멈춥니다"""
    for _ in range(WAIT_SECONDS // STEP):
        if word not in text(d):
            return
        time.sleep(STEP)
    raise Stop(f"{why} — '{word}' 가 {WAIT_SECONDS}초 넘게 그대로입니다")


def click(d, testid: str) -> None:
    els = d.find_elements("css selector", f"[data-testid={testid}]")
    if not els:
        raise Stop(f"단추를 못 찾았습니다: {testid}")
    els[0].click()


def detected_teeth(d) -> list[int]:
    """화면이 말하는 치식. 못 읽으면 빈 목록"""
    els = d.find_elements("css selector", "[data-testid=workspace-preparation-tooth-info-setter]")
    if not els:
        return []
    # "디자인 파라미터 / 크라운 24 / Preset -" 에서 숫자만
    return [int(n) for n in re.findall(r"\b([1-4][1-8])\b", els[0].text)]


def run(scans: list[Path], want: list[int], say=print) -> bool:
    if not alive():
        raise Stop("덴트버드 창이 안 떠 있습니다 — dentbird_web.py 로 띄우고 로그인해 주세요")

    d = attach()
    say("새 크라운 케이스를 엽니다")
    d.get(CROWN_URL)
    time.sleep(5)

    if "로그인" in text(d) or "login" in d.current_url.lower():
        raise Stop("로그인이 풀렸습니다 — 그 창에서 한 번 로그인해 주세요")

    say(f"스캔 {len(scans)}개를 올립니다")
    d.find_element("css selector", "input[type=file]").send_keys(
        "\n".join(str(p) for p in scans)
    )
    wait_gone(d, "분류하고 있습니다", "스캔 분류가 안 끝납니다")

    say("다음 — AI 분석을 기다립니다 (몇 분 걸립니다)")
    click(d, "import-next-btn")
    wait_gone(d, "분석하고 있습니다", "AI 분석이 안 끝납니다")

    got = detected_teeth(d)
    say(f"덴트버드가 잡은 치식: {got or '못 읽음'}")

    # ★★★ 여기가 이 매크로의 핵심입니다. 넘어가지 않습니다.
    if not got:
        raise Stop("치식을 못 읽었습니다 — 화면을 보고 사람이 확인해 주세요")
    if sorted(got) != sorted(want):
        raise Stop(f"치식이 주문서와 다릅니다 — 주문서 {want} · 덴트버드 {got}")

    say("설계를 시작합니다")
    click(d, "workspace-preparation-design-btn")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="덴트버드에 스캔을 올리고 설계를 돌립니다")
    ap.add_argument("scans", nargs="+", type=Path)
    ap.add_argument("--teeth", required=True, help="주문서 치식 (예: 27 또는 24,25)")
    args = ap.parse_args()

    want = [int(x) for x in re.findall(r"\d+", args.teeth)]
    missing = [p for p in args.scans if not p.is_file()]
    if missing:
        print("없는 파일:", ", ".join(str(p) for p in missing))
        return 1

    try:
        run(args.scans, want)
    except Stop as e:
        print(f"멈춤: {e}")
        return 1
    print("설계를 걸었습니다. 끝나면 케이스 목록에서 내보내기 하세요")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
