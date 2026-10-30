# -*- coding: utf-8 -*-
"""
덴트버드 설계값 고정 — 생성 뒤, 내보내기 전에 (사용자 결정 2026-10-15).

    "덴트버드 내면값, 교합 및 인접조정 탭을 안 알려줬었네 — 이걸로 고정해줘"
    "마지막에 최소두께 보정도 필요해 보인다"

순서가 뜻이 있습니다.
  1. 내면      — 시멘트 갭·마진. 크라운 안쪽이 지대치에 맞는 정도입니다
  2. 교합·인접 — 대합치·옆 이와의 거리. **모양 유지**로 밉니다 (사용자 선택)
  3. 최소 두께 — 2 에서 밀리며 얇아진 곳을 메웁니다. 그래서 **맨 뒤**입니다

★ 값은 여기 한 곳에만 둡니다 (orient.py 의 각도처럼). 바꿀 때는 이 표만.
★ 화면 칸은 이름(data-testid)으로 찾습니다. 2026-10-15 에 17번 케이스에서
  직접 열어 확인한 이름입니다. 덴트버드가 바꾸면 '칸을 못 찾았습니다' 로
  **멈춥니다** — 값을 못 넣은 채 내보내지 않습니다.
★ 넣은 뒤 **다시 읽어** 견줍니다. 숫자 칸은 타자가 안 먹는 날이 있습니다.
"""

from __future__ import annotations

import time

#: 내면 (inner-input-*) — 3D 프린팅 · 블록 아웃 켬
INNER: dict[str, float] = {
    # ★ 최소 두께 — 0.45 는 0.4 노즐 선폭(0.42) 바로 위라 PLA 출력품에 구멍이 났습니다
    #   (2026-10-28, 27번: 메쉬는 닫혀 있는데 0.6mm 아래가 3.6%). 벽 두 줄(wall_loops 2)에
    #   0.84mm 가 필요해 0.8 로 올림 (사용자 결정 2026-10-28). 2026-10-19 의 0.45 결정을 뒤집음.
    "minimalThickness": 0.800,
    "cementGap": 0.040,             # 시멘트 갭
    "adaptiveExtraGap": 0.000,      # 적응형 추가 간격
    "minimalCementGap": 0.000,      # 마진 씰 갭
    "heightForMinimalGap": 0.000,   # 마진 씰 갭 높이
    "marginWidth": 0.150,           # 마진 폭
    "marginAngle": 0.0,             # 마진 각도 (°)
}

#: 교합·인접·치은 (refine-adapt-*-distance-input) 과 누를 단추
#: ★ 교합·인접은 '모양 유지'(preserve) — 사용자 선택 2026-10-15.
#:   치은은 단추가 '교차면 제거'(cut) 하나뿐입니다.
ADAPT: list[tuple[str, float, str]] = [
    ("occlusal", 0.200, "preserve"),
    ("proximal", -0.020, "preserve"),
    ("gingival", 0.000, "cut"),
]

#: 한 번 적용하고 덴트버드가 계산을 끝낼 때까지 기다리는 한도
SETTLE_SECONDS = 60

#: 최소 두께 보정 뒤 경고가 사라지기를 기다리는 한도
THICKNESS_WAIT = 45


class ParamError(Exception):
    """값을 못 넣었습니다 — 넣지 못한 채 내보내면 안 됩니다"""


def _q(d, testid: str):
    els = d.find_elements("css selector", f'[data-testid="{testid}"]')
    if not els:
        raise ParamError(f"덴트버드 화면에서 '{testid}' 칸을 못 찾았습니다")
    return els[0]


def _click(d, testid: str) -> None:
    d.execute_script("arguments[0].click()", _q(d, testid))


def _busy(d) -> bool:
    """덴트버드가 계산 중인가 — 진행 표시가 떠 있으면"""
    return bool(
        d.execute_script(
            "return !![...document.querySelectorAll('[role=progressbar],.MuiCircularProgress-root,.MuiLinearProgress-root')]"
            ".find(e=>e.offsetWidth||e.offsetHeight)"
        )
    )


def _settle(d, why: str) -> None:
    time.sleep(1.5)
    for _ in range(SETTLE_SECONDS * 2):
        if not _busy(d):
            time.sleep(1)
            if not _busy(d):
                return
        time.sleep(0.5)
    raise ParamError(f"{why} — {SETTLE_SECONDS}초가 지나도 계산이 안 끝납니다")


def _set_number(d, testid: str, value: float, places: int = 3) -> None:
    """숫자 칸에 넣고 다시 읽어 견줍니다

    ★ React 칸이라 value 를 직접 바꾸면 화면만 바뀌고 속은 그대로입니다.
      사람처럼 눌러서 지우고 칩니다.
    ★★ **엔터로 끝냅니다** (2026-10-15 실측). Tab 으로 빠져나오면 마진 각도가
      화면엔 0 으로 보이고도 적용하면 45 로 돌아갔습니다. 엔터를 치자 먹었습니다.
    """
    from selenium.webdriver.common.keys import Keys  # noqa: PLC0415

    box = _q(d, testid)
    inp = box.find_element("css selector", "input")
    want = f"{value:.{places}f}"
    for _ in range(3):
        d.execute_script("arguments[0].scrollIntoView({block:'center'})", inp)
        inp.click()
        inp.send_keys(Keys.CONTROL, "a")
        inp.send_keys(Keys.BACKSPACE)
        inp.send_keys(want)
        inp.send_keys(Keys.ENTER)
        time.sleep(0.4)
        try:
            if abs(float(inp.get_attribute("value")) - value) < 10 ** -places / 2:
                return
        except (TypeError, ValueError):
            pass
    raise ParamError(f"'{testid}' 에 {want} 이 안 들어갑니다 (지금 {inp.get_attribute('value')!r})")


def _set_check(d, testid: str, on: bool) -> None:
    inp = _q(d, testid).find_element("css selector", "input")
    if bool(inp.is_selected()) != on:
        d.execute_script("arguments[0].click()", inp)
        time.sleep(0.3)
    if bool(inp.is_selected()) != on:
        raise ParamError(f"'{testid}' 를 {'켜지' if on else '끄지'} 못했습니다")


def _crown_toolbar(d, wait_s: float = 40.0) -> None:
    """크라운 도구 막대(내면·다듬기…)가 없으면 크라운을 골라서 엽니다

    ★★ 생성 직후에는 이름표를 한 번 누르고 2초 기다리는 것으로 모자랐습니다 (2026-10-19
      tetetet 건 — "'toolbar-tool-inner' 칸을 못 찾았습니다", 생성 끝 3초 뒤). 손으로 해 보니
      이름표·치식 번호 칸·상태 카드 어느 것을 눌러도 2.5초쯤 뒤에 막대가 떴습니다.
      셋을 번갈아 누르며 20초까지 기다립니다.
    """
    has = lambda: bool(d.find_elements("css selector", '[data-testid="toolbar-tool-inner"]'))  # noqa: E731
    if has():
        return
    picks = ("component-floating-label-button", "component-tooth-number-box-", "design-status-card-")
    deadline = time.time() + wait_s
    i = 0
    while time.time() < deadline:
        pick = picks[i % len(picks)]
        i += 1
        # 치식 번호·상태 카드는 뒤에 번호/이름이 붙습니다 — 앞글자로 찾아 첫 것을 누릅니다
        els = d.find_elements("css selector", f'[data-testid^="{pick}"]')
        if els:
            try:
                d.execute_script("arguments[0].click()", els[0])
            except Exception:  # noqa: BLE001 — 다음 후보로
                pass
        for _ in range(6):
            time.sleep(0.5)
            if has():
                return
    # ★ 멈춘 까닭을 다음에 바로 알 수 있게 — 창 사정과 그림을 같이 남깁니다 (2026-10-21,
    #   서버 PC zzz 건: 최소화된 창 때문인지 화면이 바뀐 것인지 글만으로는 못 가렸습니다)
    from dentbird_web import snapshot, window_report  # noqa: PLC0415

    shot = snapshot(d, "toolbar")
    raise ParamError(
        "크라운을 골라도 도구 막대가 안 뜹니다 — " + window_report(d)
        + (f" · 그림 {shot}" if shot else "") + " — 덴트버드 화면이 바뀌었는지 보세요"
    )


def _inner_values(d) -> dict[str, float]:
    got = d.execute_script(
        "return Object.fromEntries([...document.querySelectorAll('[data-testid^=\"inner-input-\"] input')]"
        ".map(i=>[i.closest('[data-testid]').getAttribute('data-testid').replace('inner-input-',''), i.value]))"
    )
    return {k: float(v) for k, v in got.items() if v not in (None, "")}


def _inner_wrong(d) -> list[str]:
    have = _inner_values(d)
    return [f"{k} {have.get(k)}≠{v}" for k, v in INNER.items() if have.get(k) is None or abs(have[k] - v) > 5e-4]


def _open_tool(d, tool: str, marker: str) -> None:
    """도구 패널을 엽니다 — **이미 열려 있으면 안 누릅니다**

    ★★ 도구 단추는 열기/닫기 **토글**입니다 (2026-10-15 실측). 열린 패널에 또
      누르면 닫혀서, 다음 단계가 '칸을 못 찾았습니다' 가 되거나 엉뚱한 탭을
      보고 '부족한 곳 없음' 이라고 거짓말을 했습니다.
    """
    _crown_toolbar(d)
    here = lambda: d.find_elements("css selector", f'[data-testid="{marker}"]')  # noqa: E731
    if here():
        return
    # ★ 다른 패널이 열려 있으면 한 번 눌러서는 안 넘어가는 때가 있습니다 — 세 번까지
    for _ in range(3):
        _click(d, tool)
        for _ in range(12):
            time.sleep(0.5)
            if here():
                return
        _crown_toolbar(d)
    raise ParamError(f"'{tool}' 패널이 안 열립니다")


def _refine_group(d, group: str, sign: str) -> None:
    """다듬기의 탭(Transform·Outer·Adapt)으로 넘어가고, 넘어간 것을 글자로 확인합니다"""
    _open_tool(d, "toolbar-tool-refine", "refine-group-Adapt-btn")
    for _ in range(3):
        _click(d, f"refine-group-{group}-btn")
        time.sleep(1.5)
        text = d.execute_script("return (document.querySelector('[data-testid=refine-process]')||document.body).innerText")
        if sign in text:
            return
    raise ParamError(f"다듬기 '{group}' 탭으로 못 넘어갔습니다")


def set_inner(d, say=print) -> None:
    """내면 값을 넣고 적용 → **다시 열어 읽어** 견줍니다. 두 번 해도 틀리면 멈춤"""
    for attempt in (1, 2):
        _set_inner_once(d, say)
        # ★ 적용하면 패널이 닫힙니다. 다시 열어 실제로 남은 값을 봅니다
        _open_tool(d, "toolbar-tool-inner", "inner-apply-btn")
        wrong = _inner_wrong(d)
        if not wrong:
            say("내면 값 확인 — 7칸 모두 맞습니다")
            return
        say(f"내면 값이 덜 들어갔습니다 ({', '.join(wrong)}) — 한 번 더")
    raise ParamError(f"내면 값이 안 들어갑니다: {', '.join(wrong)}")


def _set_inner_once(d, say=print) -> None:
    _open_tool(d, "toolbar-tool-inner", "inner-apply-btn")

    # 3D 프린팅 (밀링 아님)
    btn = _q(d, "inner-fab-3d-printing-btn")
    if btn.get_attribute("aria-pressed") != "true":
        d.execute_script("arguments[0].click()", btn)
        time.sleep(1)

    for key, value in INNER.items():
        _set_number(d, f"inner-input-{key}", value, places=1 if key == "marginAngle" else 3)
    _set_check(d, "inner-blockout-checkbox", True)

    apply = _q(d, "inner-apply-btn")
    if apply.get_attribute("disabled") is None:
        d.execute_script("arguments[0].click()", apply)
        _settle(d, "내면 적용")
        say("내면 값 적용 — 시멘트 갭 0.040 · 마진 폭 0.150")
    else:
        # 이미 같은 값이면 적용 단추가 잠겨 있습니다
        say("내면 값은 이미 맞습니다")


def set_adapt(d, say=print) -> None:
    _refine_group(d, "Adapt", "교합 거리")

    _set_check(d, "refine-adapt-blockout-checkbox", True)
    for part, value, how in ADAPT:
        _set_number(d, f"refine-adapt-{part}-distance-input", value)
        _click(d, f"refine-adapt-{part}-{how}-btn")
        _settle(d, f"{part} 거리 조정")
    say("교합 0.200 · 인접 -0.020 (모양 유지) · 치은 0.000 조정")


def fix_thickness(d, say=print) -> None:
    """외형 탭에 '최소 두께 부족' 이 있으면 「최소 두께 보정」 을 누릅니다. 남으면 멈춥니다"""
    # ★ '외형 수정' 이 보여야 외형 탭입니다 — 아니면 경고를 못 보고 넘어갑니다
    _refine_group(d, "Outer", "외형 수정")

    warned = lambda: "최소 두께 부족" in d.execute_script(  # noqa: E731
        "return (document.querySelector('[data-testid=refine-process]')||document.body).innerText"
    )
    if not warned():
        say("최소 두께 — 부족한 곳 없음")
        return

    for _ in range(2):
        clicked = d.execute_script(
            "const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').trim()==='최소 두께 보정'"
            " && (e.offsetWidth||e.offsetHeight)); if(b){b.click(); return true} return false"
        )
        if not clicked:
            raise ParamError("'최소 두께 보정' 단추를 못 찾았습니다")
        # ★★ 보정은 **진행 표시 없이** 돕니다 (2026-10-15 실측). 표시만 보고
        #   바로 확인했더니 아직 계산 중이라 '두 번 해도 남는다' 고 멈췄습니다 —
        #   실제로는 먹고 있었습니다. 경고가 사라질 때까지 기다립니다.
        for _ in range(THICKNESS_WAIT * 2):
            time.sleep(0.5)
            if not warned():
                say("최소 두께 보정 — 끝")
                return
    raise ParamError("최소 두께 보정을 두 번 했는데도 '최소 두께 부족' 이 남습니다 — 사람이 봐 주세요")


def apply_all(d, say=print) -> None:
    """내면 → 교합·인접 → 최소 두께. 하나라도 못 하면 ParamError"""
    set_inner(d, say)
    set_adapt(d, say)
    fix_thickness(d, say)


#: 이름표를 누른 뒤 그 치아의 도구 막대가 뜰 때까지
SELECT_SECONDS = 20.0


def close_panels(d) -> None:
    """열려 있는 도구 패널(내면·다듬기)을 닫습니다.

    ★★ 패널이 열려 있는 동안은 **다른 치아의 이름표가 화면에서 아예 빠집니다** (2026-10-30 실측 —
      다듬기 패널을 연 채로는 이름표가 0개, 닫으면 0.6초 뒤에 돌아옴). fix_thickness 가 다듬기
      외형 탭을 연 채로 끝나므로, 다음 크라운을 고르기 전에 반드시 닫아야 합니다. 안 닫으면
      select_tooth 가 20초를 기다리다 멈춥니다.
    """
    for tool, marker in (("toolbar-tool-refine", "refine-process"), ("toolbar-tool-inner", "inner-apply-btn")):
        if d.find_elements("css selector", f'[data-testid="{marker}"]'):
            _click(d, tool)
            time.sleep(0.8)


def select_tooth(d, number: int, wait_s: float = SELECT_SECONDS) -> None:
    """3D 화면의 이름표(글이 치식)를 눌러 **그 치아**를 고릅니다 — 브릿지에서 크라운마다 값을 넣을 때.

    ★ `_crown_toolbar` 는 '아무 이름표나' 눌러 막대만 띄웁니다. 브릿지는 어느 크라운의 막대인지가
      중요해서 번호로 고릅니다. 막대가 이미 떠 있어도 **다시** 누릅니다 — 다른 크라운 것일 수 있습니다.
    ★ 다른 크라운이 골라져 있으면 나머지 이름표는 **숨겨져** 있지만(offsetParent 없음) JS click 은
      먹습니다 (2026-10-30 실측). 패널이 열려 있으면 이름표가 DOM 에서 빠지므로 먼저 닫습니다.
    ★ 막대가 떴다는 것만으로는 모자랍니다 — 전 크라운의 막대일 수 있어, 막대 글에 번호가 있어야 합니다.
    """
    close_panels(d)
    deadline = time.time() + wait_s
    while time.time() < deadline:
        hit = d.execute_script(
            "const l=[...document.querySelectorAll('[data-testid=component-floating-label-button]')]"
            ".find(e=>(e.innerText||'').trim()===String(arguments[0]));"
            "if(!l) return false; l.click(); return true;", number)
        if not hit:
            time.sleep(1)
            continue
        for _ in range(6):
            time.sleep(0.5)
            bar = d.execute_script(
                "return (document.querySelector('[data-testid=crown-toolbar]')||{}).innerText||''")
            if d.find_elements("css selector", '[data-testid="toolbar-tool-inner"]') and str(number) in bar:
                return
    raise ParamError(f"치아 {number} 의 이름표를 눌러도 그 치아의 도구 막대가 안 뜹니다 — 화면을 봐 주세요")


def apply_each(d, teeth: list[int], say=print) -> None:
    """지대치마다 골라서 apply_all. 하나면 전처럼(아무 이름표나).

    ★ 브릿지는 **합치기 전**에 불러야 합니다 — 합치면 내면·교합 패널이 잠깁니다 (2026-10-28 실측).
    """
    if len(teeth) <= 1:
        apply_all(d, say)
        return
    for n in sorted(teeth):
        say(f"크라운 {n} 의 설계값")
        select_tooth(d, n)
        apply_all(d, say)
