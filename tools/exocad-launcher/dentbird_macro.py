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
    상태 목록                     "크라운 24 / 감지됨" ← **치식을 여기서 다 셉니다**
    preset-select                "Preset - 3D Printing"
    workspace-preparation-design-btn   설계 화면으로
    generate-crown-btn           생성 (도는 동안 '디자인 준비 중 …%')
    "AI 디자인 생성 완료"           끝났다는 말 · 크라운 셋에 3분
    viewer-dialog-export-button  내보내기 (케이스 목록에서)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from dentbird_web import attach, alive  # noqa: E402
from dentbird_params import ParamError, apply_each  # noqa: E402

CROWN_URL = "https://ai.dentbird.com/crown/new-crown"

#: 화면이 바뀌기를 기다리는 한도. AI 분석이 제일 깁니다
WAIT_SECONDS = 300
#: 설계값을 고친 뒤 내보내기 단추가 풀리기를 기다리는 한도
EXPORT_UNLOCK_SECONDS = 120
STEP = 5


class Stop(Exception):
    """사람이 봐야 하는 자리. 조용히 넘어가지 않습니다"""


class SessionLost(Stop):
    """덴트버드 창 자체가 못 쓰는 상태 — 로그인 풀림·다른 곳 로그인·오류 화면

    ★ 이 주문 탓이 아닙니다 (2026-10-16 점검). 주문을 '확인 중' 으로 세우면 들어오는
      FlowTemp 가 전부 하나씩 멈춥니다. 일꾼은 일감을 **내려놓고** 창이 돌아올
      때까지 쉽니다.
    """


#: 덴트버드 창이 못 쓰는 상태라는 표시들 (실제로 본 것, 2026-10-15)
SESSION_SIGNS = (
    ("Multiple login detected", "다른 곳에서 같은 계정으로 로그인해 이 창이 끊겼습니다"),
    # ★ 같은 창의 한국어판 (2026-10-16 아침에 실제로 뜸)
    ("새 로그인 시도가 감지되었습니다", "다른 기기에서 같은 덴트버드 계정으로 로그인했습니다 — 전용 창에서 다시 로그인해 주세요"),
    ("An unknown error has occurred", "덴트버드가 오류 화면을 띄웠습니다"),
)


def session_problem(d) -> str | None:
    """창이 못 쓰는 상태면 그 까닭, 멀쩡하면 None"""
    try:
        body = text(d)
        url = d.current_url.lower()
    except Exception as e:  # noqa: BLE001 — 창에 못 붙는 것도 같은 문제입니다
        return f"덴트버드 창에 붙지 못했습니다 — {e}"
    return session_problem_of(url, body)


def session_problem_of(url: str, body: str) -> str | None:
    """주소와 글자만으로 — 붙지 않고 읽은 것에도 씁니다 (2026-10-23)"""
    url = url.lower()
    for sign, why in SESSION_SIGNS:
        if sign in body:
            return why
    if "accounts-highdental" in url or "login" in url or "로그인" in body:
        return "덴트버드 로그인이 풀렸습니다 — 전용 창에서 한 번 로그인해 주세요"
    return None


DESIGN_SETTINGS = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "design_agent.json"


class Reporter:
    """주문 화면에 '설계 어디까지 왔는지' 를 적습니다 (2026-10-15)

    ★★ 치과가 설계 중인지 몰랐습니다 ("새로고침을 해야 보이고"). STL 이
      올라오기 전까지 서버에 아무 기록이 없었기 때문입니다. 단계를 넘을
      때마다 한 줄씩 적고, 서버의 표가 바뀌면 주문 화면이 저절로 넘어갑니다.
    ★ **못 적어도 설계는 계속합니다.** 화면 표시는 덤이고, 설계가 본업입니다.
      서버가 잠깐 안 닿는다고 크라운을 멈추면 거꾸로입니다.
    ★ 주문 id 가 없으면(손으로 돌릴 때) 아무것도 안 합니다.
    """

    def __init__(self, order_id: str | None, say=print):
        self.order_id = order_id
        self.say = say
        self.base = ""
        self.token = ""
        if not order_id:
            return
        try:
            cfg = json.loads(DESIGN_SETTINGS.read_text(encoding="utf-8"))
            self.base = cfg.get("base_url", "https://denflow.kr").rstrip("/")
            self.token = cfg.get("token") or ""
        except (OSError, ValueError):
            pass
        if not self.token:
            say(f"(설계 PC 열쇠가 없어 진행을 못 적습니다 — {DESIGN_SETTINGS})")

    def __call__(self, stage: str, note: str | None = None) -> None:
        got = self._send(stage, note)
        if got is not None and not got.get("ok"):
            self.say(f"(진행을 못 적었습니다: {got.get('error')})")

    def still_designing(self) -> bool:
        """아직 디자인 차례인가 — 지켜보기가 STL 을 올리면 서버가 아니라고 답합니다

        ★ '마무리' 를 다시 적어 보는 것으로 묻습니다. 적히면 아직 디자인 차례이고,
          묻는 김에 잡은 표시(updated_at)도 새로 둡니다 — 서버가 30분 묵은 일감으로
          보고 다른 일꾼에게 또 내주지 않게.
        ★ 서버에 못 닿으면 '아직' 으로 봅니다. 섣불리 '끝났다' 고 하지 않습니다.
        """
        got = self._send("exporting", None)
        if got is None:
            return False
        if got.get("ok"):
            return True
        return "디자인 차례" not in str(got.get("error", ""))

    def release(self) -> bool:
        """잡은 일감을 내려놓습니다 — 다음 바퀴에 다시 잡게 (2026-10-16 점검)"""
        got = self._send("", None, release=True)
        return bool(got and got.get("ok"))

    def _send(self, stage: str, note: str | None, release: bool = False) -> dict | None:
        if not (self.order_id and self.token):
            return None
        body = {"orderId": self.order_id, "release": True} if release else {
            "orderId": self.order_id, "stage": stage, "note": note}
        req = urllib.request.Request(
            f"{self.base}/api/device/auto-print/stage",
            data=json.dumps(body).encode("utf-8"),
            headers={"content-type": "application/json", "authorization": f"Bearer {self.token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                got = json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            try:
                got = json.loads(e.read().decode("utf-8", "replace"))
            except (ValueError, OSError):
                got = {"ok": False, "error": f"서버가 {e.code} 로 답했습니다"}
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            got = {"ok": False, "error": f"서버에 닿지 못했습니다 — {e}"}
        return got


def text(d) -> str:
    return d.execute_script("return document.body.innerText || '';")


def wait_gone(d, word: str, why: str) -> None:
    """그 말이 사라질 때까지. 안 사라지면 멈춥니다"""
    for _ in range(WAIT_SECONDS // STEP):
        if word not in text(d):
            return
        time.sleep(STEP)
    raise Stop(f"{why} — '{word}' 가 {WAIT_SECONDS}초 넘게 그대로입니다")


def dismiss(d) -> None:
    """떠 있는 알림창의 '확인' 을 닫습니다. 없으면 아무 일도 안 합니다"""
    d.execute_script(
        "const b=[...document.querySelectorAll('button')]"
        ".filter(e=>(e.innerText||'').trim()==='확인');"
        "if(b.length) b[b.length-1].click();"
    )


def click(d, testid: str) -> None:
    els = d.find_elements("css selector", f"[data-testid={testid}]")
    if not els:
        raise Stop(f"단추를 못 찾았습니다: {testid}")
    els[0].click()


#: 분류를 기다리는 한도. 17MB 스캔이 4분 걸린 날이 있어 넉넉히 둡니다
CLASSIFY_SECONDS = 480


def upload_and_classify(d, scans: list[Path], say=print) -> None:
    """스캔을 올리고 덴트버드가 상·하악을 가를 때까지. 두 번까지 해 봅니다

    ★★★ **덴트버드가 아무 말 없이 파일을 내려놓는 날이 있습니다**
      (2026-10-15, 윤기두 17MB). '분류하고 있습니다' 를 13분 붙잡고 있다가
      화면이 처음('파일을 끌어다 놓으세요')으로 돌아갔습니다. 오류 창도 없었습니다.
      같은 스캔이 한 시간 전에는 4분 만에 됐습니다. 시간만 재면 '안 끝난다'
      로만 보여서, 무엇이 일어났는지 모릅니다 — 처음 화면으로 **돌아왔는지**를
      따로 봅니다.
    ★ 올린 직후에는 아직 '분류' 말이 안 떠서 처음 화면처럼 보입니다. 한 번이라도
      '분류하고 있습니다' 를 본 뒤에 처음 화면으로 돌아와야 내려놓은 것입니다.
    """
    for attempt in (1, 2):
        d.find_element("css selector", "input[type=file]").send_keys(
            "\n".join(str(p) for p in scans)
        )
        busy_seen = False
        for _ in range(CLASSIFY_SECONDS // STEP):
            t = text(d)
            if "상악" in t or "하악" in t:
                return  # 갈랐습니다
            if "분류하고 있습니다" in t:
                busy_seen = True
            elif busy_seen and "끌어다 놓으세요" in t:
                break  # 내려놓았습니다
            time.sleep(STEP)
        else:
            raise Stop(f"스캔 분류가 {CLASSIFY_SECONDS}초 넘게 안 끝납니다")

        if attempt == 1:
            say("덴트버드가 분류하다 파일을 내려놓았습니다 — 한 번 더 올립니다")
            time.sleep(5)

    raise Stop("덴트버드가 두 번 다 분류하다 파일을 내려놓았습니다 — 스캔을 봐 주세요")


def detected_teeth(d) -> list[int]:
    """화면이 말하는 치식 **전부**. 못 읽으면 빈 목록

    ★★★ **하나만 읽으면 안 됩니다** (2026-10-14 에 겪음).
      `…tooth-info-setter` 칸에는 **맨 앞 하나**만 적힙니다. 실제로는
      24·25·26 세 개짜리 케이스였는데 그 칸은 "크라운 24" 만 보여 줬습니다.
      그걸 믿었으면 **세 개짜리를 한 개짜리 주문으로 통과**시켰을 겁니다 —
      나머지 둘은 영영 안 나오고, 치과는 하나만 받습니다.
    ★ 상태 목록에 "크라운 24 / 감지됨" 처럼 하나씩 적힙니다. 화면 글
      전체에서 그 꼴을 다 긁습니다.
    """
    return sorted({int(n) for n in re.findall(r"크라운\s*([1-4][1-8])\b", text(d))})


# ---------------------------------------------------------------- 브릿지 (2026-10-28 실측)
#
# 덴트버드에 'Bridge' 유형은 없습니다. Crown 케이스 안에서
#   ① 결손 자리 이름표 → 유형 '폰틱' → 적용
#   ② 이웃한 보철 사이의 링크 단추 → 적용   (setter 글이 "브릿지 25-27" 로 바뀜)
#   ③ 생성 → 크라운마다 설계값 → 합치기(assemble) → 내보내기(항목이 "브릿지 25-27" 하나)
# 순서로 만듭니다. 화면 이름은 memory/ds-flow-dentbird-bridge.md 에 실측 그대로.

#: 합치기가 끝나 '조립됨' 이 뜰 때까지 기다리는 한도 (실측 10초)
ASSEMBLE_SECONDS = 90
#: 내보내기 창이 뜰 때까지 — 브릿지는 '내보내기 처리 중...' 이 20초를 넘겼습니다
EXPORT_OPEN_SECONDS = 75


def bridge_span(units: list[int]) -> str:
    """덴트버드가 붙이는 브릿지 이름의 숫자 — '25-27' (가장 작은 번호-가장 큰 번호)"""
    return f"{min(units)}-{max(units)}"


def generation_done(body: str, units: int) -> bool:
    """생성이 **다** 끝났는가.

    ★★ '생성됨' 하나만 보면 안 됩니다 (2026-10-28 실측). 크라운 둘을 생성할 때 "크라운 26
      생성됨 · 크라운 27 생성됨" 이 적힌 채로 아직 "생성 중... 95%" 가 돌고 있었습니다.
      유닛 수만큼 '생성됨' 이 있고, '준비 중/생성 중' 이 사라져야 끝입니다.
    """
    if "생성 완료" in body:
        return True
    if re.search(r"준비 중|생성 중", body):
        return False
    return len(re.findall(r"생성됨", body)) >= max(1, units)


def _click_label(d, number: int) -> bool:
    """3D 화면의 치아 이름표(글이 치식)를 누릅니다. 없으면 False"""
    return bool(d.execute_script(
        "const l=[...document.querySelectorAll('[data-testid=component-floating-label-button]')]"
        ".find(e=>(e.innerText||'').trim()===String(arguments[0]));"
        "if(!l) return false; l.click(); return true;", number))


def mark_pontics(d, pontics: list[int], say=print) -> None:
    """결손 자리를 폰틱으로 찍습니다 — 이름표 → '폰틱' → 적용.

    ★ 찍으면 "폰틱 기준점 설정"(빨간 점을 결손 부위로 옮기라는 안내) 이 뜹니다. 3D 드래그라
      기계는 못 옮기고 닫기만 합니다 — 덴트버드가 놓은 기본 자리로 갑니다. 이 자리가 틀리면
      폰틱이 엉뚱한 데 섭니다. 첫 실전 케이스들은 사람이 결과를 봐야 합니다.
    ★ 이름표가 없는 자리(AI 가 결손치로 잡아 이름표를 안 단 경우)는 멈춥니다 — 아직 못 본 경우.
    """
    for n in pontics:
        if not _click_label(d, n):
            raise Stop(f"폰틱 자리 {n} 의 이름표가 화면에 없습니다 — 결손 자리는 사람이 찍어 주세요")
        time.sleep(1.5)
        click(d, "tooth-planning-type-pontic")
        time.sleep(0.8)
        click(d, "tooth-planning-apply-btn")
        time.sleep(3)
        d.execute_script(
            "document.querySelector('[data-testid=pontic-guide-close-btn]')?.click();"
            "document.querySelector('[data-testid=tooth-planning-close-btn]')?.click();")
        time.sleep(0.8)
        if f"폰틱 {n}" not in text(d):
            raise Stop(f"폰틱 {n} 이 안 찍혔습니다 — 화면을 봐 주세요")
        say(f"폰틱 {n} 으로 찍었습니다")


def link_bridge(d, units: list[int], say=print) -> None:
    """이웃한 보철을 전부 잇고, setter 글이 '브릿지 a-b' 인지 확인합니다.

    ★ 링크 단추는 **'적용' 까지** 눌러야 반영됩니다 (토글만 누르면 패널만 뜸).
    ★ 유닛이 n 개면 단추는 n-1 개. 그보다 많으면 주문에 없는 보철이 화면에 있는 것이라
      setter 글이 달라져 멈춥니다.
    """
    span = bridge_span(units)
    for _ in range(len(units)):
        classes = d.execute_script(
            "return [...document.querySelectorAll('[data-testid=bridge-link-toggle-btn]')]"
            ".map(b=>b.querySelector('svg')?.className.baseVal||'')")
        idx = next((i for i, c in enumerate(classes) if "unlink" in c), None)
        if idx is None:
            break
        d.execute_script(
            "document.querySelectorAll('[data-testid=bridge-link-toggle-btn]')[arguments[0]].click()", idx)
        time.sleep(1.5)
        click(d, "bridge-link-panel-apply-btn")
        time.sleep(2.5)
    setter = d.execute_script(
        "return document.querySelector('[data-testid=workspace-preparation-tooth-info-setter]')?.innerText||''")
    if f"브릿지 {span}" not in setter:
        raise Stop(f"브릿지 {span} 로 안 묶였습니다 — 화면: {' '.join(setter.split())[:80]}")
    say(f"브릿지 {span} 로 묶었습니다")


def assemble(d, abutments: list[int], units: list[int], say=print) -> None:
    """생성된 크라운·폰틱을 한 덩어리로 합칩니다 — 툴바의 '합치기'.

    ★ 합치기 단추는 **크라운을 하나 고른 뒤에만** 툴바에 뜹니다.
    ★ 합친 뒤에는 내면·교합 조정이 잠깁니다 — 설계값은 이 **앞에서** 넣습니다.
    """
    from dentbird_params import ParamError, select_tooth, set_connectors  # noqa: PLC0415

    span = bridge_span(units)
    # ★ 커넥터 크기는 합치기 **전**에 — 기본 5·5 는 폰틱 쪽에서 2mm² 로 주름만 남겼습니다 (2026-10-30)
    try:
        select_tooth(d, abutments[0])
        set_connectors(d, say)
    except ParamError as e:
        raise Stop(f"커넥터 크기를 못 넣었습니다 — {e}") from e
    for attempt in range(3):
        try:
            select_tooth(d, abutments[0])
            click(d, "toolbar-assemble-btn")
        except (Stop, ParamError) as e:
            if attempt == 2:
                raise Stop(f"합치기 단추를 못 눌렀습니다 — {e}") from e
            time.sleep(3)
            continue
        for _ in range(ASSEMBLE_SECONDS // 2):
            time.sleep(2)
            if "조립됨" in text(d):
                say(f"브릿지 {span} 를 합쳤습니다")
                return
        raise Stop(f"합치기를 눌렀는데 {ASSEMBLE_SECONDS}초 안에 '조립됨' 이 안 뜹니다")


def run(scans: list[Path], want: list[int], say=print, mark=lambda stage, note=None: None,
        pontics: list[int] | None = None) -> bool:
    """올리기 → 분석 → 치식 대조 → (폰틱·링크) → 생성.

    want 는 **지대치(덴트버드가 크라운으로 잡는 이)** 만. 폰틱은 pontics 로 따로 —
    AI 는 결손 자리를 크라운으로 잡지 않으므로 대조에 넣으면 늘 틀립니다.
    """
    pontics = sorted(pontics or [])
    units = sorted(set(want) | set(pontics))
    if not alive():
        raise Stop("덴트버드 창이 안 떠 있습니다 — dentbird_web.py 로 띄우고 로그인해 주세요")

    d = attach()
    say("새 크라운 케이스를 엽니다")
    d.get(CROWN_URL)
    time.sleep(5)

    why = session_problem(d)
    if why:
        raise SessionLost(why)

    say(f"스캔 {len(scans)}개를 올립니다")
    mark("uploading")
    upload_and_classify(d, scans, say)

    say("다음 — AI 분석을 기다립니다 (몇 분 걸립니다)")
    mark("analyzing")
    click(d, "import-next-btn")
    wait_gone(d, "분석하고 있습니다", "AI 분석이 안 끝납니다")

    got = detected_teeth(d)
    say(f"덴트버드가 잡은 치식: {got or '못 읽음'}")

    # ★★★ 여기가 이 매크로의 핵심입니다. 넘어가지 않습니다.
    if not got:
        raise Stop("치식을 못 읽었습니다 — 화면을 보고 사람이 확인해 주세요")
    if sorted(got) != sorted(want):
        raise Stop(f"치식이 주문서와 다릅니다 — 주문서 {want} · 덴트버드 {got}")

    # ★ 브릿지 — 폰틱을 찍고 이웃을 잇습니다. 싱글 하나면 아무것도 안 합니다.
    #   ★ 이 화면에서 '뒤로가기(Smart order)' 로 돌아오면 묶음이 풀립니다 (실측) —
    #     돌아올 일이 생기면 여기부터 다시 해야 합니다.
    if len(units) > 1:
        # (서버의 단계 이름은 uploading·analyzing·generating·exporting 뿐 — 여기는 analyzing 그대로)
        mark_pontics(d, pontics, say)
        link_bridge(d, units, say)

    retried = False

    say("설계 화면으로 넘어갑니다")
    click(d, "workspace-preparation-design-btn")
    time.sleep(6)

    # ★ 넘어간 화면에서 **다시** 셉니다. 여기 상태 목록이 치아를 다 보여 줍니다
    again = detected_teeth(d)
    if again and sorted(again) != sorted(want):
        raise Stop(f"설계 화면의 치식이 다릅니다 — 주문서 {want} · 덴트버드 {again}")

    # ★★ **화면이 다 뜨기 전에는 눌러도 안 먹습니다** (2026-10-14 에 겪음).
    #   단추는 멀쩡한데(`disabled` 아님) 위에 뭐가 덮여 있어 클릭이 가로막힙니다.
    #   한 번 실패했다고 포기하면 "눌렀는데 아무 일도 안 일어난다" 가 됩니다 —
    #   그 자리를 오늘 4분 헤맸습니다. 먹을 때까지 몇 번 더 눌러 봅니다.
    say("생성을 누릅니다")
    mark("generating")
    for attempt in range(6):
        try:
            click(d, "generate-crown-btn")
            time.sleep(6)
            if "준비 중" in text(d) or "생성됨" in text(d):
                break
        except Exception:  # noqa: BLE001 — 가로막힌 것뿐입니다
            pass
        time.sleep(10)
    else:
        raise Stop("생성 단추가 안 먹습니다 — 화면을 봐 주세요")

    # ★ 끝났다는 말은 '생성됨'(한 개) 또는 'AI 디자인 생성 완료' 입니다.
    #   도는 동안은 '디자인 준비 중 … %' 가 떠 있습니다 (실측 2026-10-14).
    #   싱글 크라운 하나에 **2분 40초**, 셋에 3분이었습니다.
    # ★ 유닛(지대치+폰틱)이 여럿이면 **전부** '생성됨' 이고 '생성 중' 이 없어야 끝입니다
    for _ in range(WAIT_SECONDS // STEP):
        body = text(d)
        if generation_done(body, len(units)):
            say("생성 끝났습니다")
            return True
        # ★★ 덴트버드가 **그냥 실패하는 날이 있습니다.** "알 수 없는 오류" 라고만
        #   합니다 (2026-10-14, 크라운 16). 한 번 더 하면 되는 일이 많아서
        #   조용히 포기하지 않고 창을 닫고 한 번 다시 겁니다. 그래도 안 되면
        #   사람을 부릅니다 — 두 번 틀리면 스캔 쪽 문제일 수 있습니다.
        if "생성 실패" in body:
            if retried:
                raise Stop("덴트버드가 두 번 실패했습니다 — 스캔을 봐 주세요")
            say("덴트버드가 실패했습니다 — 한 번 더 겁니다")
            dismiss(d)
            retried = True
            time.sleep(4)
            click(d, "generate-crown-btn")
        time.sleep(STEP)

    raise Stop(f"{WAIT_SECONDS}초가 지나도 생성이 안 끝납니다")


def downloads_allowed() -> bool:
    """전용 프로필이 ai.dentbird.com 의 '여러 파일 다운로드' 를 허락했나

    ★★ 안 했으면 크롬이 **첫 파일(크라운)만** 받고 나머지(정보 파일)를 막습니다
      (2026-10-15 에 겪음). 정보 파일이 없으면 CAM 축 정렬을 대조하지 못합니다.
      조용히 크라운만 떨어지게 두지 않고, 내보내기 전에 봅니다.
    """
    import json  # noqa: PLC0415
    import os  # noqa: PLC0415

    pref = (Path(os.environ.get("APPDATA", "")) / "DenFlow" / "launcher"
            / "chrome-dentbird" / "Default" / "Preferences")
    try:
        d = json.loads(pref.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    ex = (d.get("profile", {}).get("content_settings", {})
          .get("exceptions", {}).get("automatic_downloads", {}))
    return any("ai.dentbird.com" in k and v.get("setting") == 1 for k, v in ex.items())


#: 내보내기 창 안에서 설정을 읽고, 맞으면 '내보내기' 를 누릅니다
EXPORT_JS = """
const t = s => (s || '').replace(/\\s+/g, ' ').trim();
// 스위치는 글자 옆에 있습니다 — 그 줄을 찾아 안의 checkbox 를 봅니다
const near = label => {
  const row = [...document.querySelectorAll('div,label')]
    .filter(e => t(e.innerText).startsWith(label) && t(e.innerText).length < 80)
    .sort((a, b) => t(a.innerText).length - t(b.innerText).length)[0];
  const box = row && (row.querySelector('input[type=checkbox]')
              || row.parentElement && row.parentElement.querySelector('input[type=checkbox]'));
  return box ? box.checked : null;
};
const cam = near('CAM 축에 좌표 정렬');
const zip = near('ZIP으로 압축');
const crowns = (t(document.body.innerText).match(/크라운 ([1-4][1-8])/g) || []).map(s => +s.slice(-2));
// ★ 브릿지는 항목이 "브릿지 25-27" 하나입니다 (2026-10-28 실측) — 크라운 글이 없습니다
const bridges = (t(document.body.innerText).match(/브릿지 ([1-4][1-8])-([1-4][1-8])/g) || []).map(s => s.replace('브릿지 ', ''));
const btn = [...document.querySelectorAll('button')]
  .filter(b => t(b.innerText).includes('내보내기') && !t(b.innerText).includes('소프트웨어'))
  .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
// ★★ 숫자를 **통째로** 읽습니다 (2026-10-26) — 전에는 '한 자리/3' 이라 유료 플랜의 '30/30' 에서
//   가운데 '0/3' 을 잘라 읽고 남은 건수 0 으로 멈췄습니다. 무제한이면 숫자가 없어 null → 누릅니다
const quota = t(document.body.innerText).match(/(\\d+)\\s*\\/\\s*(\\d+)/) || [];
const left = quota[1];
const total = quota[2];
// ★ '차감 N' — 이번 내보내기에 쓸 건수. 이미 내보낸 크라운을 다시 내보내면 0 입니다 (2026-10-16 실측)
const cost = (t(document.body.innerText).match(/차감\\s*(\\d+)/) || [])[1];
const room = (cost !== undefined && +cost === 0) || left === null || left === undefined || +left > 0;
if (arguments[0] && cam === true && zip === false && btn && room) btn.click();
return { cam, zip, crowns: [...new Set(crowns)], bridges: [...new Set(bridges)], left: left !== undefined ? +left : null, total: total !== undefined ? +total : null, cost: cost !== undefined ? +cost : null, clicked: !!(arguments[0] && cam === true && zip === false && btn && room) };
"""


def export(d, want: list[int], spend: bool, say=print, units: list[int] | None = None) -> bool:
    """내보내기 창을 열고, 설정을 확인하고, spend 면 누릅니다

    ★★ **이 한 번이 돈입니다** (Free 월 3건). 그래서 `spend` 를 따로 받습니다 —
      주지 않으면 창을 열어 설정만 확인하고 **누르지 않습니다.**
    ★★ 창이 **iframe 안**에 있습니다. 바깥 문서에서는 '데이터 선택' 이 안
      보이고, 위쪽 '내보내기' 단추가 iframe 에 가려 눌리지도 않습니다
      (2026-10-15, 이걸 모르고 위쪽 단추를 눌러 창을 닫아 버렸습니다).
    ★ units 를 주면(지대치+폰틱, 둘 이상) 브릿지로 봅니다 — 창의 항목이 "브릿지 a-b" 하나여야
      하고, 차감은 유닛 수만큼입니다 (3유닛 = 3건, 2026-10-28 실측).
    """
    span = bridge_span(units) if units and len(units) > 1 else None
    if spend and not downloads_allowed():
        raise Stop("전용 크롬에서 ai.dentbird.com 의 '여러 파일 다운로드' 를 허용해 주세요 "
                   "— 안 하면 크라운만 오고 정보 파일이 막힙니다")

    # ★★ 설계값을 고친 뒤에는 덴트버드가 **뒤에서 계산을 마무리하는 동안**
    #   내보내기 단추를 잠가 둡니다 (2026-10-15 실측 — 18초). 진행 표시도 안
    #   뜹니다. 풀릴 때까지 기다립니다.
    for _ in range(EXPORT_UNLOCK_SECONDS):
        if not d.execute_script(
            "return !!document.querySelector('[data-testid=appbar-export-btn]')?.disabled"
        ):
            break
        time.sleep(1)
    else:
        raise Stop(f"내보내기 단추가 {EXPORT_UNLOCK_SECONDS}초 동안 잠겨 있습니다 — 덴트버드 화면을 봐 주세요")

    # ★ 창은 '내보내기 처리 중...' 을 거쳐 뜹니다 — 브릿지는 20초를 넘겼습니다 (2026-10-28).
    #   처리 중일 때는 다시 누르지 않고 기다립니다.
    deadline = time.time() + EXPORT_OPEN_SECONDS
    frame = None
    while time.time() < deadline:
        if "처리 중" not in text(d):
            try:
                click(d, "appbar-export-btn")
            except Exception:  # noqa: BLE001 — 가려져 있으면 다시
                pass
        time.sleep(4)
        frame = _export_frame(d)
        if frame is not None:
            break
    if frame is None:
        raise Stop(f"내보내기 창이 {EXPORT_OPEN_SECONDS}초 안에 안 열립니다")

    d.switch_to.frame(frame)
    try:
        got = d.execute_script(EXPORT_JS, spend)
    finally:
        d.switch_to.default_content()

    say(f"내보내기 창 — CAM 정렬 {got['cam']} · ZIP {got['zip']} · "
        f"치식 {got['crowns']} · 브릿지 {got.get('bridges')} · 남은 횟수 {got['left']}/{got.get('total')} · 이번 차감 {got.get('cost')}")

    if got["cam"] is not True:
        raise Stop("「CAM 축에 좌표 정렬」 이 꺼져 있거나 못 읽었습니다 — 켜야 고정 각도가 통합니다")
    if got["zip"] is not False:
        raise Stop("「ZIP으로 압축」 이 켜져 있거나 못 읽었습니다 — 지켜보기는 낱개 파일을 봅니다")
    if span:
        if got.get("bridges") != [span]:
            raise Stop(f"내보낼 브릿지가 주문서와 다릅니다 — 주문서 브릿지 {span} · 창 {got.get('bridges')} / 크라운 {got['crowns']}")
    elif got["crowns"] and sorted(got["crowns"]) != sorted(want):
        raise Stop(f"내보낼 크라운이 주문서와 다릅니다 — 주문서 {want} · 창 {got['crowns']}")

    if not spend:
        say("설정은 맞습니다. 건수를 쓰는 자리라 여기서 멈춥니다 (--export 로 누름)")
        return False
    # ★ 남은 건수가 0 이면 누르지 않습니다 (2026-10-15). 눌러 봐야 요금제 창이
    #   뜨거나 아무 일도 없고, 일꾼은 STL 을 하염없이 기다립니다.
    # ★ 단, 이번 차감이 0 이면(이미 내보낸 크라운 다시 내보내기) 남은 건수와 상관없이 됩니다
    if got.get("cost") != 0 and got["left"] is not None and str(got["left"]).strip() in ("0", "0.0"):
        raise Stop(f"이번 달 덴트버드 내보내기 건수가 없습니다 (0/{got.get('total')}) — 요금제를 봐 주세요")
    if not got["clicked"]:
        raise Stop("내보내기 단추를 못 눌렀습니다")
    say("내보내기를 눌렀습니다 — 내려받기 폴더로 떨어집니다")
    return True


def _export_frame(d):
    for f in d.find_elements("css selector", "iframe"):
        try:
            d.switch_to.frame(f)
            if "데이터 선택" in (d.execute_script("return document.body && document.body.innerText") or ""):
                return f
        except Exception:  # noqa: BLE001
            pass
        finally:
            d.switch_to.default_content()
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="덴트버드에 스캔을 올리고 설계·내보내기까지 합니다")
    ap.add_argument("scans", nargs="+", type=Path)
    ap.add_argument("--teeth", required=True, help="주문서 치식 — 지대치만 (예: 27 또는 24,26)")
    ap.add_argument("--pontics", default="", help="폰틱 치식 (예: 25) — 주면 브릿지로 만듭니다")
    ap.add_argument("--order", help="주문 id — 주면 진행을 주문 화면에 적습니다")
    ap.add_argument("--export", action="store_true",
                    help="내보내기를 실제로 누릅니다 — 덴트버드 건수를 하나 씁니다")
    args = ap.parse_args()

    want = [int(x) for x in re.findall(r"\d+", args.teeth)]
    pontics = [int(x) for x in re.findall(r"\d+", args.pontics)]
    units = sorted(set(want) | set(pontics))
    missing = [p for p in args.scans if not p.is_file()]
    if missing:
        print("없는 파일:", ", ".join(str(p) for p in missing))
        return 1

    mark = Reporter(args.order)
    t0 = time.time()
    try:
        run(args.scans, want, mark=mark, pontics=pontics)
        # ★ 설계값 고정 — 내면 · 교합/인접(모양 유지) · 최소 두께 (사용자 결정 2026-10-15).
        #   못 넣으면 **내보내지 않습니다.** 값이 빠진 크라운이 치과에서 뽑히면 안 됩니다.
        #   브릿지는 지대치마다 — 합치기 전에 (합치면 패널이 잠깁니다).
        print("설계값을 맞춥니다 — 내면 · 교합/인접 · 최소 두께")
        try:
            apply_each(attach(), want)
        except ParamError as e:
            raise Stop(f"설계값을 못 맞췄습니다 — {e}") from e
        if len(units) > 1:
            assemble(attach(), want, units)
        # ★ 내보내기를 실제로 누를 때만 '마무리' — 설정만 보고 멈추는 시험은 아직 설계 중입니다
        if args.export:
            mark("exporting")
        export(attach(), want, args.export, units=units)
    except Stop as e:
        print(f"멈춤: {e}  (+{int(time.time() - t0)}초)")
        mark("stalled", str(e))
        return 1
    print(f"끝 (+{int(time.time() - t0)}초)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
