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
    subprocess.Popen(
        [
            str(chrome()),
            f"--user-data-dir={PROFILE}",
            f"--remote-debugging-port={PORT}",
            "--no-first-run",
            "--no-default-browser-check",
            "--window-size=1500,1000",
            url,
        ],
        close_fds=True,
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

    opts = Options()
    opts.add_experimental_option("debuggerAddress", f"127.0.0.1:{PORT}")
    return webdriver.Chrome(options=opts)


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
