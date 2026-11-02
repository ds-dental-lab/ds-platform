# -*- coding: utf-8 -*-
r"""합치기 → 분리 뒤에는 커넥터 슬라이더가 풀리는지 떠 있는 덴트버드 창에서 재 봅니다 (2026-11-02).

    python dentbird_slider_probe.py 26

★ 왜: 생성 직후에는 슬라이더가 칩·모양을 눌러도 계속 잠겨 있었습니다(ORD-261102-008).
  10-30 에 움직인 것은 합친 뒤 분리한 케이스였습니다. 그 차이인지 봅니다.
★ 내보내기는 누르지 않습니다.
"""
from __future__ import annotations

import sys
import time

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from dentbird_macro import alive, attach, click, text
from dentbird_params import CONNECTOR_SHAPE, _open_tool, _slider_input, close_panels, select_tooth

SLIDER = "connect-size-slider-횡단"
CHIPS = '[data-testid^="connect-connector-chip-"]'
SHAPES = '[data-testid="connect-cross-sectional-shape"] button'
INFO = "return (document.querySelector('[data-testid=connect-size-info]')||{}).innerText||''"


def disabled(d) -> bool:
    return _slider_input(d, SLIDER).get_attribute("disabled") is not None


def try_keys(d, name: str) -> None:
    inp = _slider_input(d, SLIDER)
    before = inp.get_attribute("value")
    print(f"{name}: 잠김={disabled(d)} 값={before} {d.execute_script(INFO)!r}")
    d.execute_script("arguments[0].focus()", inp)
    ActionChains(d).send_keys(Keys.ARROW_LEFT * 3).perform()
    time.sleep(1.5)
    print(f"  키보드 3칸 뒤: 값={_slider_input(d, SLIDER).get_attribute('value')} {d.execute_script(INFO)!r}")


def main() -> int:
    if len(sys.argv) < 2:
        print("치아 번호를 붙여 주세요 — 예: python dentbird_slider_probe.py 26")
        return 1
    if not alive():
        print("덴트버드 창이 안 떠 있습니다")
        return 1
    tooth = int(sys.argv[1])
    d = attach()

    close_panels(d)
    select_tooth(d, tooth)
    time.sleep(1)
    click(d, "toolbar-assemble-btn")
    print("합치기를 눌렀습니다")
    for _ in range(60):
        time.sleep(2)
        if "조립됨" in text(d):
            print("조립됨")
            break
    else:
        print("2분 안에 조립됨이 안 떴습니다")
        return 1

    # 분리 — 합친 뒤에는 이름표를 눌러야 분리 단추가 뜰 수 있습니다
    d.execute_script(
        "document.querySelector('[data-testid=component-floating-label-button]')?.click()")
    time.sleep(1.5)
    click(d, "toolbar-detach-btn")
    time.sleep(1.5)
    click(d, "modal-confirm-btn")
    print("분리를 눌렀습니다")
    time.sleep(8)

    select_tooth(d, tooth)
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    time.sleep(1)
    try_keys(d, "분리 뒤 패널")
    chip = d.find_elements("css selector", CHIPS)[0]
    d.execute_script("arguments[0].click()", chip)
    time.sleep(2)
    try_keys(d, "칩 누른 뒤")
    buttons = d.find_elements("css selector", SHAPES)
    if len(buttons) > CONNECTOR_SHAPE:
        d.execute_script("arguments[0].click()", buttons[CONNECTOR_SHAPE])
        time.sleep(2)
        try_keys(d, "+ 누른 뒤")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
