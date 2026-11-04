# -*- coding: utf-8 -*-
r"""밤 실행 — 폴더의 dxd 를 덴트버드에서 규칙대로 설계해 두고, 아침에 사람이 정상·비정상만 고릅니다 (2026-11-03).

    python batch_review.py "C:\Users\DS\Desktop\덴트버드_밤작업" [--limit 10]

사용자 요청 2026-11-03: "바탕화면에 dxd 파일들 폴더 하나 만들어서 냅두면 변환해서 진행할 수 있나?
  임플란트, 에그쉘도 섞여 있을 텐데 안 되는 건 탭으로 냅두고 되는 것만 완성해서 숫자 매기고
  내가 다음날 아침에 정상, 비정상 구분지어 주면 효율적인 거 같은데"

하는 일 (파일 하나마다)
  1) dxd → DS Core 로 ply → STL (dscore.convert, design_scans.to_stl). 폴더 안 stl/ply 쌍도 받습니다.
  2) 덴트버드 전용 크롬에 새 탭 → 올리기 → AI 분석
  3) 분석 결과가 크라운·브릿지(폰틱)만이면 진행. 임플란트·인레이·아무것도 못 잡음 → 'H번호' 로 탭을 남기고 다음
  4) 이웃한 크라운이 따로 잡혔으면 링크로 묶음 (오늘 시험 16-17·34-35 와 같게)
  5) 생성 → 크라운 설계값(apply_each) → 브릿지는 docs/bridge_rules.md 규칙(bridge_rule) → 합치기
  6) 케이스 이름을 'R번호 …' 로 바꾸고 저장, 화면 그림을 남기고 탭을 닫음
  7) 검토표.html 에 번호·종류·결정·덴트버드 숫자·그림을 모아 둠

지키는 것
  ★ 내보내기는 안 합니다 — 크레딧이 안 듭니다.
  ★ 덴트버드 케이스 이름에 환자 이름을 넣지 않습니다 (번호와 치식만). 검토표는 이 PC 폴더에만 둡니다.
  ★ 이 프로그램은 **사람이 더블클릭으로 시작**합니다. 작업 도구(클로드)가 띄우지 않습니다.
  ★ 돌아가는 동안 같은 덴트버드 계정을 다른 곳에서 쓰면 이쪽이 끊깁니다 — 밤에만 돌립니다.
  ★ 한 건이 실패해도 다음 건으로 갑니다. 이미 끝낸 파일은 기록(밤작업_기록.json)을 보고 건너뜁니다.
"""
from __future__ import annotations

import argparse
import ctypes
import html
import json
import re
import shutil
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from dentbird_case import fdi_range  # noqa: E402
from dentbird_macro import (  # noqa: E402
    CROWN_URL, Stop, click, dismiss, generation_done, screen_labels, session_problem, text,
    upload_and_classify, wait_gone,
)
from dentbird_params import ParamError, apply_each, bridge_rule, close_panels, select_tooth  # noqa: E402
from dentbird_web import BATCH_FLAG, WORKER_WANTS, alive, attach, batch_running, worker_wants  # noqa: E402
from design_scans import LOWER, SKIP, UPPER, to_stl  # noqa: E402

LOG_NAME = "밤작업_기록.json"
SHEET_NAME = "검토표.html"
LOG_TEXT = "밤작업_진행.txt"
WORK_DIR = "_작업"
GENERATE_SECONDS = 420
ASSEMBLE_SECONDS = 90


# ---------------------------------------------------------------- 화면 읽기 (순수 부분은 시험이 있음)

def parse_params(body: str) -> list[str]:
    """Smart order '디자인 파라미터' 칸의 항목들 — ['브릿지 25-27', '크라운 17', …]

    ★ 항목 줄 다음에 늘 'Preset - …' 줄이 옵니다. 그 앞 줄만 줍습니다.
    """
    start = body.find("디자인 파라미터")
    if start < 0:
        return []
    end = body.find("디자인 설정", start)
    seg = body[start:end if end > 0 else None].split("\n")
    out = []
    for i, line in enumerate(seg[:-1]):
        if seg[i + 1].strip().startswith("Preset") and line.strip():
            out.append(line.strip())
    return out


def param_section(body: str) -> str:
    start = body.find("디자인 파라미터")
    if start < 0:
        return ""
    end = body.find("디자인 설정", start)
    return body[start:end if end > 0 else None]


def classify(params: list[str], body: str) -> tuple[str, str]:
    """('go', '') 또는 ('hold', 까닭)"""
    if "감지되지 않았습니다" in body or not params:
        return "hold", "치료할 치아를 못 잡음 (에그쉘·프렙 없음일 수 있음)"
    # ★ 브릿지 줄 아래에 '└ 임플란트 17' 처럼 유닛이 따로 적힙니다 (2026-11-03 시험3 — 브릿지 17-15 의 양끝이 임플란트).
    #   브릿지 줄만 보면 통과시켜 '디자인' 단추가 잠긴 채 눌렀습니다.
    inside = re.findall(r"(임플란트\s*\d{2}|인레이[^\n]*\d{2}|온레이[^\n]*\d{2})", param_section(body))
    if inside:
        return "hold", "규칙 없는 종류: " + ", ".join(dict.fromkeys(x.strip() for x in inside))
    odd = [p for p in params if not re.match(r"^(크라운 \d{2}|브릿지 \d{2}-\d{2})$", p)]
    if odd:
        return "hold", "규칙 없는 종류: " + ", ".join(odd)
    return "go", ""


def groups_from(params: list[str]) -> tuple[list[list[int]], list[int]]:
    """(브릿지 유닛 목록들, 따로 크라운들)"""
    bridges, singles = [], []
    for p in params:
        m = re.match(r"^브릿지 (\d{2})-(\d{2})$", p)
        if m:
            span = fdi_range(int(m.group(1)), int(m.group(2)))
            if span:
                bridges.append(span)
            continue
        m = re.match(r"^크라운 (\d{2})$", p)
        if m:
            singles.append(int(m.group(1)))
    return bridges, singles


def pontics_from(body: str, units: list[int]) -> list[int]:
    return sorted({int(n) for n in re.findall(r"폰틱\s*(\d{2})", body) if int(n) in units})


# ---------------------------------------------------------------- 스캔 준비

def jaws(folder: Path) -> tuple[Path, Path]:
    """(위턱, 아래턱) STL. 못 고르면 Stop"""
    files = [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in (".stl", ".ply", ".obj")]
    files = [p for p in files if not SKIP.search(p.stem)]
    files = [p for p in files if "_up" not in p.relative_to(folder).parts]  # 올릴 사본은 고르지 않음
    up = [p for p in files if UPPER.search(p.stem) and not LOWER.search(p.stem)]
    low = [p for p in files if LOWER.search(p.stem) and not UPPER.search(p.stem)]
    pref = lambda g: sorted(g, key=lambda p: (p.suffix.lower() != ".stl", len(p.name)))  # noqa: E731
    if not up or not low:
        raise Stop(f"위·아래 턱 스캔을 못 골랐습니다 — {', '.join(p.name for p in files) or '파일 없음'}")
    return to_stl(pref(up)[0]), to_stl(pref(low)[0])


def neutral(scans: tuple[Path, Path], dest: Path) -> tuple[Path, Path]:
    """덴트버드에 올릴 사본 — 파일 이름에서 환자 이름을 뺍니다.

    ★ DS Core 가 돌려준 파일 이름은 '환자이름-upperjaw.stl' 입니다. 그대로 올리면 덴트버드 파일 목록에
      환자 이름이 남습니다(2026-11-04 사용자 미리보기 화면에서 발견). 케이스 이름만 번호·치식으로 바꾸던 것을
      파일 이름까지 넓힙니다.
    """
    import shutil  # noqa: PLC0415

    dest.mkdir(parents=True, exist_ok=True)
    out = (dest / "upperjaw.stl", dest / "lowerjaw.stl")
    for src, dst in zip(scans, out):
        shutil.copyfile(src, dst)
    return out


def prepare(item: Path, work: Path, say) -> tuple[Path, Path]:
    """dxd 면 DS Core 로 바꾸고, 폴더면 그대로. (위턱, 아래턱) — 둘 다 이름 없는 사본"""
    if item.is_dir():
        return neutral(jaws(item), work / "_up")
    import dscore  # noqa: PLC0415

    # ★ 계정 파일(settings.json)이 없어도 DS Core 전용 프로필이 이미 로그인돼 있으면 그대로 됩니다 (2026-11-03,
    #   디자인PC 는 파일 없이 exocad 연동이 쓰던 로그인이 남아 있음). 미리 막지 않고, 로그인이 필요할 때만 멈춥니다.
    work.mkdir(parents=True, exist_ok=True)
    say(f"DS Core 로 바꾸는 중 (3~5분) — {item.name}")
    try:
        dscore.convert(item, work, work.name, "", "", say=say)
    except RuntimeError as e:
        if "settings.json" in str(e):
            raise Stop("DS Core 로그인이 풀려 있습니다 — 'python dscore.py --login' 으로 한 번 손으로 로그인해 주세요") from e
        raise
    return neutral(jaws(work), work / "_up")


# ---------------------------------------------------------------- 덴트버드

def close_tab(d, handle: str) -> None:
    quietly(_close_tab, d, handle)


def _close_tab(d, handle: str) -> None:
    """탭을 크롬에 직접 닫게 합니다 — 덴트버드의 '나가시겠습니까?' 창에 걸리지 않게 (창 닫기 대신 CDP)"""
    try:
        d.execute_cdp_cmd("Target.closeTarget", {"targetId": handle})
    except Exception:  # noqa: BLE001
        d.switch_to.window(handle)
        d.close()
    time.sleep(1)


def _canvas(d):
    els = d.find_elements("css selector", '[data-testid="mesh-viewer-container"] canvas') or \
        d.find_elements("css selector", "canvas")
    return max(els, key=lambda e: (e.size or {}).get("width", 0)) if els else None


def _set_model(d, name: str, show: bool) -> bool:
    """모델 리스트의 '상악'/'하악' 줄을 켜거나 끕니다. 실제로 바꿨으면 True.

    ★ 줄의 첫 단추는 펼치기 화살표(testid model-list-collapse-button)이고, 눈은 testid 없는 단추입니다.
    ★ 2026-11-04 실측: 눈 아이콘은 그림 선 하나. 켜진 눈은 'M2 9…', 꺼진 눈(빗금)은 'M7.93…' 으로 시작합니다.
      예전 코드는 누르기만 해서, 사람이 이미 꺼 둔 화면에서는 오히려 켜 버렸습니다. 이제 상태를 읽고 다를 때만 누릅니다.
    ★ 사용자 2026-11-03: "상악, 하악 눈 모양 클릭하면 크라운만 남아" — 둘 다 끄면 크라운만 찍힙니다.
    """
    return bool(d.execute_script(
        "const p=document.querySelector('[data-testid=model-list-panel]'); if(!p) return false;"
        "const eye=[...p.querySelectorAll('button')].filter(b=>!b.getAttribute('data-testid'))"
        "  .find(b=>(b.parentElement.parentElement.innerText||'').trim()===arguments[0]);"
        "if(!eye) return false;"
        "const shown=/^M2 9/.test(eye.querySelector('path')?.getAttribute('d')||'');"
        "if(shown===arguments[1]) return false; eye.click(); return true;", name, show))


def _rdrag(d, dx: int, dy: int) -> None:
    """3D 화면을 **오른쪽 단추**로 끌어 돌립니다 (2026-11-04 R01 실측).

    ★ 왼쪽 끌기는 돌지 않고, 가운데 단추는 옮기기입니다. Selenium 끌기(ActionChains)는 어떤 단추로도 안 돌았습니다.
      크롬에 마우스 신호를 20번으로 잘게 나눠 직접 보내야 돕니다.
    ★ 200픽셀이 약 90도. 아래로 끌면 위(교합면)가, 위로 끌면 아래(안쪽)가 보입니다. 가로 800픽셀이 반 바퀴.
    ★ 끝나면 마우스를 화면 구석으로 뺍니다 — 치아 위에 있으면 그 치아가 파랗게 칠해져 찍힙니다.
    """
    w, h = d.execute_script("return [innerWidth, innerHeight]")
    x0, y0 = w // 2, h // 2  # 화면 가운데 (창 크기가 바뀌어도)
    send = lambda t, x, y, b, n: d.execute_cdp_cmd("Input.dispatchMouseEvent", {  # noqa: E731
        "type": t, "x": x, "y": y, "button": n, "buttons": b, "clickCount": 0 if t == "mouseMoved" else 1})
    send("mouseMoved", x0, y0, 0, "none")
    send("mousePressed", x0, y0, 2, "right")
    for i in range(1, 21):
        send("mouseMoved", x0 + dx * i / 20, y0 + dy * i / 20, 2, "right")
        time.sleep(0.02)
    send("mouseReleased", x0 + dx, y0 + dy, 0, "right")
    send("mouseMoved", 5, h - 5, 0, "none")
    time.sleep(1.2)


def capture_views(d, shots: Path, number: str, units: list[int], say) -> list[str]:
    """합친 뒤 크라운만 네 방향에서 찍습니다 — 아침에 연결부만 보고 정상·비정상을 가립니다.

    ★ 사용자 2026-11-04: "연결 부분만 보고 싶어. 생성하는 시간을 쓰고 싶지 않아. 상악·하악 눈을 끄면 크라운만 나와."
      덴트버드에 생성한 디자인이 남지 않으므로 아침에 다시 열 수 없습니다. 그림이 판별의 전부입니다.
    ★ 방향: 처음(옆) → 아래로 200 교합면 → 위로 400 안쪽 → 아래로 200 옆 → 가로 800 반대쪽 옆 → 되돌림.
      '화면 맞추기' 는 크기만 맞추고 방향은 그대로 둡니다(2026-11-04 실측). 장마다 눌러 크라운이 화면을 채우게 합니다.
    ★★ 2026-11-03 첫 시험에서 네 장이 같았던 까닭: 왼쪽 단추 끌기는 화면을 돌리지 않습니다.
    """
    out: list[str] = []
    hidden = [n for n in ("상악", "하악") if _set_model(d, n, False)]
    time.sleep(1.5)
    labels_off = bool(d.execute_script(
        "const b=document.querySelector('[data-testid=views-label-visibility-btn]'); if(b){b.click(); return true} return false"))
    time.sleep(1)

    def snap(tag: str) -> None:
        d.execute_script("document.querySelector('[data-testid=side-tool-zoom-to-fit]')?.click()")
        time.sleep(2)
        p = shots / f"{number}_{tag}.png"
        try:
            d.save_screenshot(str(p))
            out.append(f"그림/{p.name}")
        except Exception as e:  # noqa: BLE001
            say(f"그림 {tag} 실패 — {e}")
            return
        try:  # 양옆 메뉴를 잘라 크라운을 크게 (화면 1920×945 기준, 화면 맞추기 뒤 크라운은 가운데 이 안에 들어옴)
            from PIL import Image  # noqa: PLC0415

            with Image.open(p) as im:
                w, h = im.size
                im.crop((int(w * 0.21), int(h * 0.14), int(w * 0.81), int(h * 0.85))).save(p)
        except Exception:  # noqa: BLE001
            pass  # 못 자르면 전체 화면 그대로

    try:
        # ★ 사용자 2026-11-04: "교합면·마진면·협면·설면 4컷만(생성된 치아만)". 이름 앞 숫자가 검토표의 순서입니다.
        #   덴트버드 처음 방향은 바깥쪽(협면)에서 본 모습 — R01·R04 그림으로 확인.
        snap("3_협면")
        for tag, dx, dy in (("1_교합면", 0, 200), ("2_마진면", 0, -400), (None, 0, 200), ("4_설면", 800, 0), (None, -800, 0)):
            try:
                _rdrag(d, dx, dy)
            except Exception as e:  # noqa: BLE001
                say(f"화면 돌리기 실패 — {e}")
                break
            if tag:
                snap(tag)
    finally:
        if labels_off:
            d.execute_script("document.querySelector('[data-testid=views-label-visibility-btn]')?.click()")
        for n in hidden:
            _set_model(d, n, True)
    return sorted(out)  # 교합면 → 마진면 → 협면 → 설면


#: 그림 이름의 면 — 예전 이름(옆·안쪽·반대쪽)도 새 이름으로 (2026-11-04)
VIEW_NAMES = {"교합면": "교합면", "마진면": "마진면", "협면": "협면", "설면": "설면",
              "옆": "협면", "안쪽": "마진면", "반대쪽": "설면"}
VIEW_ORDER = ["교합면", "마진면", "협면", "설면"]


def name_shots(folder: Path, number: str, shots: list[str]) -> list[str]:
    """'1104_17_1_교합면.png' 같은 임시 이름을 'R04_교합면.png' 로 바꿉니다 (사용자 2026-11-04 "R04_교합면 처럼").
    번호는 설계가 끝나야 정해져서, 찍을 때는 임시 이름을 쓰고 끝난 뒤 바꿉니다. 바꾼 경로를 면 순서대로 돌려줍니다."""
    out: dict[str, str] = {}
    for rel in shots:
        src = folder / rel
        view = next((VIEW_NAMES[k] for k in VIEW_NAMES if src.stem.endswith("_" + k)), None)
        if view is None:
            continue
        dst = src.with_name(f"{number}_{view}.png")
        try:
            if src != dst:
                src.replace(dst)
            out[view] = f"그림/{dst.name}"
        except OSError:
            out[view] = rel
    return [out[v] for v in VIEW_ORDER if v in out]


def focus_shots(d, shots: Path, number: str, say) -> list[str]:
    """합치기 전, 접합마다 치아 초점 보기를 찍습니다 (어디서 붙었는지 단면으로 보임)"""
    out: list[str] = []
    try:
        close_panels(d)
        d.execute_script("document.querySelector('[data-testid=toolbar-tool-connect]')?.click()")
        time.sleep(4)
        chips = d.find_elements("css selector", '[data-testid^="connect-connector-chip-"]')
        for i in range(len(chips)):
            chip = d.find_elements("css selector", '[data-testid^="connect-connector-chip-"]')[i]
            name = (chip.text or "").strip()
            d.execute_script("arguments[0].click()", chip)
            time.sleep(3)
            p = shots / f"{number}_초점_{name}.png"
            d.save_screenshot(str(p))
            out.append(f"그림/{p.name}")
    except Exception as e:  # noqa: BLE001
        say(f"초점 보기 그림 실패 — {e}")
    finally:
        close_panels(d)
    return out



# ---------------------------------------------------------------- 창을 안 보이게 (2026-11-04)
#
# 사용자 2026-11-04: "크롬창 최소화해서 진행해줘. 디자인도 해야 돼서 불편해."
# ★ 최소화는 안 씁니다 — 최소화한 크롬은 3D(WebGL) 그리기가 멈출 수 있어 dentbird_web.keep_awake 가
#   붙을 때마다 최소화를 풉니다(2026-10-21 서버PC). 대신 창을 **모든 모니터의 오른쪽 바깥** 에 둡니다.
# ★ 실측(2026-11-04 디자인PC, 모니터 둘): 창이 모니터 위에 있으면 붙기·탭 닫기 때 크롬이 맨 앞으로 와서
#   키보드를 가져갔습니다. 화면 밖에 두자 붙기·뒤에서 탭 열기·탭 옮기기·탭 닫기 어느 것도 앞으로 안 왔습니다.
#   그래도 만일 앞으로 오면 원래 쓰던 창으로 되돌립니다(give_back).

_U = ctypes.windll.user32 if sys.platform == "win32" else None
#: 창 크기 — 그림 자르기·화면 돌리기 기준(안쪽 약 1904×955)이 이 크기에서 맞춰졌습니다
WIN_W, WIN_H = 1920, 1050


def _offscreen_left() -> int:
    if _U is None:
        return 4000
    return _U.GetSystemMetrics(76) + _U.GetSystemMetrics(78) + 100  # 가상 화면 왼쪽 + 너비 = 오른쪽 끝


def place_window(d, hidden: bool) -> None:
    """hidden=True 면 화면 밖으로, False 면 주 모니터 위로(로그인할 때)"""
    try:
        win = d.execute_cdp_cmd("Browser.getWindowForTarget", {})
        d.execute_cdp_cmd("Browser.setWindowBounds", {"windowId": win["windowId"], "bounds": {"windowState": "normal"}})
        left, top = (_offscreen_left(), 0) if hidden else (100, 40)
        d.execute_cdp_cmd("Browser.setWindowBounds", {"windowId": win["windowId"],
                                                       "bounds": {"left": left, "top": top, "width": WIN_W, "height": WIN_H}})
    except Exception:  # noqa: BLE001
        pass


class _RECT(ctypes.Structure):
    _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long), ("r", ctypes.c_long), ("b", ctypes.c_long)]


def _ours(h) -> bool:
    """이 창이 화면 밖에 둔 전용 크롬인가 — 창 위치로 가립니다"""
    if _U is None or not h:
        return False
    r = _RECT()
    _U.GetWindowRect(h, ctypes.byref(r))
    return r.l >= _offscreen_left() - 10


def give_back(prev) -> None:
    """크롬이 키보드를 가져갔으면 prev 창으로 되돌립니다 (맨 앞 창의 입력 줄에 잠깐 붙어서)"""
    if _U is None or not prev or _ours(prev):
        return
    cur = _U.GetForegroundWindow()
    if not _ours(cur):
        return
    t_cur = _U.GetWindowThreadProcessId(cur, None)
    t_me = ctypes.windll.kernel32.GetCurrentThreadId()
    _U.AttachThreadInput(t_me, t_cur, True)
    try:
        _U.SetForegroundWindow(prev)
        _U.BringWindowToTop(prev)
    finally:
        _U.AttachThreadInput(t_me, t_cur, False)


def quietly(fn, *args):
    """fn 을 하되, 그 사이 크롬이 맨 앞으로 오면 원래 창으로 되돌립니다"""
    prev = _U.GetForegroundWindow() if _U else None
    try:
        return fn(*args)
    finally:
        time.sleep(0.3)
        give_back(prev)


def bg_tab(d, url: str) -> str:
    """뒤에서 새 탭을 열고 그 탭으로 옮깁니다 — selenium new_window 는 창을 앞으로 끌어옵니다"""
    t = d.execute_cdp_cmd("Target.createTarget", {"url": url, "background": True})["targetId"]
    d.switch_to.window(t)
    return t


def ensure_ready(say=print) -> bool:
    """단추 하나로 (2026-11-04 사용자 "버튼이 하나만 있으면"): 전용 크롬이 없으면 띄우고, 로그인이 풀렸으면
    그때만 창을 보여 주고 로그인을 기다립니다(최대 20분). 준비되면 True"""
    from dentbird_macro import session_problem_of  # noqa: PLC0415
    from dentbird_web import open_browser, page_snapshot  # noqa: PLC0415

    if not alive():
        say("덴트버드 전용 크롬을 띄웁니다")
        open_browser(HOME_TAB)
        time.sleep(10)
    if not alive():
        say("전용 크롬이 안 떴습니다")
        return False
    shown = False
    bad = 0
    for _ in range(240):
        snap = page_snapshot()
        why = session_problem_of(*snap) if snap else "덴트버드 화면이 아직 없습니다"
        if not why:
            if shown:
                say("로그인 확인 — 창을 다시 화면 밖으로 보내고 시작합니다")
            return True
        bad += 1
        # ★ 막 띄운 크롬은 화면이 다 뜨기 전에 '로그인' 글자가 잠깐 보입니다(2026-11-04 실측) — 15초 넘게 그대로일 때만 창을 보여 줌
        if not shown and bad >= 4:
            say(f"{why}\n  -> 앞에 뜬 크롬 창에서 밤 실행용 덴트버드 계정으로 로그인해 주세요. 로그인하면 저절로 시작합니다.")
            d = attach()
            place_window(d, hidden=False)
            shown = True
        time.sleep(5)
    say("20분 동안 로그인이 안 돼서 그만둡니다")
    return False


def new_tab(d) -> None:
    quietly(bg_tab, d, CROWN_URL)
    time.sleep(6)
    why = session_problem(d)
    if why:
        raise Stop(f"덴트버드 로그인이 풀렸습니다 — {why}")


def link_neighbors(d, say) -> int:
    """따로 잡힌 이웃 크라운을 링크로 묶습니다. 묶은 개수"""
    n = 0
    for _ in range(8):
        classes = d.execute_script(
            "return [...document.querySelectorAll('[data-testid=bridge-link-toggle-btn]')]"
            ".map(b=>b.querySelector('svg')?.className.baseVal||'')")
        idx = next((i for i, c in enumerate(classes or []) if "unlink" in c), None)
        if idx is None:
            break
        d.execute_script("document.querySelectorAll('[data-testid=bridge-link-toggle-btn]')[arguments[0]].click()", idx)
        time.sleep(1.5)
        click(d, "bridge-link-panel-apply-btn")
        time.sleep(2.5)
        n += 1
    if n:
        say(f"이웃 크라운 {n}곳을 링크로 묶었습니다")
    return n


#: 생성 단추가 잠겼을 때 그 순간의 화면 사정 (2026-11-04)
_GEN_STATE_JS = r"""
const g=document.querySelector('[data-testid=generate-crown-btn]');
const vis=s=>[...document.querySelectorAll(s)].filter(e=>e.offsetParent).length;
return {disabled: g?g.disabled:null, linkApply: vis('[data-testid=bridge-link-panel-apply-btn]'),
  dialog: vis('[role=dialog]'), links: [...document.querySelectorAll('[data-testid*=link]')].filter(e=>e.offsetParent)
  .map(e=>e.getAttribute('data-testid')).filter((v,i,a)=>a.indexOf(v)===i)};
"""


def _unstick(d, say) -> bool:
    """잠긴 생성 단추를 풀어 봅니다. 풀리면 True — 무엇으로 풀렸는지 기록에 남깁니다.

    ★ 덴트버드 화면 코드(2026-11-04 읽음): 생성 단추는 ① 무거운 작업 중 ② 서버와 통신 중 ③ 기본 모드가 아님
      ④ 생성할 보철 없음 — 넷 중 하나면 잠깁니다. 2026-11-04 H17 은 링크 고리가 떠 있는 채 잠겨 ③ 을 의심합니다.
    """
    from selenium.webdriver.common.keys import Keys  # noqa: PLC0415

    st = d.execute_script(_GEN_STATE_JS)
    say(f"생성 단추 잠김 — {st}")
    tries = [
        ("링크 창 적용", lambda: d.execute_script("document.querySelector('[data-testid=bridge-link-panel-apply-btn]')?.click()")),
        ("링크 창 닫기", lambda: d.execute_script("document.querySelector('[data-testid=bridge-link-panel-close-btn]')?.click()")),
        ("Esc", lambda: d.find_element("tag name", "body").send_keys(Keys.ESCAPE)),
        ("대화창 닫기", lambda: dismiss(d)),
    ]
    for name, act in tries:
        try:
            act()
        except Exception:  # noqa: BLE001
            continue
        time.sleep(3)
        if not d.execute_script("return document.querySelector('[data-testid=generate-crown-btn]')?.disabled"):
            say(f"생성 단추가 풀렸습니다 — {name}")
            return True
    return False


#: 덴트버드가 생성을 거부하는 경고 — 다시 해도 같으므로 바로 보류(사람이 마진을 고쳐야 함)
REFUSE_SIGNS = ("꼬인 마진라인",)


def _refused(d) -> str | None:
    """'상태' 칸이 보일 때만 경고를 읽습니다. 칸이 안 보이면(도구 칸이 덮음) 경고가 있는 것으로 봅니다.

    ★ 2026-11-04 첫 시도: 마진선 도구를 열자 '상태' 칸이 마진선 칸으로 바뀌어 경고 글자가 사라졌고,
      그것을 '풀렸다' 로 읽었습니다.
    """
    close_panels(d)
    time.sleep(1)
    body = text(d)
    if "상태" not in body:
        return "상태 칸이 안 보임"
    return next((w for w in REFUSE_SIGNS if w in body), None)


def _pick_for_margin(d, n: int) -> bool:
    """생성 전 화면에서 치아 n 을 골라 도구 막대를 띄웁니다 (생성 전에는 내면 도구가 없어 select_tooth 를 못 씀)"""
    close_panels(d)
    for _ in range(8):
        hit = d.execute_script(
            "const l=[...document.querySelectorAll('[data-testid=component-floating-label-button]')]"
            ".find(e=>(e.innerText||'').trim()===String(arguments[0])); if(!l) return false; l.click(); return true;", n)
        time.sleep(1.2)
        if hit and d.find_elements("css selector", '[data-testid="toolbar-tool-margin-line"]'):
            bar = d.execute_script("return (document.querySelector('[data-testid=crown-toolbar]')||{}).innerText||''")
            if str(n) in bar or not bar:
                return True
    return False


def _margin_apply(d) -> None:
    d.execute_script("document.querySelector('[data-testid=margin-apply-btn]')?.click()")
    time.sleep(4)
    dismiss(d)  # '꼬인 선 감지' 안내 창이 뜨면 닫음
    time.sleep(1)


def find_twisted(d, units: list[int], say, shots: Path | None, tag: str) -> list[int]:
    """'꼬인 마진라인' 일 때 어느 치아 탓인지 찾습니다 — 마진선 도구를 열어 언더컷 알림이 뜨는 치아.

    ★ 2026-11-04 하악 45-47 두 번 시도: 좁히기·넓히기·재탐지로는 안 풀렸습니다. 마진선 도구로 47 만 띄우니
      지대치가 스캔에 거의 없고(가는 조각, 대부분 언더컷), 덴트버드가 "마진 라인이 언더컷 영역을 가로지르고
      있습니다" 라고 알렸습니다. 스캔이 없는 곳은 선을 고쳐도 크라운 바닥이 맞지 않으므로 고치지 않고,
      어느 치아인지 적어 재스캔으로 돌립니다(사용자 2026-11-04 확인 전 — 결과 보고 후 정함).
    """
    from dentbird_params import _open_tool  # noqa: PLC0415

    bad: list[int] = []
    for n in units:
        if not _pick_for_margin(d, n):
            continue
        try:
            _open_tool(d, "toolbar-tool-margin-line", "margin-process")
        except Exception:  # noqa: BLE001
            continue
        time.sleep(2.5)
        if "언더컷 영역을 가로지르고" in text(d):
            bad.append(n)
            if shots is not None:
                d.save_screenshot(str(shots / f"{tag}_마진_{n}.png"))
        close_panels(d)
        time.sleep(1)
    say(f"꼬인 마진라인 — 언더컷을 가로지르는 치아 {bad or '못 찾음'}")
    return bad


def generate(d, units: int, say) -> None:
    # ★ 2026-11-04 H19: 생성 단추는 살아 있는데 눌러도 시작이 안 됐습니다. 상태 칸에 빨간 '꼬인 마진라인' 경고 —
    #   AI 가 그린 마진선이 꼬이면 덴트버드가 생성을 거부합니다. 96초를 버리지 않고 이유를 적어 보류합니다.
    body = text(d)
    hit = next((w for w in REFUSE_SIGNS if w in body), None)
    if hit:
        raise Stop(f"덴트버드 경고 '{hit}' — 마진선을 사람이 고쳐야 생성됩니다")
    for attempt in range(6):
        try:
            if d.execute_script("return document.querySelector('[data-testid=generate-crown-btn]')?.disabled") and attempt >= 1:
                _unstick(d, say)
            click(d, "generate-crown-btn")
            time.sleep(6)
            if re.search(r"준비 중|생성 중|생성됨", text(d)):
                break
        except Exception:  # noqa: BLE001
            pass
        time.sleep(10)
    else:
        raise Stop("생성 단추가 안 먹습니다")
    retried = False
    for _ in range(GENERATE_SECONDS // 5):
        body = text(d)
        if generation_done(body, units):
            say("생성 끝")
            return
        if "생성 실패" in body:
            if retried:
                raise Stop("덴트버드가 생성에 두 번 실패했습니다")
            dismiss(d)
            retried = True
            time.sleep(4)
            click(d, "generate-crown-btn")
        time.sleep(5)
    raise Stop(f"{GENERATE_SECONDS}초가 지나도 생성이 안 끝납니다")


def assemble(d, abutment: int, say) -> None:
    for attempt in range(3):
        try:
            select_tooth(d, abutment)
            click(d, "toolbar-assemble-btn")
            break
        except (Stop, ParamError):
            if attempt == 2:
                raise
            time.sleep(3)
    time.sleep(3)
    d.execute_script("document.querySelector('[data-testid=modal-confirm-btn]')?.click()")
    for _ in range(ASSEMBLE_SECONDS // 2):
        time.sleep(2)
        if "조립됨" in text(d):
            say("합쳤습니다")
            return
    raise Stop("합치기 뒤 '조립됨' 이 안 뜹니다")


def rename_and_save(d, name: str, say) -> bool:
    """케이스 이름을 바꾸고 저장 — 아침에 목록에서 번호로 찾습니다"""
    from selenium.webdriver.common.keys import Keys  # noqa: PLC0415

    try:
        close_panels(d)
        d.execute_script("document.querySelector('[data-testid=casename-edit-btn]')?.click()")
        time.sleep(1.2)
        box = d.find_element("css selector", '[data-testid="casename-input"]')
        box.send_keys(Keys.CONTROL, "a")
        box.send_keys(Keys.BACKSPACE)
        box.send_keys(name)
        box.send_keys(Keys.ENTER)
        time.sleep(1.5)
    except Exception as e:  # noqa: BLE001
        say(f"이름을 못 바꿨습니다 — {e}")
    # ★ 예전에는 단추를 못 찾아도 말없이 넘어갔습니다. 2026-11-04 아침, 밤 실행 네 건이 모두 열면 생성 전
    #   상태였는데 기록에 아무 말이 없어 원인을 못 가렸습니다. 이제 단추·'저장됨' 글자를 보고 결과를 남깁니다.
    try:
        found = d.execute_script(
            "const b=document.querySelector('[data-testid=FileControlButton-Save]');"
            "if(!b) return 'none'; if(b.disabled) return 'disabled'; b.click(); return 'clicked'")
    except Exception as e:  # noqa: BLE001
        say(f"저장을 못 눌렀습니다 — {e}")
        return False
    if found != "clicked":
        say(f"저장 단추를 못 눌렀습니다 — {found}")
        return False
    for _ in range(12):
        time.sleep(1)
        if "저장됨" in text(d):
            return True
    say("저장 단추는 눌렀는데 '저장됨' 이 안 떴습니다")
    return False


def design_one(d, item: Path, scans: tuple[Path, Path], rec: dict, say, shots: Path | None = None) -> dict:
    """올리기부터 저장까지. 돌려주는 dict 가 검토표 한 줄"""
    # ★ rec 를 밖에서 받아 그 자리에서 채웁니다 — 중간에 멈춰도 거기까지 읽은 것(치식 등)이 기록에 남게 (2026-11-03)
    new_tab(d)
    upload_and_classify(d, list(scans), say)
    click(d, "import-next-btn")
    wait_gone(d, "분석하고 있습니다", "AI 분석이 안 끝납니다")
    time.sleep(3)
    body = text(d)
    params = parse_params(body)
    rec["detected"] = params
    # ★ 자연치까지 보이는 것은 이 화면뿐입니다 — 생성 뒤에는 이름표가 보철 것만 남습니다 (2026-11-03 실측)
    present = screen_labels(d)
    verdict, why = classify(params, body)
    if verdict == "hold":
        rec.update(status="hold", why=why)
        return rec

    if link_neighbors(d, say):
        time.sleep(2)
        params = parse_params(text(d))
        rec["detected"] = params
    bridges, singles = groups_from(params)
    rec["bridges"] = [f"{b[0]}-{b[-1]}" for b in bridges]
    rec["singles"] = singles

    d.execute_script(
        "document.querySelector('[data-testid=pontic-guide-close-btn]')?.click();"
        "document.querySelector('[data-testid=tooth-planning-close-btn]')?.click();")
    if d.execute_script("const b=document.querySelector('[data-testid=workspace-preparation-design-btn]');"
                        "return !b || b.disabled || b.classList.contains('Mui-disabled')"):
        rec.update(status="hold", why="'디자인' 단추가 잠김 — 덴트버드가 더 고를 것을 요구 (임플란트 라이브러리 등)")
        return rec
    click(d, "workspace-preparation-design-btn")
    time.sleep(8)
    units_total = sum(len(b) for b in bridges) + len(singles)
    time.sleep(2)
    if _refused(d):
        crowns = [u for b in bridges for u in b if u not in pontics_from(text(d), b)] + list(singles)
        bad = find_twisted(d, crowns, say, shots, rec.get("tag", "x"))
        rec["twisted"] = bad
        if bad:
            # ★ 서버(auto-print stallKind)와 같은 말 — '지대치' 를 쓰면 '자동으로 못 하는 종류' 로 잘못 읽힙니다
            raise Stop(f"{', '.join(map(str, bad))}번 마진선이 꼬입니다 — 스캔을 봐 주세요 (마진이 언더컷을 가로지름), 재스캔 필요")
    generate(d, units_total, say)
    body = text(d)

    if singles:
        apply_each(d, singles, say=say, proximal=True)
    rec["junctions"] = []
    for span in bridges:
        pontics = pontics_from(body, span)
        abutments = [u for u in span if u not in pontics]
        say(f"브릿지 {span[0]}-{span[-1]} — 지대치 {abutments} · 폰틱 {pontics}")
        apply_each(d, abutments, say=say, proximal=False)
        report = bridge_rule(d, span, present, say)
        sweep = report.pop()
        rec["junctions"] += report
        rec.setdefault("sweeps", []).append({
            "bridge": f"{span[0]}-{span[-1]}", "best": sweep["best"], "inner": sweep["inner"],
            "natural": sweep["natural"], "history": [[v, a] for v, a in sweep["history"]],
        })
        # ★ 접합별 초점 그림은 뺐습니다 (사용자 2026-11-04 "연결부만 보면 된다, 나머지는 용량만 차지") — focus_shots 는 남겨 둠
        assemble(d, abutments[0], say)
    if shots is not None:
        units_all = sorted({u for b in bridges for u in b} | set(singles))
        # ★ 그림은 부가 기능 — 실패해도 그 건은 완성입니다 (2026-11-03 밤작업 H08: 합치기까지 끝났는데 그림 오류로 보류가 됨)
        try:
            rec.setdefault("shots", []).extend(capture_views(d, shots, rec.get("tag", "x"), units_all, say))
        except Exception as e:  # noqa: BLE001
            say(f"네 방향 그림 실패 — {type(e).__name__}")
    rec["status"] = "done"
    return rec


# ---------------------------------------------------------------- 기록·검토표

def load_log(folder: Path) -> dict:
    p = folder / LOG_NAME
    if p.is_file():
        return json.loads(p.read_text(encoding="utf-8"))
    return {"items": []}


def save_log(folder: Path, log: dict) -> None:
    (folder / LOG_NAME).write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")


def write_sheet(folder: Path, log: dict) -> Path:
    rows = []
    for it in log["items"]:
        pics = list(it.get("shots", [])) + ([it["shot"]] if it.get("shot") else [])
        img = "".join(f'<a href="{html.escape(x)}"><img src="{html.escape(x)}" loading="lazy"></a>' for x in pics)
        joints = "".join(
            f"<li>{html.escape(j['name'])}: <b>{html.escape(j['choice'])}</b> · {html.escape(j.get('info') or '')}"
            f"{' · ' + html.escape(j['note']) if j.get('note') else ''}</li>" for j in it.get("junctions", []))
        sweeps = "".join(
            f"<li>{html.escape(s['bridge'])}: 안쪽 {s['inner']} → {s['best']:+.2f} "
            f"({' / '.join(f'{v:+.2f}: {a}' for v, a in s['history'])})</li>" for s in it.get("sweeps", []))
        rows.append(
            f"<section><h2>{html.escape(it['number'])}</h2>"
            f"<p>{html.escape(it.get('status', ''))} · {html.escape(it.get('why', ''))}</p>"
            f"<p>분석: {html.escape(', '.join(it.get('detected', [])) or '-')}"
            + (f" · <a href=\"{html.escape(it['url'])}\">덴트버드에서 열기</a>" if it.get("url") else "")
            + (f" · {html.escape(it['note'])}" if it.get("note") else "") + "</p>"
            f"<ul>{joints}{sweeps}</ul>{img}"
            f"<p class=judge>판정: 정상 / 비정상 · 메모: ____________</p></section>")
    page = (
        "<!doctype html><meta charset=utf-8><title>밤작업 검토표</title>"
        "<style>body{font-family:sans-serif;max-width:980px;margin:16px auto;padding:0 16px}"
        "section{border-bottom:1px solid #ccc;padding:12px 0}img{width:48%;margin:1%;border:1px solid #ddd;vertical-align:top}"
        "@media(max-width:700px){img{width:100%;margin:4px 0}}"
        "h2{margin:0 0 4px}.judge{color:#555}</style>"
        f"<h1>밤작업 검토표</h1><p>{time.strftime('%Y-%m-%d %H:%M')} · R = 규칙대로 완성, H = 사람이 볼 것(탭에 남김)."
        " 덴트버드 케이스 목록에서 번호로 찾으세요. 아침에 번호마다 정상·비정상만 알려 주시면 됩니다.</p>"
        + "".join(rows))
    out = folder / SHEET_NAME
    out.write_text(page, encoding="utf-8")
    return out


#: 서버PC 의 공유 폴더 (2026-11-04 사용자 "파일은 디자인PC 에서 넣고 분석은 서버PC 에서").
#: 파일은 서버PC 디스크에 있고, 디자인PC 바탕화면에는 이 폴더의 바로가기만 둡니다 — 밤에 디자인PC 를 꺼도 됩니다.
HOME_TAB = "https://ai.dentbird.com/cloud/design"

SERVER_FOLDER = Path(r"C:\DenFlow\덴트버드_밤작업")
#: 끝난 dxd 를 옮겨 두는 곳과 지우기까지의 날 수 — 서버PC SSD 가 250GB 라 dxd(100~140MB)가 쌓이면 두 달이면 찹니다
DONE_DIR = "_끝남"
KEEP_DAYS = 14
#: 이보다 최근에 바뀐 파일은 아직 복사 중일 수 있어 다음 실행으로 미룹니다 (공유 폴더로 100MB 넘게 넘어오는 중)
SETTLE_SECONDS = 120


def default_folder() -> Path:
    return SERVER_FOLDER if SERVER_FOLDER.is_dir() else Path.home() / "Desktop" / "덴트버드_밤작업"


def settled(p: Path, now: float | None = None) -> bool:
    """복사가 끝난 파일·폴더인가 — 가장 최근에 바뀐 것이 SETTLE_SECONDS 보다 오래됐으면"""
    now = time.time() if now is None else now
    files = [p] if p.is_file() else [q for q in p.rglob("*") if q.is_file()]
    try:
        return all(now - q.stat().st_mtime >= SETTLE_SECONDS for q in files)
    except OSError:
        return False


def tidy_done(folder: Path, log: dict, now: float | None = None) -> tuple[int, int]:
    """끝난 dxd 를 _끝남 으로 옮기고, KEEP_DAYS 지난 것은 지웁니다. (옮긴 수, 지운 수)

    ★ 다시 할 건(retry)은 옮기지 않습니다. 기록·그림·검토표는 그대로 둡니다(작음).
    """
    now = time.time() if now is None else now
    done_dir = folder / DONE_DIR
    finished = {it["file"] for it in log["items"] if not it.get("retry")}
    moved = removed = 0
    for p in list(folder.iterdir()):
        if p.name in finished and (p.is_file() or p.is_dir()) and not p.name.startswith(("_", ".")):
            done_dir.mkdir(exist_ok=True)
            try:
                p.rename(done_dir / p.name)
                moved += 1
            except OSError:
                pass
    for p in list(done_dir.iterdir()) if done_dir.is_dir() else []:
        try:
            if now - p.stat().st_mtime > KEEP_DAYS * 86400:
                shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink()
                removed += 1
        except OSError:
            pass
    return moved, removed


def purge_judged(folder: Path, log: dict) -> tuple[int, int]:
    """판정이 끝난 건의 dxd 원본과 그림을 지웁니다. (지운 dxd, 지운 그림)

    ★ 사용자 2026-11-04: "평가가 끝난 것들은 파일을 지워 줬으면". 기록(번호·고른 값·면적·판정)은 남깁니다 —
      규칙을 다듬을 근거는 기록이고, 환자 스캔은 판정이 끝나면 둘 까닭이 없습니다.
    """
    dxd = pics = 0
    for it in log["items"]:
        if not it.get("verdict") or it.get("purged"):
            continue
        for place in (folder / it["file"], folder / DONE_DIR / it["file"]):
            if place.is_file():
                place.unlink()
                dxd += 1
            elif place.is_dir():
                shutil.rmtree(place, ignore_errors=True)
                dxd += 1
        for rel in list(it.get("shots", [])) + ([it["shot"]] if it.get("shot") else []):
            q = folder / rel
            if q.is_file():
                q.unlink()
                pics += 1
        it["shots"], it["purged"] = [], time.strftime("%Y-%m-%d")
        it.pop("shot", None)
    return dxd, pics


def items_in(folder: Path) -> list[Path]:
    out = []
    for p in sorted(folder.iterdir()):
        if p.name.startswith(("_", ".")) or p.name in (LOG_NAME, SHEET_NAME) or p.name == "그림":
            continue
        if not settled(p):
            continue
        if p.is_file() and p.suffix.lower() == ".dxd":
            out.append(p)
        elif p.is_dir() and any(q.suffix.lower() in (".stl", ".ply", ".obj") for q in p.rglob("*")):
            out.append(p)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="밤 실행 — dxd 폴더를 덴트버드 규칙대로")
    # ★ 폴더를 안 주면 바탕화면 '덴트버드_밤작업' — .cmd 에 한글 경로를 안 쓰려고 (2026-11-03, 명령창이 한글 줄에서 멈춤)
    ap.add_argument("folder", type=Path, nargs="?", default=None,
                    help=r"안 주면 서버PC 공유 폴더(C:\DenFlow\덴트버드_밤작업), 없으면 바탕화면 '덴트버드_밤작업'")
    ap.add_argument("--limit", type=int, default=10, help="이번에 할 최대 건수 (기본 10)")
    a = ap.parse_args(argv)
    folder = a.folder or default_folder()
    shots = folder / "그림"
    shots.mkdir(parents=True, exist_ok=True)
    log = load_log(folder)
    # ★ 로그인 풀림처럼 환경 탓으로 멈춘 건(retry)은 다음 실행에 다시 합니다 (2026-11-03 시험 — DS Core 로그인 전)
    seen = {it["file"] for it in log["items"] if not it.get("retry")}
    todo = [p for p in items_in(folder) if p.name not in seen][: a.limit]
    print(f"할 것 {len(todo)}건 (이미 한 것 {len(seen)}건)")
    if not todo:
        write_sheet(folder, log)
        return 0
    if batch_running():
        print("밤 실행이 이미 돌고 있습니다 — 두 개를 같이 돌리면 크롬 탭이 겹쳐 꺼집니다")
        return 3
    if not ensure_ready():
        return 2
    def flag(note: str) -> None:
        """설계 일꾼에게 '지금 전용 크롬을 쓰는 중' 이라고 알립니다 (dentbird_web.batch_running)"""
        try:
            BATCH_FLAG.parent.mkdir(parents=True, exist_ok=True)
            BATCH_FLAG.write_text(json.dumps({"note": note, "at": time.strftime("%Y-%m-%d %H:%M:%S")}, ensure_ascii=False),
                                  encoding="utf-8")
        except OSError:
            pass

    flag("시작")
    time.sleep(5)  # 일꾼이 막 일감을 잡았다면 그쪽이 먼저 창을 쓰도록 잠깐 둡니다
    d = quietly(attach)
    place_window(d, hidden=True)
    # ★ 전 실행이나 사람이 열어 둔 덴트버드 케이스 탭을 먼저 닫습니다 (2026-11-03 시험 — 3D 탭 5개가 쌓이자
    #   크롬이 멈췄다가 꺼졌습니다). 케이스 화면이 아닌 탭 하나는 남겨 '집' 으로 씁니다.
    home_tab = quietly(bg_tab, d, HOME_TAB)
    time.sleep(4)
    for h in list(d.window_handles):
        if h != home_tab:
            close_tab(d, h)
    d.switch_to.window(home_tab)
    home = d.current_window_handle
    # ★ 개수가 아니라 쓴 번호 중 가장 큰 것 다음 — 다시 할 건이 번호를 쥔 채 남아 H06 이 겹쳤습니다 (2026-11-03)
    def top(prefix: str) -> int:
        nums = [int(it["number"][1:]) for it in log["items"] if it.get("number", "").startswith(prefix) and it["number"][1:].isdigit()]
        return max(nums, default=0)

    r_no, h_no = top("R"), top("H")

    for item in todo:
        t0 = time.time()
        def say(m: str, _n: str = item.name) -> None:
            line = f"[{time.strftime('%H:%M:%S')}] {_n}: {m}"
            print(line, flush=True)
            try:
                with (folder / LOG_TEXT).open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except OSError:
                pass
        # ★ 덴플로우 주문(설계 일꾼)이 먼저입니다 (2026-11-04 서버PC 로 옮기며). 일꾼이 '일감 있음' 을 남겼으면
        #   이 건을 시작하기 전에 크롬을 내주고, 일꾼이 끝낼 때까지(최대 30분) 기다립니다.
        if worker_wants():
            say("덴플로우 주문이 와서 설계 일꾼에게 크롬을 내줍니다")
            try:
                BATCH_FLAG.unlink()
            except OSError:
                pass
            waited = 0
            while worker_wants() and waited < 30 * 60:
                time.sleep(15)
                waited += 15
            say(f"이어서 합니다 ({waited}초 기다림)")
            d = quietly(attach)
            home = d.current_window_handle
        rec: dict = {"file": item.name, "tag": f"{time.strftime('%m%d')}_{len(log['items']) + 1:02d}"}
        flag(item.name)
        try:
            scans = prepare(item, folder / WORK_DIR / item.stem, say)
            design_one(d, item, scans, rec, say, shots)
        except Exception as e:  # noqa: BLE001 — 한 건이 실패해도 다음으로
            rec.update(status="hold", why=f"{type(e).__name__}: {e}")
            # ★ 로그인 풀림·크롬 멈춤은 그 케이스 탓이 아닙니다 — 다음 실행에 다시 합니다
            if re.search(r"로그인|renderer|invalid session|disconnected|no such window|계산이 안 끝납니다|생성이 안 끝납니다", str(e)):
                rec["retry"] = True
            say("멈춤 — " + rec["why"])
            (folder / WORK_DIR).mkdir(exist_ok=True)
            (folder / WORK_DIR / f"{item.stem}_오류.txt").write_text(traceback.format_exc(), encoding="utf-8")
        if rec.get("status") == "done":
            r_no += 1
            rec["number"] = f"R{r_no:02d}"
            rec["shots"] = name_shots(folder, rec["number"], rec.get("shots", []))
        else:
            h_no += 1
            rec["number"] = f"H{h_no:02d}"
        what = " ".join("브릿지 " + b for b in rec.get("bridges", [])) or ", ".join(rec.get("detected", [])[:3])
        try:
            on_screen = "dentbird.com" in (d.current_url or "") and d.current_window_handle != home
        except Exception:  # noqa: BLE001 — 크롬이 멈췄거나 꺼짐
            on_screen = False
            try:
                # ★ 크롬이 꺼졌으면 다시 띄우고 이어 갑니다 (2026-11-04 — 12:14 크롬 끊김으로 남은 건을 못 함)
                if not alive():
                    say("전용 크롬이 꺼져 다시 띄웁니다")
                    if not ensure_ready(say):
                        raise RuntimeError("크롬을 다시 못 띄움")
                d = quietly(attach)
                place_window(d, hidden=True)
                home = quietly(bg_tab, d, HOME_TAB)
                rec["retry"] = True  # 이 건은 크롬 탓 — 다음 실행에 다시
            except Exception:  # noqa: BLE001
                rec["retry"] = True
                log["items"] = [it for it in log["items"] if it["file"] != item.name] + [rec]
                save_log(folder, log)
                write_sheet(folder, log)
                say("덴트버드 전용 크롬이 응답하지 않아 여기서 멈춥니다 — 크롬을 다시 띄우고 다시 시작해 주세요")
                break
        if on_screen:
            # ★ 이름 바꾸기·저장은 뺐습니다 (2026-11-04) — 덴트버드가 생성한 디자인을 남기지 않아 아침에 열 일이 없고,
            #   판별은 그림 네 장으로 합니다. 건마다 10초쯤 줄어듭니다.
            # ★ 전체 화면 그림은 **보류 건에만** — 왜 멈췄는지 보려고. 완성 건은 크라운 네 장이면 됩니다(사용자 2026-11-04).
            if rec.get("status") != "done":
                try:
                    shot = shots / f"{rec['number']}.png"
                    d.save_screenshot(str(shot))
                    rec["shot"] = f"그림/{shot.name}"
                except Exception:  # noqa: BLE001
                    pass
            # ★ 보류(H) 건도 탭을 닫습니다 (2026-11-03 시험 — 덴트버드 탭 5개가 쌓이자 크롬 렌더러가 멈춰
            #   다음 건이 '계산이 안 끝납니다' 로 죽었습니다). 이름을 H번호로 바꿔 저장했으니 목록에서 엽니다.
            try:
                close_tab(d, d.current_window_handle)
                d.switch_to.window(home)
            except Exception:  # noqa: BLE001
                d = quietly(attach)
                home = d.current_window_handle
        rec["seconds"] = round(time.time() - t0)
        log["items"] = [it for it in log["items"] if it["file"] != item.name]  # 다시 한 건은 옛 줄을 바꿔 씁니다
        log["items"].append(rec)
        save_log(folder, log)
        write_sheet(folder, log)
        say(f"{rec['number']} — {rec['status']} ({rec['seconds']}초)")
        # ★ 바꾼 스캔(ply·stl, 건당 수백 MB)은 건마다 지웁니다 — 끝에 한꺼번에 지우면 30건이면 10GB 가까이 쌓입니다
        shutil.rmtree(folder / WORK_DIR / item.stem, ignore_errors=True)

    try:
        BATCH_FLAG.unlink()
    except OSError:
        pass
    work = folder / WORK_DIR
    for sub in work.iterdir() if work.is_dir() else []:
        if sub.is_dir():
            shutil.rmtree(sub, ignore_errors=True)  # 바꾼 스캔은 남기지 않습니다 (원본 dxd 는 그대로)
    moved, removed = tidy_done(folder, log)
    gone_dxd, gone_pics = purge_judged(folder, log)
    if gone_dxd or gone_pics:
        save_log(folder, log)
        print(f"판정 끝난 건의 dxd {gone_dxd}개·그림 {gone_pics}장을 지움")
    if moved or removed:
        print(f"끝난 dxd {moved}개를 {DONE_DIR} 로 옮김, {KEEP_DAYS}일 지난 것 {removed}개 지움")
    print(f"끝 — 검토표: {write_sheet(folder, log)}")
    return 0


def _run() -> int:
    """main 을 돌리되, 시작 단계의 말과 오류도 진행 기록에 남깁니다 (2026-11-04).

    ★ 단추 하나로 바꾸며 검은 창을 작업표시줄로 내렸습니다. 첫 시도가 시작하자마자 멈췄는데, 이유가 그 창에만
      찍혀 있어 볼 수 없었습니다. print 를 진행 기록 파일에도 함께 씁니다.
    """
    import builtins  # noqa: PLC0415

    log_file = default_folder() / LOG_TEXT
    real_print = builtins.print

    def both(*a, **k):
        real_print(*a, **k)
        try:
            line = " ".join(str(x) for x in a)
            if not line.startswith("["):  # 건마다 쓰는 줄은 이미 파일에 씁니다
                with log_file.open("a", encoding="utf-8") as f:
                    f.write(f"[{time.strftime('%H:%M:%S')}] (시작) {line}\n")
        except OSError:
            pass

    builtins.print = both
    try:
        return main()
    except Exception:  # noqa: BLE001
        print("멈춤 — " + traceback.format_exc().strip().splitlines()[-1])
        try:
            with log_file.open("a", encoding="utf-8") as f:
                f.write(traceback.format_exc())
        except OSError:
            pass
        try:
            BATCH_FLAG.unlink()  # 죽은 실행의 표시가 다음 실행을 막지 않게
        except OSError:
            pass
        return 1
    finally:
        builtins.print = real_print


if __name__ == "__main__":
    raise SystemExit(_run())
