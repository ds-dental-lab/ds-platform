# -*- coding: utf-8 -*-
r"""커넥터 슬라이더가 언제 잠기고 언제 풀리는지 떠 있는 덴트버드 창에서 재 봅니다 (2026-11-02).

    python dentbird_slider_probe.py 26

★ 왜: 설계가 커넥터에서 두 번 멈췄습니다(ORD-261102-008). 첫 재기에서 슬라이더가 disabled 였습니다.
  고칠 때마다 새로 설계하면 건수를 쓰므로, 멈춘 채 열려 있는 케이스에서 잽니다.
★ 생성·합치기·내보내기는 누르지 않습니다. 칩·모양·슬라이더만 만집니다.
"""
from __future__ import annotations

import sys
import time

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from dentbird_macro import alive, attach
from dentbird_params import CONNECTOR_SHAPE, _open_tool, _slider_input, select_tooth

SLIDER = "connect-size-slider-횡단"
CHIPS = '[data-testid^="connect-connector-chip-"]'
SHAPES = '[data-testid="connect-cross-sectional-shape"] button'
INFO = "return (document.querySelector('[data-testid=connect-size-info]')||{}).innerText||''"


def disabled(d) -> bool:
    return _slider_input(d, SLIDER).get_attribute("disabled") is not None


def watch(d, name: str, seconds: float = 12.0) -> None:
    """잠김이 언제 풀리는지 0.5초마다 봅니다"""
    start = time.time()
    last = None
    while time.time() - start < seconds:
        now = disabled(d)
        if now != last:
            print(f"  {name} {time.time() - start:4.1f}초: {'잠김' if now else '풀림'}")
            last = now
        time.sleep(0.5)


def try_keys(d) -> None:
    inp = _slider_input(d, SLIDER)
    before = float(inp.get_attribute("value"))
    d.execute_script("arguments[0].focus()", inp)
    ActionChains(d).send_keys(Keys.ARROW_LEFT * 3).perform()
    time.sleep(1.2)
    print(f"  키보드 3칸: {before} → {_slider_input(d, SLIDER).get_attribute('value')} · {d.execute_script(INFO)!r}")


def main() -> int:
    if not alive():
        print("덴트버드 창이 안 떠 있습니다")
        return 1
    d = attach()
    if not d.find_elements("css selector", '[data-testid="connect-process"]'):
        if len(sys.argv) < 2:
            print("치아 번호를 붙여 주세요 — 예: python dentbird_slider_probe.py 26")
            return 1
        select_tooth(d, int(sys.argv[1]))
        _open_tool(d, "toolbar-tool-connect", "connect-process")
    time.sleep(1)

    print("패널만 연 상태")
    watch(d, "패널", 4)
    count = len(d.find_elements("css selector", CHIPS))
    print(f"칩 {count}개")
    for i in range(count):
        chip = d.find_elements("css selector", CHIPS)[i]
        name = (chip.text or "").strip()
        print(f"[{name}] class={chip.get_attribute('class')[-40:]}")
        d.execute_script("arguments[0].click()", chip)
        watch(d, "칩 누른 뒤")
        try_keys(d)
        buttons = d.find_elements("css selector", SHAPES)
        print("  모양 단추:", [b.get_attribute("disabled") is not None for b in buttons])
        if len(buttons) > CONNECTOR_SHAPE:
            d.execute_script("arguments[0].click()", buttons[CONNECTOR_SHAPE])
            watch(d, "+ 누른 뒤")
            try_keys(d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
