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

#: 브릿지 커넥터 크기 (connect-size-slider-횡단 · -수직, 1.0~10.0 · 0.1 칸). 단면 모양은 기본(둘째) 그대로.
#: ★ 왜 — 서버 PC 가 처음 내보낸 브릿지(2026-10-30, 치ㅣ 26-27)는 두 크라운이 좁게 맞닿아 주름이 졌습니다.
#:   매크로가 커넥터 도구를 안 건드려 기본 5.0·5.0 그대로였고, 같은 값이 폰틱 쪽(25-26)에서는 2.0mm²
#:   ('약함') 밖에 안 나왔습니다. 덴트버드가 '최적' 이라 부르는 단면은 12.5mm² 쯤이고 그 위는 '크기 초과'
#:   라고 하지만, PLA 임시치아는 연결부가 두꺼울수록 덜 부러지고 exocad 왁스업처럼 덜 어색합니다
#:   (사용자 2026-10-30 "연결부분이 너무 어색하지 않니"). 실측: 26-27 은 7·7 에서 18.9mm², 10·10 에서 29.0mm².
#:   폰틱 쪽은 10·10 이어도 12.5mm² — 단면은 슬라이더만이 아니라 두 크라운이 겹치는 자리에 달렸습니다.
#: ★ 값은 여기 한 곳. 나온 단면은 기록 창에 적으니, 몇 건 뽑아 보고 고칩니다.
#: ★ 사용자 결정 2026-10-30 — "커넥터 두께가 최대한 얇게, 크라운 사이가 거의 붙어 있으면 좋겠어. 4mm 정도면
#:   안정감 있고, 교합면이나 마진 범위를 넘어서면 어쩔 수 없고". 치아 분리감이 제일 우선. 4·4 로 합쳐 보여 드리고 허락.
#:   덴트버드는 9.5mm² 를 '약함' 이라 하지만 의도한 값이라 참고만.
#: ★ 사용자 2026-11-02 "너무 얇다, 적어도 협측·설측 교두 정도는 붙어 있으면". '+' 4·4 의 실측이 협설 2.9mm·높이 1.2mm(2.0mm²),
#:   교두 간격이 약 7mm 입니다. 횡단 10 은 '+' 에서 3.3mm 로 거의 안 굵어졌습니다(ORD-261102-012).
#: ★ 사용자 2026-11-02: '+' 는 치아가 이미 겹쳐야 뜻이 있고 횡단·수직이 안 먹습니다. 둘째 모양으로 바꾸고
#:   26-27 에서 횡단 7.6(교두 기준)·수직 3.0 을 손으로 합쳐 보고 "이 케이스는 수직 3.0 이 괜찮네".
#:   횡단은 치아 초점 보기에서 두 치아 폭을 재서 작은 쪽 × CONNECTOR_WIDTH_RATIO 로 정합니다.
#:   아래 7.6 은 폭을 못 잴 때 쓰는 값입니다.
CONNECTOR: dict[str, float] = {
    "횡단": 7.6,
    "수직": 3.0,
}
#: 횡단 = 두 치아 중 작은 교두 간격 + 이 여유 (사용자 기준 "협설폭은 교두 기준"). 사용자가 손으로 정한 두 케이스
#: (2026-11-02, 둘 다 26-27): 교두 6.4 → 7.6(+1.2), 교두 5.7 → 7.4(+1.7, "이렇게 하는 걸로 기억해줘"). 둘의 가운데.
CONNECTOR_CUSP_MARGIN = 1.5
#: 교두를 못 찾았을 때만: 횡단 = 작은 치아 폭 × 이 비율. 26-27 에서 사용자가 고른 7.6 ÷ 잰 폭 12.2mm (2026-11-02, 한 케이스 —
#: 디자인PC 크롬에서 눈금·타원 두 방법이 12.2·12.3 으로 맞음). 케이스가 쌓이면 다듬습니다.
CONNECTOR_WIDTH_RATIO = 0.62
#: 계산값이 이 범위를 벗어나면 잘못 잰 것으로 보고 끝값으로 자릅니다 (슬라이더는 1~10)
CONNECTOR_ACROSS_RANGE = (5.0, 10.0)
#: 수직 = 두 치아 중 작은 높이(치아 초점 보기 그림) × 이 비율. 같은 두 케이스: 높이 6.4 → 3.0, 8.2 → 4.1 로 둘 다 약 절반.
CONNECTOR_TALL_RATIO = 0.5
CONNECTOR_TALL_RANGE = (2.0, 6.0)
#: ★ 덴트버드 단면 글자(약함/최적/크기 초과)는 기록만 하고 값은 안 바꿉니다. 사용자가 고른 값과 두 번 어긋났습니다
#:   (7.6·3.0 이 '크기 초과', 손으로 고친 7.4·4.1 은 더 큰데 '최적') — 사용자 2026-11-02 의 case1→case2 단계는 거둠.
#: 단면 모양 — 네 단추 중 몇 번째(0부터). 1 = 둘째(사용자 2026-11-02 고름). 3 = '+' 는 크기 슬라이더를 잠급니다.
CONNECTOR_SHAPE = 3
PLUS_SHAPE = 3
#: ★ 2026-11-02 밤 확정 — 두 크라운을 **겹치게** 만든 뒤 '+' 로 합칩니다. 겹침은 슬라이더가 아니라
#:   다듬기의 '교합 및 인접 조정 → 인접 거리' 로 만듭니다 (proximal_plan 참고). 그래서 '+' 로 돌아왔습니다.

#: 인접 거리 (다듬기 → 교합 및 인접 조정, 유지 모드). 마지막에 건 크라운의 값이 **그 크라운 양면**에 걸립니다
#: (실측 2026-11-02: 26 에 -0.02 → 27 에 -0.5 를 걸면 26-27 접촉은 지름 5mm 로 돌아오고 26 의 자연치 쪽은 -0.02 그대로).
#: 그래서 자연치에 닿는 크라운을 먼저 -0.02, 안쪽(폰틱·자연치 없는 끝)을 마지막에 -0.5 로 겁니다.
PROXIMAL_NATURAL = -0.020   # 자연치에 닿는 면
PROXIMAL_INNER = -0.500     # 브릿지 안쪽 — 이만큼 겹쳐야 '+' 로 합쳤을 때 넓게 붙음(사용자 2026-11-02)
#: 2유닛인데 양쪽 다 자연치(맞컨택)면 어느 쪽을 마지막에 걸어도 한 면이 틀어짐 → 전부 -0.1
#: (사용자 2026-11-02 "-0.1 이어도 꾸겨 넣으면 들어갈 수 있는 범위")
PROXIMAL_BOTH = -0.100
#: 이 아래면 사실상 안 이어진 것입니다 (폰틱이 떠서 아래 모서리만 스치면 0.1mm²) — 두 조각으로 뽑히니 멈춥니다
CONNECTOR_MIN_AREA = 1.0

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


#: 이번 건에서 칸이 잠겨 건너뛴 조정 — 밤 실행이 기록에 옮기고 비웁니다
ADAPT_SKIPPED: list[str] = []


def set_adapt(d, say=print, proximal: bool = True) -> None:
    """교합·인접·치은 거리. 브릿지는 인접을 여기서 빼고(proximal=False) adapt_proximal_order 가 순서대로 넣습니다"""
    _refine_group(d, "Adapt", "교합 거리")
    _expand_distance(d)

    _set_check(d, "refine-adapt-blockout-checkbox", True)
    for part, value, how in ADAPT:
        if part == "proximal" and not proximal:
            continue
        # ★ 위아래 스캔이 안 맞물려 있으면 덴트버드가 교합 거리 칸을 잠급니다(2026-11-04 H26 상악 14-17 —
        #   잠긴 칸을 누르려다 멈춤). 그 조정만 건너뛰고 나머지는 합니다. 교합 높이는 사람이 봐야 합니다.
        disabled = d.execute_script(
            "const i=document.querySelector(`[data-testid=\"refine-adapt-${arguments[0]}-distance-input\"] input`);"
            "return !i || i.disabled;", part)
        if disabled:
            say(f"{'교합' if part == 'occlusal' else part} 조정 못 함 — 칸이 잠김(위아래 스캔이 안 맞물림)")
            ADAPT_SKIPPED.append(part)
            continue
        _set_number(d, f"refine-adapt-{part}-distance-input", value)
        _click(d, f"refine-adapt-{part}-{how}-btn")
        _settle(d, f"{part} 거리 조정")
    say("교합 0.200 · 인접 -0.020 (모양 유지) · 치은 0.000 조정" if proximal else "교합 0.200 · 치은 0.000 조정 (인접은 순서대로 따로)")


def _expand_distance(d) -> None:
    """'거리' 아코디언이 접혀 있으면 펼칩니다 — 접혀 있으면 입력 칸이 DOM 에 없습니다 (2026-11-02 실측)"""
    if d.find_elements("css selector", '[data-testid="refine-adapt-proximal-distance-input"]'):
        return
    tab = d.find_elements("css selector", '[data-testid="refine-adapt-tab-cutByDistance"]')
    if tab:
        d.execute_script("arguments[0].click()", tab[0])
    for _ in range(10):
        time.sleep(0.5)
        if d.find_elements("css selector", '[data-testid="refine-adapt-proximal-distance-input"]'):
            return
    raise ParamError("'교합 및 인접 조정' 의 거리 칸이 안 펼쳐집니다")


def set_proximal(d, value: float, say=print) -> None:
    """선택된 크라운의 인접 거리만 (유지 모드)"""
    _refine_group(d, "Adapt", "교합 거리")
    _expand_distance(d)
    _set_number(d, "refine-adapt-proximal-distance-input", value)
    _click(d, "refine-adapt-proximal-preserve-btn")
    _settle(d, "인접 거리 조정")
    say(f"인접 {value:.3f} (모양 유지)")


def fdi_neighbors(n: int) -> list[int]:
    """FDI 번호 n 의 양옆 — 1번끼리 정중선을 넘고, 8번은 원심 이웃이 없습니다"""
    q, i = divmod(n, 10)
    out = []
    if i > 1:
        out.append(q * 10 + i - 1)
    else:
        out.append({1: 21, 2: 11, 3: 41, 4: 31}[q])
    if i < 8:
        out.append(q * 10 + i + 1)
    return out


def proximal_plan(units: list[int], pontics: list[int], present: list[int]) -> list[tuple[int, float]]:
    """브릿지 유닛마다 인접 거리를 **어느 순서로** 걸지. [(치식, 값), …] 순서대로.

    present = 화면 이름표에 보이는 치식 전부(자연치 포함). 유닛의 이웃이 유닛이 아니면서 화면에 있으면 자연치 접촉.
    - 자연치에 닿는 유닛 먼저 PROXIMAL_NATURAL, 나머지(폰틱·자연치 없는 끝) 마지막에 PROXIMAL_INNER.
    - 2유닛 맞컨택(둘 다 자연치)은 전부 PROXIMAL_BOTH.
    """
    units = sorted(set(units) | set(pontics))
    present_set = set(present)
    natural = [u for u in units if any(nb in present_set and nb not in units for nb in fdi_neighbors(u))]
    inner = [u for u in units if u not in natural]
    if not inner:
        return [(u, PROXIMAL_BOTH) for u in units]
    return [(u, PROXIMAL_NATURAL) for u in natural] + [(u, PROXIMAL_INNER) for u in inner]


def adapt_proximal_order(d, plan: list[tuple[int, float]], say=print) -> None:
    """proximal_plan 순서대로 크라운(폰틱 포함)을 골라 인접 거리를 겁니다 — 합치기 전에"""
    say("인접 거리 순서: " + " → ".join(f"{t} {v:+.2f}" for t, v in plan))
    for tooth, value in plan:
        select_tooth(d, tooth)
        set_proximal(d, value, say)


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


def apply_all(d, say=print, proximal: bool = True) -> None:
    """내면 → 교합·인접 → 최소 두께. 하나라도 못 하면 ParamError"""
    set_inner(d, say)
    set_adapt(d, say, proximal)
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
    for tool, marker in (
        ("toolbar-tool-refine", "refine-process"),
        ("toolbar-tool-inner", "inner-apply-btn"),
        ("toolbar-tool-connect", "connect-process"),
        # ★ 마진선 도구도 (2026-11-04) — 열린 채면 '상태' 칸이 가려지고 생성 단추가 잠깁니다
        ("toolbar-tool-margin-line", "margin-process"),
    ):
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


def apply_each(d, teeth: list[int], say=print, proximal: bool = True) -> None:
    """지대치마다 골라서 apply_all. 하나면 전처럼(아무 이름표나).

    ★ 브릿지는 **합치기 전**에 불러야 합니다 — 합치면 내면·교합 패널이 잠깁니다 (2026-10-28 실측).
    ★ 브릿지는 proximal=False 로 부르고 adapt_proximal_order 로 인접을 순서대로 넣습니다.
    """
    if len(teeth) <= 1:
        apply_all(d, say, proximal)
        return
    for n in sorted(teeth):
        say(f"크라운 {n} 의 설계값")
        select_tooth(d, n)
        apply_all(d, say, proximal)


def slider_steps(now: float, want: float, step: float = 0.1) -> int:
    """키보드로 슬라이더를 옮길 때 누를 횟수 — 양수면 →, 음수면 ←. 0.1 칸 슬라이더라 반올림합니다."""
    return int(round((want - now) / step))


def _slider_input(d, testid: str):
    return _q(d, testid).find_element("css selector", "input[type=range]")


def _set_slider(d, testid: str, want: float) -> float:
    """MUI 슬라이더는 value 를 써 넣어도 React 가 모릅니다 — 숨은 range 칸에 초점을 주고 화살표로 옮깁니다
    (2026-10-30 크롬 실측: ArrowRight 한 번에 0.1). 옮긴 뒤 다시 읽어 견줍니다.

    ★★ 칸에 대고 send_keys 하면 숨은 칸이라 'element not interactable' 로 죽습니다 (2026-11-02 첫 실전,
      ORD-261102-008). 초점을 준 뒤 ActionChains 로 보냅니다 — 칸을 따지지 않고 초점 자리로 갑니다."""
    from selenium.webdriver.common.action_chains import ActionChains  # noqa: PLC0415
    from selenium.webdriver.common.keys import Keys  # noqa: PLC0415

    inp = _slider_input(d, testid)
    for _ in range(3):
        now = float(inp.get_attribute("value"))
        n = slider_steps(now, want)
        if n == 0:
            return now
        d.execute_script("arguments[0].focus()", inp)
        ActionChains(d).send_keys((Keys.ARROW_RIGHT if n > 0 else Keys.ARROW_LEFT) * abs(n)).perform()
        time.sleep(0.6)
    now = float(inp.get_attribute("value"))
    if abs(now - want) > 0.05:
        raise ParamError(f"'{testid}' 를 {want} 로 못 옮겼습니다 (지금 {now})")
    return now


def set_connectors(d, say=print) -> list[str]:
    """브릿지 커넥터마다 크기를 CONNECTOR 로 맞추고, 덴트버드가 말하는 단면(약함/최적/크기 초과 · mm²)을 돌려줍니다.

    ★ **합치기 전**에 부릅니다 — 합치면 도구가 잠깁니다. 커넥터 패널은 어느 크라운을 고르든 같습니다.
    ★ 값은 커넥터(이웃 쌍)마다 따로 남습니다 (2026-10-30 실측) — 칩을 하나씩 눌러 다 넣습니다.
    ★ 적용 단추가 없습니다 — 옮기는 즉시 먹고, 합치기가 그 값을 씁니다.
    """
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    chips = d.find_elements("css selector", '[data-testid^="connect-connector-chip-"]')
    if not chips:
        raise ParamError("브릿지 커넥터 칩이 없습니다 — 링크가 안 묶였는지 보세요")
    got: list[str] = []
    for i in range(len(chips)):
        chip = d.find_elements("css selector", '[data-testid^="connect-connector-chip-"]')[i]
        name = (chip.text or "").strip()
        d.execute_script("arguments[0].click()", chip)
        time.sleep(1.0)
        if CONNECTOR_SHAPE == PLUS_SHAPE:
            # ★ '+' 는 크기 슬라이더가 없습니다(잠김). 겹침은 adapt_proximal_order 가 이미 만들었으니 모양만 고릅니다
            shape = _pick_shape(d)
            time.sleep(1.5)
            if shape.startswith("기본"):
                # ★ 두 면이 안 닿으면 '+' 가 잠깁니다(설명서: 겉면이 닿을 때만). 인접 조정은 -0.5 가 한계라 틈이 넓으면
                #   못 붙입니다(사용자 2026-11-03 "거리가 2mm 이상이면 또 오류?"). 멈추지 않고 원형 최대(10·10)로 가고 기록에 남깁니다.
                _unlock_size(d)
                buttons = d.find_elements("css selector", '[data-testid="connect-cross-sectional-shape"] button')
                if len(buttons) > 1:
                    d.execute_script("arguments[0].click()", buttons[1])
                    time.sleep(0.8)
                for axis in ("횡단", "수직"):
                    _set_slider(d, f"connect-size-slider-{axis}", 10.0)
                time.sleep(1.5)
                shape = "원형 10·10 (두 면이 안 닿아 '+' 잠김 — 연결부가 얇을 수 있음)"
            info = " ".join((_q(d, "connect-size-info").text or "").split())
            got.append(f"{name} {info}")
            say(f"커넥터 {name} — 모양 {shape} → {info}")
            continue
        # ★★ '+' 를 고르면 크기 슬라이더가 잠깁니다 (사용자 2026-11-02, 실측 disabled).
        #   크기를 다른 모양에서 먼저 넣고, 단면도 거기서 잽니다 — '+' 의 숫자는 0.5 처럼 작게 나옵니다.
        _unlock_size(d)
        # 단면 숫자는 모양에 달리므로 '+' 가 아니면 모양부터 고르고 잽니다
        shape = _pick_shape(d) if CONNECTOR_SHAPE != PLUS_SHAPE else ""
        # 횡단은 두 치아 폭으로 (사용자 2026-11-02 "치아 초점 보기 숫자로 크라운 폭경을 체크하고")
        teeth = _tooth_widths(d, say)
        across, tall = connector_across(teeth), connector_tall(teeth)
        _set_slider(d, "connect-size-slider-횡단", across)
        _set_slider(d, "connect-size-slider-수직", tall)
        time.sleep(1.5)
        info = " ".join((_q(d, "connect-size-info").text or "").split())
        area = connector_area(info)
        if area is not None and area < CONNECTOR_MIN_AREA:
            raise ParamError(
                f"커넥터 {name} 단면이 {area}mm² 라 사실상 안 이어집니다 — 폰틱이 옆 이보다 떠 있는지 보세요"
            )
        if CONNECTOR_SHAPE == PLUS_SHAPE:
            shape = _pick_shape(d)
            time.sleep(1.5)
        after = " ".join((_q(d, "connect-size-info").text or "").split())
        got.append(f"{name} {info}")
        say(f"커넥터 {name} — {across}·{tall}mm → {info} · 모양 {shape} → {after}")
    close_panels(d)
    return got


def connector_area(info: str) -> float | None:
    """'약함 0.1mm²' → 0.1. 숫자가 없으면 None"""
    import re  # noqa: PLC0415

    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*mm", info)
    return float(m.group(1)) if m else None


def connector_across(teeth: dict[str, dict[str, float]]) -> float:
    """두 치아의 {"폭", "교두"} → 횡단. 쌍마다 값이 하나라 작은 치아에 맞춥니다.
    교두 간격이 있으면 작은 교두 간격 + 여유, 없으면 작은 폭 × 비율, 다 못 쟀으면 CONNECTOR['횡단']."""
    # 송곳니·소구치는 봉우리가 하나라 '교두 간격' 이 0.7mm 처럼 나옵니다(43-44, 2026-11-02) — 폭의 40% 아래면 못 찾은 것
    cusps = [v["교두"] for v in teeth.values() if v.get("교두") and v["교두"] >= 0.4 * v.get("폭", 0)]
    widths = [v["폭"] for v in teeth.values() if v.get("폭")]
    if cusps:
        want = min(cusps) + CONNECTOR_CUSP_MARGIN
    elif widths:
        want = min(widths) * CONNECTOR_WIDTH_RATIO
    else:
        return CONNECTOR["횡단"]
    lo, hi = CONNECTOR_ACROSS_RANGE
    return round(min(max(want, lo), hi), 1)


def connector_tall(teeth: dict[str, dict[str, float]]) -> float:
    """두 치아의 {"높이"} → 수직. 작은 높이 × 비율, 못 쟀으면 CONNECTOR['수직']."""
    hs = [v["높이"] for v in teeth.values() if v.get("높이")]
    if not hs:
        return CONNECTOR["수직"]
    lo, hi = CONNECTOR_TALL_RANGE
    return round(min(max(min(hs) * CONNECTOR_TALL_RATIO, lo), hi), 1)


def _tooth_widths(d, say=print) -> dict[str, dict[str, float]]:
    """치아 초점 보기를 켜고 폭을 잽니다. 무슨 일이 있어도 설계를 멈추지 않고 빈 dict 를 돌려줍니다."""
    try:
        sw = _q(d, "connect-sub-renderer-switch").find_elements("css selector", "input[type=checkbox]")
        if sw and not sw[0].is_selected():
            d.execute_script("arguments[0].click()", sw[0])
            time.sleep(2.0)
        from dentbird_focus_probe import measure_teeth  # noqa: PLC0415

        return measure_teeth(d, say)
    except Exception as e:  # noqa: BLE001
        say(f"치아 폭을 못 쟀습니다 ({type(e).__name__}) — 횡단 {CONNECTOR['횡단']} 로")
        return {}


def _unlock_size(d) -> None:
    """슬라이더가 잠겨 있으면('+' 가 골라져 있으면) 첫째 모양으로 돌려 풉니다"""
    if _slider_input(d, "connect-size-slider-횡단").get_attribute("disabled") is None:
        return
    buttons = d.find_elements("css selector", '[data-testid="connect-cross-sectional-shape"] button')
    if buttons:
        d.execute_script("arguments[0].click()", buttons[0])
    for _ in range(10):
        time.sleep(0.5)
        if _slider_input(d, "connect-size-slider-횡단").get_attribute("disabled") is None:
            return
    raise ParamError("커넥터 크기 슬라이더가 잠겨 있습니다 — 첫째 모양으로 돌려도 안 풀립니다")


def _pick_shape(d) -> str:
    """단면 모양 단추를 CONNECTOR_SHAPE 번째로. 잠겨 있으면 안 건드리고 '기본' 을 돌려줍니다"""
    buttons = d.find_elements("css selector", '[data-testid="connect-cross-sectional-shape"] button')
    if len(buttons) <= CONNECTOR_SHAPE:
        return "기본(단추 부족)"
    btn = buttons[CONNECTOR_SHAPE]
    if btn.get_attribute("disabled") is not None or "Mui-disabled" in (btn.get_attribute("class") or ""):
        return "기본(잠김)"
    d.execute_script("arguments[0].click()", btn)
    time.sleep(0.8)
    return "+" if CONNECTOR_SHAPE == PLUS_SHAPE else f"{CONNECTOR_SHAPE + 1}번째"


# ================================================================ 브릿지 규칙 (2026-11-03, docs/bridge_rules.md)
#
# ★ 규칙의 원본은 docs/bridge_rules.md 입니다. 여기 숫자를 바꾸면 그 문서도 같이 고칩니다.
# ★ 근거는 사용자가 눈으로 합격시킨 4건(하악 44-46·34-36, 상악 16-17·25-27) — docs/bridge_cases.md.
# ★ 덴트버드는 다시 생성할 때마다 모양이 조금씩 달라 면적 숫자가 바뀝니다 → 고정값이 아니라 화면을 읽어 고릅니다.

#: 자연치에 닿는 유닛 — 먼저 겁니다 (나중에 건 값이 그 틈을 덮어씀)
RULE_NATURAL = -0.020
#: 양쪽 바깥이 다 자연치인 2유닛 — 나중 유닛 값이 자연치 접촉에도 걸려 여기서 멈춤 (사용자 2026-11-02 '맞컨택 -0.1')
RULE_BOTH = -0.100
#: 양쪽 자연치 2유닛인데 -0.10 에서 + 가 안 열리면(아직 안 닿음) 여기까지 더 겹쳐 봅니다 (2026-11-04 R10)
RULE_BOTH_REACH = (-0.15, -0.20, -0.25, -0.30)
#: 안쪽 유닛(폰틱·자연치 없는 끝)을 이 순서로 내려 보며 + 면적을 읽습니다. 잠기거나 줄면 한 단계 앞이 답
RULE_SWEEP = (-0.05, -0.10, -0.15, -0.20, -0.25, -0.30)
#: 처음부터 + 가 잠겨 있으면(아직 안 닿음) 이어서 더 겹쳐 봅니다 — 덴트버드 인접 조정의 끝은 -0.5 (2026-11-02 실측)
RULE_SWEEP_REACH = (-0.35, -0.40, -0.45, -0.50)
#: + 가 열려 있어도 면적이 이보다 작으면 원형으로 (44-46 의 45-46 은 어느 값에서도 0~0.3 이었음)
#: + 로 갈 최소 면적. 0.5 였다가 0.1 로 (2026-11-05) — 원형으로 간 R21·R25·R28·R31·R33 이 모두 비정상
#: ("+ 로 했으면 괜찮을 것"). 이들의 + 면적은 0.1~0.4 였습니다. 0 은 안 닿은 것이라 그때만 원형.
RULE_PLUS_MIN_AREA = 0.1
#: + 를 못 쓸 때 원형 크기 (44-46 합격값 — 중심 1mm 내림은 아직 사람 손)
RULE_CIRCLE = (4.0, 4.0)


def rule_plan(units: list[int], present: list[int]) -> tuple[list[int], list[int]]:
    """(자연치에 닿는 유닛, 안쪽 유닛). present = 화면 이름표 전부(자연치 포함)"""
    units = sorted(set(units))
    have = set(present)
    natural = [u for u in units if any(nb in have and nb not in units for nb in fdi_neighbors(u))]
    inner = [u for u in units if u not in natural]
    return natural, inner


def sweep_total(areas: dict[str, float | None]) -> float | None:
    """한 단계의 + 면적 합. 하나라도 잠겼으면 None"""
    if any(a is None for a in areas.values()):
        return None
    return round(sum(areas.values()), 3)


def _opened(areas: dict[str, float | None]) -> bool:
    return bool(areas) and all(v is not None for v in areas.values())


def sweep_should_stop(history: list[tuple[float, dict[str, float | None]]]) -> bool:
    """그만 훑을 때: **열렸던 + 가 다시 잠겼거나**, 면적 합이 앞 단계보다 줄었을 때.

    ★ 처음부터 잠겨 있는 것은 '겹침이 커서' 가 아니라 '아직 안 닿아서' 입니다 (2026-11-04 R08 하악 35-37,
      36 폰틱: -0.05 에서 두 접합이 다 잠겨 거기서 멈추고 원형으로 갔고, 사용자 "폰틱 하단부 이상, 연결부
      어색 — 면적 늘려서 + 가 나아 보여"). 이때는 멈추지 않고 더 겹쳐 봅니다.
    """
    if not history:
        return False
    now = history[-1][1]
    if not _opened(now):
        return any(_opened(a) for _, a in history[:-1])
    if len(history) >= 2 and _opened(history[-2][1]):
        if sweep_total(now) < sweep_total(history[-2][1]):
            return True
    return False


def sweep_best(history: list[tuple[float, dict[str, float | None]]]) -> float:
    """+ 가 다 열린 단계 중 면적 합이 가장 큰 값. 한 번도 다 안 열렸으면 첫 값(원형으로 감)"""
    best, best_total = history[0][0], None
    for value, areas in history:
        if not _opened(areas):
            continue
        total = sweep_total(areas)
        if best_total is None or total > best_total:
            best, best_total = value, total
    return best


def junction_choice(area: float | None) -> str:
    """'+' 또는 '원형'"""
    return "+" if area is not None and area >= RULE_PLUS_MIN_AREA else "원형"


_MERGE_JS = (
    "const root=document.querySelector('[data-testid=connect-cross-sectional-shape]'); if(!root) return null;"
    "const k=Object.keys(root).find(x=>x.startsWith('__reactFiber')); let f=root[k];"
    "for(let i=0;i<8&&f;i++){ if(f.memoizedProps&&f.memoizedProps.mergeModePossible) return f.memoizedProps.mergeModePossible; f=f.return;}"
    "return null;"
)


def _chips(d):
    return d.find_elements("css selector", '[data-testid^="connect-connector-chip-"]')


def _shape_buttons(d):
    return d.find_elements("css selector", '[data-testid="connect-cross-sectional-shape"] button')


def plus_areas(d, say=print) -> dict[str, float | None]:
    """접합마다 + 면적. + 를 못 쓰면 None. (읽으면서 각 접합을 + 로 바꿔 둡니다)"""
    close_panels(d)
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    time.sleep(2.5)
    merge = d.execute_script(_MERGE_JS) or {}
    out: dict[str, float | None] = {}
    for i in range(len(_chips(d))):
        chip = _chips(d)[i]
        name = (chip.text or "").strip()
        d.execute_script("arguments[0].click()", chip)
        time.sleep(2.0)
        btns = _shape_buttons(d)
        locked = len(btns) < 4 or btns[3].get_attribute("disabled") is not None or merge.get(name) is False
        if locked:
            out[name] = None
            continue
        d.execute_script("arguments[0].click()", btns[3])
        time.sleep(4.0)
        out[name] = connector_area(" ".join((_q(d, "connect-size-info").text or "").split()))
    close_panels(d)
    return out


def _set_slider_js(d, testid: str, value: float) -> None:
    """원형 크기 — 숨은 range 칸에 값 넣고 input/change (2026-11-03 브라우저 실측으로 먹음)"""
    d.execute_script(
        "const inp=document.querySelector(`[data-testid=\"${arguments[0]}\"] input`);"
        "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inp,String(arguments[1]));"
        "inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true}));",
        testid, value)


def set_junction(d, name: str, choice: str) -> str:
    """접합 하나를 '+' 또는 원형 4×4 로. 덴트버드가 말하는 단면 글자를 돌려줍니다"""
    close_panels(d)
    _open_tool(d, "toolbar-tool-connect", "connect-process")
    time.sleep(2.0)
    chip = next((c for c in _chips(d) if (c.text or "").strip() == name), None)
    if chip is None:
        raise ParamError(f"커넥터 {name} 칩이 없습니다")
    d.execute_script("arguments[0].click()", chip)
    time.sleep(2.0)
    btns = _shape_buttons(d)
    if choice == "+":
        d.execute_script("arguments[0].click()", btns[3])
        time.sleep(4.0)
    else:
        d.execute_script("arguments[0].click()", btns[1])
        time.sleep(1.5)
        _set_slider_js(d, "connect-size-slider-횡단", RULE_CIRCLE[0])
        _set_slider_js(d, "connect-size-slider-수직", RULE_CIRCLE[1])
        time.sleep(3.5)
    info = " ".join((_q(d, "connect-size-info").text or "").split())
    close_panels(d)
    return info


def bridge_rule(d, units: list[int], present: list[int], say=print) -> list[dict]:
    """docs/bridge_rules.md 의 3)~8). 합치기 전까지. 접합마다 {name, choice, area, info, note} 를 돌려줍니다"""
    units = sorted(set(units))
    natural, inner = rule_plan(units, present)
    history: list[tuple[float, dict[str, float | None]]] = []

    def put(tooth: int, value: float) -> None:
        # ★ 같은 이를 열 번 넘게 잘 고르다 한 번 '도구 막대가 안 뜸' 으로 멈춘 일이 있습니다 (2026-11-03 밤작업 H07).
        #   패널을 닫고 잠깐 쉬었다가 두 번까지 다시 합니다.
        for attempt in range(3):
            try:
                select_tooth(d, tooth)
                set_proximal(d, value, say=lambda m: say(f"  {tooth}: {m}"))
                return
            except ParamError:
                if attempt == 2:
                    raise
                say(f"  {tooth}: 고르기 실패 — 패널을 닫고 다시")
                close_panels(d)
                time.sleep(4)

    if not inner:
        # 양쪽 바깥이 다 자연치 — 앞 유닛 -0.02, 뒤 유닛 -0.10 에서 멈춤
        first, last = units[0], units[-1]
        put(first, RULE_NATURAL)
        put(last, RULE_BOTH)
        history.append((RULE_BOTH, plus_areas(d, say)))
        best = RULE_BOTH
        say(f"양쪽 자연치 2유닛 — {first} {RULE_NATURAL:+.2f} → {last} {RULE_BOTH:+.2f} · + 면적 {history[-1][1]}")
        # ★ -0.10 에서 + 면적이 기준 아래면(R10 상악 15-16: 0.0 → 원형으로 가 사용자 "+ 가 깔끔") 더 겹쳐 봅니다.
        #   뒤 유닛 값이 자연치 접촉에도 걸리므로 그쪽이 0.05 씩 더 조여집니다 — 검토표에 적습니다.
        if sweep_total(history[-1][1]) is not None and sweep_total(history[-1][1]) < RULE_PLUS_MIN_AREA:
            for value in RULE_BOTH_REACH:
                put(last, value)
                history.append((value, plus_areas(d, say)))
                say(f"양쪽 자연치 — {last} {value:+.2f} · + 면적 {history[-1][1]}")
                if sweep_should_stop(history) or sweep_total(history[-1][1]) >= RULE_PLUS_MIN_AREA:
                    break
            best = sweep_best(history)
            if history[-1][0] != best:
                put(last, best)
            say(f"고른 값: {last} {best:+.2f} (자연치 접촉도 같이 조여짐)")
    else:
        for u in natural:
            put(u, RULE_NATURAL)
        for value in RULE_SWEEP + RULE_SWEEP_REACH:
            # ★ -0.30 을 넘어서는 것은 그때까지 한 번도 + 가 안 열렸을 때만 (아직 안 닿은 폰틱 자리)
            if value in RULE_SWEEP_REACH and any(_opened(a) for _, a in history):
                break
            for u in inner:
                put(u, value)
            history.append((value, plus_areas(d, say)))
            say(f"안쪽 {inner} {value:+.2f} → + 면적 {history[-1][1]}")
            if sweep_should_stop(history):
                break
        best = sweep_best(history)
        if history[-1][0] != best:
            for u in inner:
                put(u, best)
        say(f"고른 값: 안쪽 {inner} {best:+.2f}")
    final = next(a for v, a in history if v == best)
    report = []
    for name, area in final.items():
        choice = junction_choice(area)
        info = set_junction(d, name, choice)
        note = ""
        if choice == "원형":
            note = ("연결부가 안 닿음(+ 면적 0) — 사람이 봐 주세요" if area == 0
                    else "+ 를 못 씀(잠김) — 원형, 사람이 봐 주세요")
        elif area is not None and area < 1.0:
            note = "+ 면적이 작음 — 목이 얇을 수 있음"
        report.append({"name": name, "choice": choice, "area": area, "info": info, "note": note})
        say(f"커넥터 {name}: {choice} ({info}) {note}")
    report.append({"name": "_sweep", "best": best, "history": history, "natural": natural, "inner": inner,
                   "note": "양쪽 자연치 접촉이 -0.10 보다 조여짐 — 인접 접촉을 봐 주세요" if (not inner and best < RULE_BOTH) else ""})
    return report
