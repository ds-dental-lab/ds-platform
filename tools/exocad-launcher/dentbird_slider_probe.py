# -*- coding: utf-8 -*-
r"""커넥터 넣기를 떠 있는 덴트버드 창에서 그대로 돌려 봅니다 (2026-11-02).

    python dentbird_slider_probe.py

★ 왜: '+' 를 먼저 고르면 슬라이더가 잠겨 설계가 두 번 멈췄습니다(ORD-261102-008). 순서를 고친
  set_connectors 를 멈춘 케이스에서 돌립니다. 새로 설계하면 건수를 쓰기 때문입니다.
★ 합치기·내보내기는 누르지 않습니다.
"""
from __future__ import annotations

import time

from dentbird_macro import alive, attach
from dentbird_params import CONNECTOR_SHAPE, _open_tool, _q, _slider_input, set_connectors


def main() -> int:
    if not alive():
        print("덴트버드 창이 안 떠 있습니다")
        return 1
    d = attach()
    print("넣은 결과:", set_connectors(d))
    time.sleep(1)
    # 다시 열어 '+' 인 채로 크기가 남았는지 봅니다
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    time.sleep(1)
    buttons = d.find_elements("css selector", '[data-testid="connect-cross-sectional-shape"] button')
    print("고른 모양 단추 class:", (buttons[CONNECTOR_SHAPE].get_attribute("class") or "")[-50:] if len(buttons) > CONNECTOR_SHAPE else "없음")
    for axis in ("횡단", "수직"):
        inp = _slider_input(d, f"connect-size-slider-{axis}")
        print(f"{axis}: 값={inp.get_attribute('value')} 잠김={inp.get_attribute('disabled') is not None}")
    print("단면:", " ".join((_q(d, "connect-size-info").text or "").split()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
