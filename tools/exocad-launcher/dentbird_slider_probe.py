# -*- coding: utf-8 -*-
r"""커넥터 슬라이더가 어떤 방법으로 움직이는지 떠 있는 덴트버드 창에서 재 봅니다 (2026-11-02).

    python dentbird_slider_probe.py 26

★ 왜: 설계가 커넥터에서 두 번 멈췄습니다(ORD-261102-008). 고칠 때마다 새로 설계하면 건수를 쓰므로,
  멈춘 채 열려 있는 케이스에서 방법을 하나씩 해 보고 결과만 적습니다.
★ 생성·합치기·내보내기는 누르지 않습니다. 슬라이더 값만 움직입니다.
"""
from __future__ import annotations

import sys
import time

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from dentbird_macro import alive, attach
from dentbird_params import _open_tool, _slider_input, select_tooth

SLIDER = "connect-size-slider-횡단"


def read(d) -> float:
    return float(_slider_input(d, SLIDER).get_attribute("value"))


def state(d) -> str:
    return d.execute_script(
        "const i=arguments[0], r=i.getBoundingClientRect(); i.focus();"
        "return JSON.stringify({disabled:i.disabled, hasFocus:document.hasFocus(),"
        " active:document.activeElement===i, visibility:document.visibilityState,"
        " w:r.width, h:r.height, display:getComputedStyle(i).display})",
        _slider_input(d, SLIDER),
    )


def keys(d, n: int) -> None:
    d.execute_script("arguments[0].focus()", _slider_input(d, SLIDER))
    ActionChains(d).send_keys((Keys.ARROW_RIGHT if n > 0 else Keys.ARROW_LEFT) * abs(n)).perform()


def by_keys(d, now: float, want: float) -> None:
    keys(d, round((want - now) * 10))


def by_keys_focused(d, now: float, want: float) -> None:
    d.execute_cdp_cmd("Page.bringToFront", {})
    d.execute_cdp_cmd("Emulation.setFocusEmulationEnabled", {"enabled": True})
    keys(d, round((want - now) * 10))


def by_setter(d, now: float, want: float) -> None:
    d.execute_script(
        "const i=arguments[0];"
        "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,String(arguments[1]));"
        "i.dispatchEvent(new Event('input',{bubbles:true}));"
        "i.dispatchEvent(new Event('change',{bubbles:true}));",
        _slider_input(d, SLIDER), want,
    )


def by_mouse(d, now: float, want: float) -> None:
    root = d.find_element("css selector", f'[data-testid="{SLIDER}"]')
    rail = d.execute_script(
        "return arguments[0].querySelector('.MuiSlider-root')||arguments[0]", root)
    width = rail.size["width"]
    x = int(width * (want - 1) / 9 - width / 2)
    ActionChains(d).move_to_element_with_offset(rail, x, 0).click().perform()


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
    print("상태:", state(d))

    target = 4.0
    for name, how in (("키보드", by_keys), ("앞으로+초점+키보드", by_keys_focused),
                      ("값 넣기", by_setter), ("마우스", by_mouse)):
        before = read(d)
        target = 6.0 if abs(before - 4.0) < 0.05 else 4.0
        try:
            how(d, before, target)
            time.sleep(1.2)
            print(f"{name}: {before} → {read(d)} (목표 {target})")
        except Exception as e:  # noqa: BLE001 — 재 보는 도구입니다. 다음 방법으로 넘어갑니다
            print(f"{name}: 오류 {type(e).__name__} {str(e)[:80]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
