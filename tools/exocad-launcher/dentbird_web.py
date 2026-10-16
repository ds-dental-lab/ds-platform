# -*- coding: utf-8 -*-
r"""덴트버드 전용 크롬을 띄웁니다 (2026-10-14).

    python dentbird_web.py          띄웁니다 (사람이 한 번 로그인)
    python dentbird_web.py read     지금 떠 있는 화면의 구조를 읽습니다
    python dentbird_web.py shot     화면을 그림으로 뜹니다

★★ **비밀번호를 어디에도 안 적습니다.** 전용 프로필을 하나 두고 사장님이
  **거기서 한 번만 손으로** 로그인하시면, 세션이 그 폴더에 남아 다음부터
  매크로가 그대로 씁니다. DS Core 쪽(dscore.py)은 settings.json 에 평문으로
  적어 두는데, 그건 지금이라면 안 할 방식입니다.

★ 디버그 포트를 열어 둡니다. 그래야 띄워 놓은 그 창에 나중에 **붙어서**
  화면을 읽을 수 있습니다 — 새 창을 띄우면 로그인이 또 필요합니다.

★ 다른 크롬과 **섞이지 않습니다.** 프로필 폴더가 따로라 사장님이 쓰시는
  크롬의 로그인·탭·확장과 무관합니다.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "launcher"
PROFILE = STATE / "chrome-dentbird"
PORT = 9333
HOME_URL = "https://dentbird.com"

CHROME_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
]


def chrome() -> Path:
    for p in CHROME_CANDIDATES:
        if p.is_file():
            return p
    raise SystemExit("크롬을 찾지 못했습니다")


def alive() -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2):
            return True
    except Exception:  # noqa: BLE001
        return False


def open_browser(url: str) -> None:
    if alive():
        print(f"이미 떠 있습니다 (포트 {PORT})")
        return

    PROFILE.mkdir(parents=True, exist_ok=True)
    # ★ 떼어서 — 크롬이 일꾼의 crash.txt 를 물려받아 잠그던 것 (spawn.py, 2026-10-16)
    from spawn import detached  # noqa: PLC0415
    detached(
        [
            str(chrome()),
            f"--user-data-dir={PROFILE}",
            f"--remote-debugging-port={PORT}",
            "--no-first-run",
            "--no-default-browser-check",
            "--window-size=1500,1000",
            # ★ 가려지거나 내려놓은 창도 쉬지 않게 (2026-10-15 실측 — attach() 설명)
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling",
            "--disable-features=CalculateNativeWinOcclusion",
            url,
        ],
    )
    for _ in range(30):
        if alive():
            print(f"띄웠습니다 — 프로필 {PROFILE}")
            print("그 창에서 한 번 로그인해 주세요. 비밀번호는 아무 데도 안 적힙니다.")
            return
        time.sleep(1)
    print("띄웠지만 디버그 포트가 안 열렸습니다")


def attach():
    """떠 있는 창에 붙습니다 — 새로 띄우지 않습니다"""
    from selenium import webdriver  # noqa: PLC0415
    from selenium.webdriver.chrome.options import Options  # noqa: PLC0415

    from selenium.webdriver.chrome.service import Service  # noqa: PLC0415

    opts = Options()
    opts.add_experimental_option("debuggerAddress", f"127.0.0.1:{PORT}")
    # ★★ 크롬드라이버의 출력을 버립니다 (2026-10-16). 그냥 띄우면 부른 쪽의 표준
    #   출력(= 시작프로그램이 연 crash.txt)을 물려받아 쥐고 있습니다. 부른 쪽이
    #   죽으면 드라이버는 고아로 남아 계속 쥐고, 시작프로그램은 그 파일을 못 열어
    #   일꾼을 **조용히 못 띄웠습니다** (Restart Manager 로 확인한 범인).
    import subprocess  # noqa: PLC0415
    service = Service(log_output=subprocess.DEVNULL, popen_kw={"close_fds": True})
    d = webdriver.Chrome(options=opts, service=service)
    # ★★ **진짜 덴트버드 페이지로 먼저 옮겨 갑니다** (2026-10-16). 다시 로그인하고
    #   나면 크롬 안에 주소 없는 대상(type=other)이 하나 생기고, 셀레니움이 그쪽을
    #   잡으면 첫 명령에서 2분 걸린 뒤 연결째 끊겼습니다(어제·오늘 두 번). 크롬이
    #   직접 알려 주는 page 목록에서 덴트버드 것을 골라 그 창으로 갑니다.
    target = dentbird_page_id()
    if target and target in d.window_handles:
        d.switch_to.window(target)
    keep_awake(d)
    return d


def dentbird_page_id() -> str | None:
    """크롬이 아는 탭 중 덴트버드 페이지의 id (= 셀레니움 창 이름)"""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=3) as r:
            tabs = json.loads(r.read().decode("utf-8", "replace"))
    except Exception:  # noqa: BLE001
        return None
    pages = [t for t in tabs if t.get("type") == "page" and "dentbird.com" in t.get("url", "")]
    # 설계 화면(ai.dentbird.com)을 먼저, 없으면 아무 덴트버드 페이지
    pages.sort(key=lambda t: "ai.dentbird.com" not in t.get("url", ""))
    return pages[0]["id"] if pages else None


def keep_awake(d) -> None:
    """창이 가려져도, 작업표시줄로 내려놔도 덴트버드가 일하게 합니다

    ★★★ **창을 클릭해야 움직였습니다** (사용자 2026-10-15). 재 보니 덴트버드
      창이 **다른 창 뒤에 있기만 해도** 크롬이 그 쪽을 '숨김' 으로 보고
      화면 그리기를 0 번(2초), 타이머를 1초에 한 번으로 줄였습니다.
      덴트버드는 3D(WebGL) 라 그리기가 멈추면 분류·분석도 멈춥니다 —
      '분류하고 있습니다' 가 몇 분씩 서 있던 것도 아마 이것입니다.
    ★ 이 두 명령을 걸자 **최소화한 채로** 그리기 241 번·타이머 정상이
      됐습니다. 붙는 세션에만 걸리므로 붙을 때마다 다시 겁니다.
    """
    d.execute_cdp_cmd("Emulation.setFocusEmulationEnabled", {"enabled": True})
    d.execute_cdp_cmd("Page.setWebLifecycleState", {"state": "active"})


#: 화면에서 사람이 누르는 것들만 추립니다 — 전부 뜨면 글이 묻힙니다
OUTLINE_JS = r"""
const label = el => {
  const t = (el.innerText || el.value || '').trim();
  if (t) return t.slice(0, 60);
  // ★ 아이콘 단추는 글자가 없습니다. MUI 는 svg 에 data-testid 를 붙여 줍니다
  //   (AddIcon·SearchIcon…) — 그게 사실상 이름입니다.
  const svg = el.querySelector('svg[data-testid]');
  const alt = el.getAttribute('aria-label') || el.getAttribute('title')
            || el.getAttribute('placeholder') || el.getAttribute('data-testid')
            || (svg ? svg.getAttribute('data-testid') : '');
  return (alt || '').trim().slice(0, 60);
};
const out = [];
const seen = new Set();
document.querySelectorAll('button,a,input,select,textarea,[role=button],[role=tab],[role=menuitem]').forEach(el => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  const name = label(el);
  const key = el.tagName + '|' + name + '|' + Math.round(r.top);
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    label: name,
    id: el.id || '',
    testid: el.getAttribute('data-testid') || '',
    at: [Math.round(r.left), Math.round(r.top)],
  });
});
// ★ 화면에 보이는 글도 조금 가져옵니다 — 단추만 봐서는 어느 화면인지 모릅니다
const text = (document.body.innerText || '').split('\n')
  .map(s => s.trim()).filter(Boolean).slice(0, 40);
return { url: location.href, title: document.title, items: out.slice(0, 90), text };
"""


def read() -> None:
    if not alive():
        raise SystemExit("떠 있는 창이 없습니다 — 먼저 그냥 돌려서 띄워 주세요")
    d = attach()
    got = d.execute_script(OUTLINE_JS)
    print(f"주소: {got['url']}")
    print(f"제목: {got['title']}")
    print(f"누를 수 있는 것 {len(got['items'])}개")
    for i in got["items"]:
        where = f"({i['at'][0]},{i['at'][1]})"
        tid = f" [{i['testid']}]" if i["testid"] else ""
        print(f"  {i['tag']:7} {where:>12}  {i['label']!r}{tid}")
    print("--- 화면에 보이는 글 ---")
    for line in got.get("text", []):
        print(f"  {line}")


#: 글자로 눌러 봅니다 — 자리(좌표)로 누르면 화면이 조금만 바뀌어도 엉뚱한
#: 것을 누릅니다. 글자는 화면이 바뀌어도 웬만하면 그대로입니다.
CLICK_JS = r"""
const want = arguments[0].trim();
const nodes = [...document.querySelectorAll('button,a,[role=button],[role=tab],li,div')];
const hit = nodes.filter(el => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
  return t === want || (t.includes(want) && t.length < want.length + 25);
});
if (!hit.length) return { ok: false, why: '그런 글자가 없습니다' };
// ★ 가장 안쪽 것을 누릅니다 — 바깥 상자를 누르면 아무 일도 안 납니다
const el = hit.reduce((a, b) => (a.contains(b) ? b : a));
el.scrollIntoView({ block: 'center' });
el.click();
return { ok: true, tag: el.tagName, text: (el.innerText || '').trim().slice(0, 40) };
"""


def click(what: str) -> None:
    if not alive():
        raise SystemExit("떠 있는 창이 없습니다")
    d = attach()
    got = d.execute_script(CLICK_JS, what)
    print(f"눌렀습니다: {got}" if got.get("ok") else f"못 눌렀습니다: {got.get('why')}")


def shot() -> None:
    if not alive():
        raise SystemExit("떠 있는 창이 없습니다")
    d = attach()
    out = STATE / "dentbird-화면.png"
    d.save_screenshot(str(out))
    print(f"떴습니다: {out}")


def main() -> int:
    what = sys.argv[1] if len(sys.argv) > 1 else "open"
    if what == "read":
        read()
    elif what == "click":
        click(" ".join(sys.argv[2:]))
    elif what == "shot":
        shot()
    else:
        open_browser(sys.argv[2] if len(sys.argv) > 2 else HOME_URL)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


def reap_drivers() -> int:
    """고아 크롬드라이버를 끕니다 — 일꾼이 켜질 때 한 번 (2026-10-16)

    ★ 일꾼이 죽으면 그가 붙을 때 띄운 크롬드라이버가 남습니다. 이 PC 에서
      크롬드라이버를 쓰는 것은 일꾼뿐이라, 켜질 때 남은 것은 다 고아입니다.
    """
    r = subprocess.run(
        ["taskkill", "/F", "/IM", "chromedriver.exe"],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        creationflags=0x08000000,  # 창 없이
    )
    return r.stdout.count(b"PID") if r.returncode == 0 else 0
