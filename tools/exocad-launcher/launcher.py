# -*- coding: utf-8 -*-
"""
덴플로우 → exocad 런처. (2026-09-09, 설계서 exocad-연동-설계서.md v2)

브라우저가 `denflow://exocad/<주문ID>?t=<토큰>` 을 열면 윈도우가 이 프로그램을
띄웁니다 (install.py 가 레지스트리에 등록). 상주하지 않습니다 — 한 건 끝나면 꺼집니다.

하는 일:
  1. 덴플로우 API 에서 주문 정보(환자·치식·브릿지·스캔 주소)를 받는다
  2. 스캔 파일을 내려받는다
  3. exocad 케이스 폴더 `CAD-Data/yyyy-mm-dd_환자명/` 을 만들고
     .dentalProject 를 조립해 넣고, stl/obj/ply 는 악 이름을 맞춰 넣는다
  4. dxd 가 있으면 기존 변환기(dxd-conversion.exe)를 띄우고 사람이 두 번
     끌어다 놓도록 안내한다 (★ 1단계 — DS Core 자동화는 나중)
  5. 덴플로우에 결과를 한 번 알린다
  6. "exocad 에서 가져오기(Import)를 누르세요" 를 보여 주고 닫힌다

★ 실패해도 덴플로우의 주문은 그대로입니다. 폴더를 지우면 없던 일입니다.
★ 로그는 logs/ 에 남습니다 — 창을 닫아도 무엇이 됐는지 알 수 있게.

시험:  python launcher.py --mock mock.json    (API 대신 파일을 읽음)
"""
from __future__ import annotations

# ★★ 아래 import 보다 **먼저** 둡니다. requests 나 tkinter 가 없는 날이면
#   그 줄에서 죽는데, 그러면 이 기록조차 안 남습니다.

def _called(note: str) -> None:
    """**불렸다는 사실 하나**를 가장 먼저 적습니다 (2026-10-14).

    ★★ **왜 — 조용히 죽으면 아무 데도 안 남습니다.** pythonw 는 창도
      콘솔도 없어서, 로그 설정에 닿기 전에 터지면 흔적이 0 입니다. 화면엔
      '여는 중' 만 남고, 사람은 브라우저가 안 부른 건지 런처가 죽은 건지
      **구별할 수가 없습니다.** 실제로 그 자리에서 이틀을 썼습니다.
    ★ 그래서 import 보다 먼저, 표준 라이브러리만으로 한 줄 적습니다.
      이 줄이 있으면 '불리긴 했다', 없으면 '브라우저가 안 불렀다' 입니다.
    """
    try:
        import datetime
        import os
        import sys
        from pathlib import Path

        d = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "launcher"
        d.mkdir(parents=True, exist_ok=True)
        # ★ 저장소에도 (2026-10-16) — 작업 도구 쪽에서는 실제 AppData 가 안 보여서
        try:
            with (Path(__file__).resolve().parent / "_real_state.txt").open("a", encoding="utf-8") as g:
                g.write(f"런처 {datetime.datetime.now():%Y-%m-%d %H:%M:%S} 불림 {note[:60]}" + chr(10))
        except Exception:  # noqa: BLE001
            pass
        with (d / "불렸습니다.txt").open("a", encoding="utf-8") as f:
            f.write(f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S} {note}\n")
    except Exception:  # noqa: BLE001 — 기록 때문에 런처가 죽으면 안 됩니다
        pass


import sys as _sys  # noqa: E402 — 기록 한 줄에만 씁니다
_called(" ".join(_sys.argv[1:]) or "(인자 없음)")


def _crash_to_repo(kind, value, tb):  # noqa: ANN001
    """★ 죽으면 까닭을 저장소에 (2026-10-16) — pythonw 라 어디에도 안 남던 것"""
    try:
        import traceback as _tb
        from pathlib import Path as _P
        with (_P(__file__).resolve().parent / "_real_state.txt").open("a", encoding="utf-8") as g:
            g.write("런처 죽음: " + "".join(_tb.format_exception(kind, value, tb))[-1500:] + chr(10))
    except Exception:  # noqa: BLE001
        pass


_sys.excepthook = _crash_to_repo


def _step(name: str) -> None:
    """실제 쪽 런처의 흔적을 저장소 _real_state.txt 에 (2026-10-16 — AppData 가 안 보여서)"""
    try:
        from pathlib import Path as _P
        with (_P(__file__).resolve().parent / "_real_state.txt").open("a", encoding="utf-8") as g:
            g.write(f"런처 단계 {name}" + chr(10))
    except Exception:  # noqa: BLE001
        pass



import datetime as dt
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import tkinter as tk
import zipfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))



import make_project  # noqa: E402
from state import adopt_seeds, folder as state_folder, migrate  # noqa: E402

#: ★★ 적어 두는 것은 **코드 폴더 밖**입니다 (2026-10-13 — state.py 참고).
#:   등록된 자리를 저장소로 옮기면서, 설정·로그·크롬 로그인은 옛 폴더에서
#:   한 번 옮겨 옵니다. 다시 로그인하지 않아도 되게요.
migrate(Path.home() / "Desktop" / "denflow-exocad")
# ★ 저장소에 잠깐 둔 설정 사본을 실제 사용자 폴더로 (2026-10-16 — state.adopt_seeds)
_seeded = adopt_seeds()
if _seeded:
    _step("설정 옮김 " + ",".join(_seeded))

CONFIG_PATH = state_folder() / "config.json"
LOG_DIR = state_folder() / "logs"


# ---------- 설정 ----------

def load_config() -> dict:
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    cfg.setdefault("base_url", "https://denflow.kr")
    return cfg


# ---------- 파일 이름 ----------

UPPER = re.compile(r"upperjaw|maxillar|upper|상악", re.I)
LOWER = re.compile(r"lowerjaw|mandibul|lower|하악", re.I)
BITE = re.compile(r"occlusion|bite|바이트", re.I)
MARKER = re.compile(r"marker|scanbody|scan.?body|abutment.?align", re.I)
#: ★★ 어느 악인지 **이름에 안 적는** 스캐너가 있습니다 (2026-10-06, 박상균 건).
#:   'Raw Preparation scan' = 깎은 쪽, 'Raw Antagonist scan' = 그 반대쪽.
#:   상·하악은 **주문의 치식**으로 정합니다 — 14번이면 상악입니다.
#: ★ 전에 여기 `\bprep\b` 를 적었는데 소스에 **진짜 백스페이스 문자**가
#:   들어가 있었습니다(0x08). 날것 문자열이라 그대로 남아, 그 갈래는
#:   아무것도 못 맞췄습니다 — `Prep.stl` 만 온 날이면 이름을 못 바꿉니다.
PREP = re.compile(r"preparation|\bprep\b|die|지대|작업치", re.I)
#: ★★ **삭제 전 스캔**입니다 (2026-10-14). 치과가 `PrePreparationScan.stl`
#:   을 같이 올립니다 — 깎기 **전** 모양이라 지대치가 아닙니다. 이름에
#:   'prep' 이 들어 있어 PREP 에 걸렸고, 그러면 지대치 스캔과 **같은**
#:   **이름**이 되어 둘 중 하나가 덮여 사라졌습니다. 어느 쪽이 남을지는
#:   내려받는 차례에 달려 있었습니다 — 삭제 전 것이 남으면 exocad 가
#:   **안 깎은 치아 위에** 설계합니다.
#: ★ exocad 가 쓰는 이름은 `-situ` 입니다. 사장님 케이스 폴더에서 찾았습니다
#:   (…-upperjaw-situ.ply 가 …-upperjaw.ply 옆에 나란히 있습니다).
SITU = re.compile(r"pre.?preparation|pre.?op|situation|situ|삭제.?전|프렙.?전", re.I)
ANTAGONIST = re.compile(r"antagonist|opposing|대합", re.I)


def working_jaw(teeth: list[int]) -> str | None:
    """치식이 어느 악인가 — 'upper' · 'lower'. 두 악에 걸쳐 있으면 모릅니다"""
    up = any(11 <= t <= 28 for t in teeth)
    low = any(31 <= t <= 48 for t in teeth)
    if up and not low:
        return "upper"
    if low and not up:
        return "lower"
    return None


def place_name(folder_name: str, original: str, jaw: str | None = None) -> str:
    """
    exocad 가 자동 인식하는 이름으로. 못 맞추면 원래 이름 그대로 (exocad 에서 고름).

    ★ exocad 는 폴더 안에서 **이름으로** 스캔을 찾습니다:
        <폴더명>-upperjaw.stl · -lowerjaw.stl · -upperjaw-marker.stl
      (사장님 케이스 폴더들에서 확인한 규칙입니다.)
    ★ 바이트는 그대로 둡니다 — 쓰긴 쓰는데 exocad 가 자동으로 집는 이름이
      무엇인지 아직 못 밝혔습니다. 사람이 고르면 됩니다.
    """
    ext = Path(original).suffix.lower()
    stem = Path(original).stem
    if ext not in (".stl", ".obj", ".ply"):
        return original

    # 바이트는 그대로 둡니다 — exocad 가 자동으로 집는 이름을 아직 모릅니다
    if BITE.search(stem):
        return original

    other = {"upper": "lower", "lower": "upper"}.get(jaw or "")

    # ★★ **무엇인지**(꼬리표)와 **어느 악인지**(쪽)를 따로 정합니다 (2026-10-14).
    #   전에는 하나의 긴 if 사슬이라 **먼저 걸리는 쪽이 이겼습니다.**
    #   `UpperJaw_PreOp.stl` 이면 상악에 먼저 걸려, 삭제 전 스캔이
    #   지대치 자리를 차지했습니다. 둘은 다른 질문이라 따로 묻습니다.
    if MARKER.search(stem):
        tag = "-marker"          # 스캔바디
    elif SITU.search(stem):
        tag = "-situ"            # 삭제 전 — 지대치와 **다른 이름**이어야 합니다
    else:
        tag = ""

    # 쪽은 이름에 적혀 있으면 그대로, 없으면 **주문의 치식**으로 정합니다.
    # ★ SITU 를 UPPER/LOWER 보다 먼저 보지 않습니다 — 이름에 악이 적혀
    #   있으면 그게 더 정확합니다. 꼬리표는 위에서 이미 떼어 뒀습니다.
    if UPPER.search(stem):
        side = "upper"
    elif LOWER.search(stem):
        side = "lower"
    elif ANTAGONIST.search(stem):
        side = other             # 대합치 — 깎은 쪽의 **반대**
    elif tag or PREP.search(stem):
        side = jaw               # 지대치(작업치) · 스캔바디 · 삭제 전
    else:
        side = None

    if not side:
        return original          # 못 맞추면 원래 이름 — exocad 에서 사람이 고릅니다
    return f"{folder_name}-{side}jaw{tag}{ext}"


def unzip_scans(zip_path: Path, into: Path) -> list[Path]:
    """
    zip 으로 올라온 스캔을 풀어 둡니다 (사용자 물음 2026-10-06).

    ★ exocad 는 zip 을 못 엽니다. 그대로 두면 사람이 손으로 풀어야 합니다.
    ★ 쓸 만한 것만 꺼냅니다 — 그물(stl·obj·ply)·dxd·3Shape 주문서
      (.constructionInfo). 그 밖의 것은 두고 옵니다.
    ★ 한글 이름이 깨지지 않게 CP949 로 되돌립니다. 'UTF-8 이다' 표시가 없는
      zip 은 파이썬이 CP437 로 읽어 '└╟ ─╔' 처럼 됩니다 (메딧 zip 에서 겪음).
    ★ 폴더 구조는 버리고 **파일만** 꺼냅니다. exocad 는 케이스 폴더 바로 아래를 봅니다.
    """
    keep = (".stl", ".obj", ".ply", ".dxd", ".constructioninfo")
    out: list[Path] = []

    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue

            name = info.filename
            if not (info.flag_bits & 0x800):
                try:
                    name = name.encode("cp437").decode("cp949")
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass

            leaf = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            if not leaf or not leaf.lower().endswith(keep):
                continue

            target = into / leaf
            with z.open(info) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst)
            out.append(target)

    return out


def unique_folder(base: Path) -> Path:
    """이미 있으면 _2, _3 … exocad 가 열어 둔 폴더를 덮어쓰지 않습니다."""
    if not base.exists():
        return base
    n = 2
    while True:
        cand = base.with_name(f"{base.name}_{n}")
        if not cand.exists():
            return cand
        n += 1


# ---------- 화면 ----------

STEPS = ["주문 정보 받기", "스캔 파일 내려받기", "exocad 주문서 만들기", "dxd 변환 (DS Core)", "exocad 목록에 등록"]
TOAST_MS = 3000

#: 한 건이 이보다 오래 걸리면 **스스로 멈춥니다** (사용자 요청 2026-10-13 —
#: "5분 이상 넘어가면 멈추는걸로 해줘, 메모리만 차지하는거같은데").
#:
#: ★★ **왜 — 안 끝나는 길이 실제로 있습니다.** DS Core 가 응답을 안 하거나
#:   로그인 화면이 바뀌면 셀레니움이 기다림 안에서 서 있고, 자리가 안 비면
#:   `_wait_slot` 이 20분을 기다립니다. 그동안 창과 Chrome 이 떠 있습니다.
#:   사람은 화면에서 '여는 중' 만 보고, 뭘 해야 할지 알 길이 없습니다.
#: ★ 평소 dxd 한 건은 **56초**입니다 (DESIGN.md 6-4). 5분은 느린 날에도
#:   넉넉하고, 매달려 있는 것과는 분명히 다릅니다.
#: ★ 조용히 죽지 않습니다 — 서버에 '실패' 로 알리고 갑니다. 그래야 주문
#:   화면의 알약이 '여는 중' 에서 '!' 로 바뀝니다.
JOB_LIMIT_MINUTES = 5


class Window:
    """
    토스트만. (2026-09-10 — 사용자: "토스트 정도만, 실패했을 때만 알림창")
      - 시작: "덴플로우 → exocad · 홍길동 ORD-… 보내는 중" 3초
      - 끝:   "✓ 완료 — exocad 에서 홍길동 을 여세요" 3초
      - 실패: 알림창(이유 + [로그 열기] [닫기]) — 이것만 사람이 닫습니다
    ★ 진행 중에는 아무것도 안 떠 있습니다. 어디까지 갔는지는 logs/ 의 실행 로그가 압니다.
    ★ 창을 다 닫아도 프로세스는 남은 뒷정리(임시 환자 삭제)가 끝난 뒤 꺼집니다.
    """

    W, H = 380, 58

    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.withdraw()
        self.folder: Path | None = None
        self._case = ""
        self._toast: tk.Toplevel | None = None
        self.log_lines: list[str] = []

    def _show_toast(self, title: str, sub: str, fg: str = "#FFFFFF", ms: int = TOAST_MS) -> None:
        F = "Malgun Gothic"
        if self._toast is not None:
            try:
                self._toast.destroy()
            except Exception:  # noqa: BLE001
                pass
        t = tk.Toplevel(self.root)
        t.overrideredirect(True)
        t.attributes("-topmost", True)
        t.configure(bg="#1A2130")
        sw, sh = t.winfo_screenwidth(), t.winfo_screenheight()
        t.geometry(f"{self.W}x{self.H}+{sw - self.W - 16}+{sh - self.H - 60}")
        tk.Label(t, text=title, font=(F, 10, "bold"), bg="#1A2130", fg=fg, anchor="w").pack(fill="x", padx=14, pady=(10, 0))
        tk.Label(t, text=sub, font=(F, 9), bg="#1A2130", fg="#9AA3B2", anchor="w").pack(fill="x", padx=14)
        self._toast = t
        t.after(ms, t.destroy)

    # -- 바깥에서 부르는 것 --
    def set_case(self, patient: str, order_no: str) -> None:
        self._case = f"{patient} · {order_no}"
        self.root.after(0, lambda: self._show_toast("덴플로우 → exocad 보내는 중", self._case))

    def step(self, msg: str) -> None:
        self.log_lines.append(msg)

    def log(self, msg: str) -> None:
        self.log_lines.append(msg)

    def finish(self, title: str, ok: bool, log_dir: Path | None = None) -> None:
        def _f() -> None:
            if ok:
                self._show_toast("✓ " + title, self._case, fg="#7EE2A8")
                # quit 은 Job 이 뒷정리(임시 환자 삭제)를 끝낸 뒤 부릅니다
            else:
                self._fail_dialog(title, log_dir)
        self.root.after(0, _f)

    def _fail_dialog(self, title: str, log_dir: Path | None) -> None:
        F = "Malgun Gothic"
        d = tk.Toplevel(self.root)
        d.title("덴플로우 → exocad 실패")
        d.configure(bg="#FFFFFF")
        d.attributes("-topmost", True)
        d.geometry("520x360")
        tk.Label(d, text="✕ " + title, font=(F, 12, "bold"), bg="#FFFFFF", fg="#D93025", anchor="w").pack(fill="x", padx=20, pady=(16, 2))
        tk.Label(d, text=self._case, font=(F, 9), bg="#FFFFFF", fg="#7C8595", anchor="w").pack(fill="x", padx=20)
        text = tk.Text(d, font=(F, 9), fg="#4A5567", bg="#F8F9FB", relief="flat", wrap="word", height=10)
        text.pack(fill="both", expand=True, padx=20, pady=(8, 0))
        text.insert("end", "\n".join(self.log_lines[-40:]))
        text.config(state="disabled")
        row = tk.Frame(d, bg="#FFFFFF")
        row.pack(fill="x", padx=20, pady=12)
        tk.Button(row, text="닫기", command=self.root.quit, width=8, relief="flat", bg="#EEF1F5", font=(F, 10)).pack(side="right")
        if log_dir:
            tk.Button(row, text="로그 열기", command=lambda: subprocess.Popen(["explorer", str(log_dir)]), width=9, relief="flat",
                      bg="#F2F7FE", fg="#1279E8", font=(F, 10, "bold")).pack(side="right", padx=(0, 8))
        if self.folder and self.folder.exists():
            tk.Button(row, text="폴더 열기", command=lambda: subprocess.Popen(["explorer", str(self.folder)]), width=9, relief="flat",
                      bg="#F2F7FE", fg="#1279E8", font=(F, 10)).pack(side="left")
        d.protocol("WM_DELETE_WINDOW", self.root.quit)

    def choose_dxd(self, files: list[dict]) -> str:
        """dxd 가 여럿이면 하나를 고르게 합니다 (사용자 요청 2026-09-10 — "내가 한 개 고르는 게 좋겠다").
           고르기 전에는 아무것도 내려받지 않습니다. 취소하면 이번 보내기는 없던 일입니다."""
        done = threading.Event()
        result: list[str] = []

        def _ask() -> None:
            F = "Malgun Gothic"
            top = tk.Toplevel(self.root)
            top.title("dxd 고르기")
            top.configure(bg="#FFFFFF")
            top.attributes("-topmost", True)
            top.grab_set()
            tk.Label(top, text="이 주문에 dxd 가 여러 개입니다. exocad 로 보낼 것을 고르세요.",
                     font=(F, 11, "bold"), bg="#FFFFFF", fg="#1A2130", anchor="w").pack(fill="x", padx=20, pady=(16, 8))
            var = tk.StringVar(value=files[0]["name"])
            for f in files:
                size = f.get("size") or 0
                label = f"{f['name']}   ({size / 1e6:.0f} MB)" if size else f["name"]
                tk.Radiobutton(top, text=label, variable=var, value=f["name"], font=(F, 10), bg="#FFFFFF",
                               activebackground="#FFFFFF", anchor="w", selectcolor="#F5F2FE").pack(fill="x", padx=24, pady=2)
            row = tk.Frame(top, bg="#FFFFFF")
            row.pack(fill="x", padx=20, pady=14)

            def ok() -> None:
                result.append(var.get())
                top.destroy()
                done.set()

            def cancel() -> None:
                top.destroy()
                done.set()

            tk.Button(row, text="이걸로 보내기", command=ok, width=12, relief="flat", bg="#6B3FD6", fg="#FFFFFF", font=(F, 10, "bold")).pack(side="right")
            tk.Button(row, text="취소", command=cancel, width=8, relief="flat", bg="#EEF1F5", fg="#1A2130", font=(F, 10)).pack(side="right", padx=(0, 8))
            top.protocol("WM_DELETE_WINDOW", cancel)

        self.root.after(0, _ask)
        done.wait()
        if not result:
            raise RuntimeError("dxd 를 고르지 않아 보내기를 취소했습니다")
        return result[0]

    def ask_dscore_account(self, save) -> None:
        """DS Core 계정을 처음 한 번 묻습니다 (사용자 지시 2026-09-10 — 사람마다 계정이 다름).
           런처 폴더의 settings.json 에만 저장되고 덴플로우에는 안 올라갑니다."""
        import tkinter.simpledialog as sd
        done = threading.Event()
        result: dict = {}

        def _ask() -> None:
            email = sd.askstring("DS Core 계정", "DS Core 이메일", parent=self.root)
            pw = sd.askstring("DS Core 계정", "DS Core 비밀번호", parent=self.root, show="*") if email else None
            if email and pw:
                result.update(email=email.strip(), password=pw)
            done.set()

        self.root.after(0, _ask)
        done.wait()
        if not result:
            raise RuntimeError("DS Core 계정이 없어 dxd 를 변환할 수 없습니다")
        save(result["email"], result["password"])


# ---------- 본 작업 ----------

class Job:
    def __init__(self, win: Window, cfg: dict, order_id: str | None, token: str | None, mock: Path | None) -> None:
        self.win, self.cfg, self.order_id, self.token, self.mock = win, cfg, order_id, token, mock
        self.log = logging.getLogger("launcher")
        self.t0 = time.time()
        self.marks: list[tuple[str, float]] = []   # (단계, 끝난 시각) — 어디가 느린지 보려고
        self.order_no = order_id or "mock"
        self.after_done = None                     # 완료 표시 뒤에 할 뒷정리 (임시 환자 삭제)
        self.over = False                          # 끝났는가 — 시한 지킴이가 이걸 봅니다
        self.told = False                          # 서버에 결과를 알린 적이 있는가

    def mark(self, name: str) -> None:
        self.marks.append((name, time.time()))

    def durations(self) -> str:
        out, prev = [], self.t0
        for name, t in self.marks:
            out.append(f"{name} {t - prev:.0f}s")
            prev = t
        return " · ".join(out) + f" · 합계 {time.time() - self.t0:.0f}s"

    def summary(self, result: str, message: str) -> None:
        """runs.csv 한 줄 — 언제·무슨 주문·결과·단계별 시간. 엑셀로 열어 보면 병목이 보입니다."""
        try:
            f = LOG_DIR / "runs.csv"
            new = not f.exists()
            with open(f, "a", encoding="utf-8-sig") as h:
                if new:
                    h.write("시각,주문,환자,결과,걸린시간(초),단계별,메모\n")
                h.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S},{self.order_no},{getattr(self, 'patient', '')},{result},{time.time() - self.t0:.0f},{self.durations()},{message.replace(',', ' ')[:200]}\n")
        except Exception:  # noqa: BLE001
            self.log.exception("runs.csv")

    def api(self, path: str) -> str:
        return f"{self.cfg['base_url']}/api/exocad/orders/{self.order_id}{path}?t={self.token}"

    def say(self, msg: str) -> None:
        self.log.info(msg)
        self.win.step(msg)

    def note(self, msg: str) -> None:
        self.log.info(msg)
        self.win.log("  " + msg)

    def report(self, status: str, message: str) -> None:
        # ★ 알린 적이 있으면 지킴이는 다시 안 알립니다 — 끝난 일을
        #   '실패' 로 덮어쓰면 화면이 거짓말을 합니다
        self.told = True
        if self.mock:
            return
        try:
            requests.post(self.api("/result"), json={"status": status, "message": message[:500]}, timeout=15)
        except Exception as e:  # noqa: BLE001
            self.log.warning("결과 보고 실패: %s", e)

    def run(self) -> None:
        try:
            self._run()
            self.log.info("시간: %s", self.durations())
        except Exception as e:  # noqa: BLE001
            self.log.exception("실패")
            self.win.log(f"오류: {e}")
            self.summary("실패", str(e))
            self.win.finish(f"실패 — {e}", ok=False, log_dir=LOG_DIR)
            self.report("failed", str(e))
            # ★ 실패 창은 사람이 읽으라고 띄워 둡니다. 지킴이가 그걸 닫아
            #   버리지 않게 여기서 깃발을 꽂습니다.
            self.over = True
            return

        # ★ 뒷정리(임시 환자 삭제)는 완료 토스트 뒤에 — 사람은 안 기다립니다.
        #   ★ 깃발은 **뒷정리까지 끝난 뒤**에 꽂습니다. 뒷정리도 DS Core 를
        #     건드리는 일이라 거기서 설 수 있습니다 — 그 자리도 지킴이가
        #     봐야 합니다. 이미 '완료' 를 알린 뒤라 지킴이는 조용히 닫습니다.
        if self.after_done:
            try:
                self.after_done()
            except Exception:  # noqa: BLE001
                self.log.exception("뒷정리 실패")
        self.over = True
        self.win.root.after(0, self.win.root.quit)

    def give_up(self) -> None:
        """시한을 넘겼습니다. 치우고 나갑니다 (2026-10-13).

        ★★ **일하는 실을 깨울 수가 없습니다.** 셀레니움 기다림이나 소켓
          안에 서 있으면 밖에서 멈추게 할 길이 없습니다. 그래서 치울 것을
          치우고 **프로세스째** 나갑니다 — 남겨 두면 그게 사장님이 보신
          '메모리만 차지하는' 창입니다.
        ★ 나가기 전에 두 가지를 합니다. 서버에 까닭을 알리고(알린 적이
          없을 때만), DS Core 가 띄운 Chrome 과 쥐고 있던 자리를 놓습니다.
          안 놓으면 다음 실행이 프로필을 못 잡고 자리도 30분 묶입니다.
        """
        if self.over:
            return

        at = self.marks[-1][0] if self.marks else "시작"
        why = f"{JOB_LIMIT_MINUTES}분이 지나도 안 끝나 멈췄습니다 (마지막 단계: {at})"
        self.log.error(why)
        self.summary("시한초과", why)

        if not self.told:
            self.report("failed", why)

        # ★ **이미 불러온 때만** 치웁니다. dxd 변환이 없는 주문은 dscore 를
        #   건드린 적이 없습니다 — 그때 여기서 처음 불러오면 셀레니움을
        #   끌고 오느라 나가는 길이 느려지고, 그 import 가 터지면 알리지도
        #   못하고 멈춥니다. 안 띄웠으면 치울 것도 없습니다.
        mod = sys.modules.get("dscore")
        if mod is not None:
            try:
                mod.abandon()
            except Exception:  # noqa: BLE001
                self.log.exception("DS Core 뒷정리 실패")

        # ★ quit() 이 아니라 _exit 입니다 — 일하는 실이 어딘가에 서 있어서
        #   보통의 끝내기로는 안 끝납니다.
        os._exit(1)

    def _run(self) -> None:
        # 1. 주문 정보
        self.say("1/5 덴플로우에서 주문 정보를 받는 중")
        if self.mock:
            data = json.loads(self.mock.read_text(encoding="utf-8"))
        else:
            r = requests.get(self.api(""), timeout=30)
            if r.status_code != 200:
                raise RuntimeError(f"덴플로우가 거절했습니다 ({r.status_code}): {r.json().get('error', r.text)}")
            data = r.json()
        patient = data["patientName"]
        # ★★ 폴더 날짜는 **오늘** 입니다 (사용자 지적 2026-10-06).
        #   전에는 주문일을 썼습니다 — 어제 들어온 주문을 오늘 보내면 폴더가
        #   어제 날짜로 생겨, exocad 목록에서 오늘 보낸 것을 못 찾습니다.
        #   DB 의 t_date 와 XML 의 DateTime 도 같이 맞춥니다 (어긋나면 exocad 가
        #   "이 프로젝트의 파일은 유효하지 않습니다" 라고 합니다 — 2026-09-10 확인).
        # ★ 값: 같은 주문을 다른 날 또 보내면 폴더가 하나 더 생깁니다. 같은 날
        #   다시 보내면 전처럼 덮어씁니다.
        order_date = dt.date.today().isoformat()
        self.patient = patient
        self.order_no = data.get("orderNo", self.order_no)
        self.win.set_case(patient, self.order_no)
        self.mark("주문정보")
        self.note(f"{data.get('orderNo', '')} · {patient} · 치아 {[t['number'] for t in data['teeth']]}")
        if data.get("unknownTypes"):
            self.note(f"★ exocad 로 못 옮긴 종류: {data['unknownTypes']} — 주문서에서 빠집니다. exocad 에서 손으로 추가하세요")
        if not data["teeth"]:
            raise RuntimeError("작업 치아가 하나도 없습니다")

        # 2. 폴더
        cad = Path(self.cfg["exocad_dir"]) / "CAD-Data"
        if not cad.is_dir():
            raise RuntimeError(f"CAD-Data 폴더가 없습니다: {cad}")
        # ★ 같은 주문을 다시 보내면 **같은 폴더에 덮어씁니다** (사용자 지적 2026-09-10 —
        #   "환자명이 zz 인데 zz_2 를 확인하라니 맞지 않다"). exocad 에 이미 가져온
        #   케이스면 그 폴더의 스캔만 새것으로 바뀌어 그대로 열립니다.
        #   exocad 가 파일을 잡고 있어 못 쓸 때만 _2 로 비켜 갑니다 (아래).
        folder = cad / f"{order_date}_{patient}"
        folder_name = folder.name
        if folder.exists():
            self.note(f"같은 폴더가 있어 안의 주문서·스캔을 새로 씁니다: {folder.name}")
        self.win.folder = folder

        # 3. 스캔 내려받기 — dxd 가 여럿이면 먼저 하나 고름 (고른 것만 내려받음)
        files = data.get("files", [])
        dxd_files = [f for f in files if f["name"].lower().endswith(".dxd")]
        if len(dxd_files) > 1:
            self.say("1/5 dxd 가 여러 개 — 하나를 고르세요")
            chosen = self.win.choose_dxd(dxd_files)
            files = [f for f in files if not f["name"].lower().endswith(".dxd") or f["name"] == chosen]
            self.note(f"고른 dxd: {chosen}")
        self.say(f"2/5 스캔 파일 {len(files)}개 내려받는 중")
        tmp = Path(tempfile.mkdtemp(prefix="denflow-"))
        got: list[Path] = []
        for f in files:
            dest = tmp / f["name"]
            if self.mock and not f["url"].startswith("http"):
                shutil.copyfile(f["url"], dest)
            else:
                with requests.get(f["url"], stream=True, timeout=60) as r:
                    r.raise_for_status()
                    with open(dest, "wb") as out:
                        for chunk in r.iter_content(1 << 20):
                            out.write(chunk)
            got.append(dest)
            self.note(f"{f['name']} ({dest.stat().st_size / 1e6:.1f} MB)")

        self.mark("내려받기")
        # 4. 주문서 + 배치
        self.say("3/5 exocad 주문서를 만드는 중")
        make_project.CAD_DATA = cad
        make_project.SAMPLE = HERE / "template.dentalProject"
        import uuid
        import exocad_db
        project_guid = str(uuid.uuid4())
        # ★ exocad 는 케이스 폴더를 "등록 날짜_이름" 으로 찾습니다 (2026-09-10 확인 —
        #   날짜가 어긋나면 "이 프로젝트의 파일은 유효하지 않습니다"). 그래서 DB 의 t_date 와
        #   XML 의 DateTime 을 **폴더 날짜(오늘)** 로 맞추고 시각만 지금으로 둡니다.
        now = dt.datetime.now().astimezone()
        made_at = dt.datetime.combine(dt.date.fromisoformat(order_date), now.time(), tzinfo=now.tzinfo)
        # ★ 주문서(XML)는 환자 번호가 정해진 뒤(DB 등록 뒤)에 씁니다. 여기서는 폴더만.
        try:
            folder.mkdir(parents=True, exist_ok=True)
            probe = folder / ".denflow-write-test"
            probe.write_bytes(b"")
            probe.unlink()
        except PermissionError:
            # exocad 가 열어 둔 폴더 — 비켜 갑니다
            folder = unique_folder(folder)
            folder_name = folder.name
            self.note(f"★ exocad 가 원래 폴더를 잡고 있어 {folder_name} 로 만듭니다. 케이스를 닫고 다시 보내면 원래 이름으로 갑니다")
            folder.mkdir(parents=True)
        # ★ 깎은 쪽이 어느 악인지 — 'Preparation / Antagonist' 로만 오는 스캐너용
        jaw = working_jaw([t["number"] for t in data["teeth"]])
        scan_abutment = False
        if jaw is None:
            self.note("치식이 두 악에 걸쳐 있어 상·하악을 못 정했습니다 — 이름 그대로 둡니다")

        # ★ zip 으로 올라온 것은 먼저 풉니다 — exocad 는 zip 을 못 엽니다
        unpacked: list[Path] = []
        for p in list(got):
            if p.suffix.lower() != ".zip":
                continue
            try:
                inner = unzip_scans(p, p.parent)
            except Exception as e:  # noqa: BLE001
                self.note(f"★ {p.name} 을 풀지 못했습니다 ({e}) — 그대로 넣습니다")
                continue

            if not inner:
                self.note(f"{p.name} — 안에 쓸 파일이 없습니다. 그대로 넣습니다")
                continue

            got.remove(p)
            unpacked.extend(inner)
            self.note(f"{p.name} 을 풀었습니다 ({len(inner)}개)")
        got.extend(unpacked)

        dxds: list[Path] = []
        # ★★ **이번에 놓은 이름**을 적어 둡니다 (2026-10-14). 두 파일이 같은
        #   이름으로 가면 뒤엣것이 앞엣것을 지웁니다 — 실제로 삭제 전
        #   스캔이 지대치 스캔을 덮어썼습니다. 이름 짓는 규칙은 고쳤지만,
        #   모르는 스캐너가 또 겹치게 보낼 수 있습니다. 그때는 **덮지 않고**
        #   원래 이름으로 두고 **말해 줍니다** — 조용히 지는 쪽이 없게.
        placed: dict[str, str] = {}
        for p in got:
            if p.suffix.lower() == ".dxd":
                dxds.append(p)
                continue

            name = place_name(folder_name, p.name, jaw)
            if name in placed:
                self.note(f"⚠ {p.name} 과 {placed[name]} 이 같은 이름이 됩니다 — {p.name} 은 그대로 둡니다")
                name = p.name
            else:
                placed[name] = p.name

            target = folder / name
            if MARKER.search(Path(p.name).stem):
                scan_abutment = True
            if target.exists():
                target.unlink()  # 지난번 보낸 같은 이름의 스캔은 새것으로
            shutil.move(str(p), target)
            self.note(f"{p.name} → {target.name}")
        self.note(f"폴더: {folder}")

        # 5. dxd → DS Core 자동 변환 (2026-09-10 — dscore.py, 사람 손 없이)
        if dxds:
            self.say("4/5 dxd 를 DS Core 에서 변환하는 중 (3~5분)")
            import dscore
            for d in dxds:
                keep = folder / d.name
                shutil.move(str(d), keep)
                try:
                    if not dscore.has_settings():
                        self.note("DS Core 계정이 없어 입력창을 띄웁니다")
                        self.win.ask_dscore_account(dscore.save_settings)
                    placed, cleanup = dscore.convert(keep, folder, folder_name, patient, data.get("orderNo", "order"), show=False, say=self.note, defer_cleanup=True)
                    self.after_done = cleanup
                    self.note(f"변환 완료: {[p.name for p in placed]}")
                except Exception as e:  # noqa: BLE001
                    # ★ 옛 변환기 exe 를 예비로 띄우던 것은 뺐습니다 (2026-09-10 — "왜 자꾸 자동으로
                    #   실행되냐"). DS Core 화면이 바뀌어 그 exe 는 어차피 안 됩니다. 실패는 실패로.
                    self.log.exception("dscore 실패")
                    raise RuntimeError(f"dxd 자동 변환 실패: {e}") from e
        else:
            self.say("4/5 dxd 없음 — 변환 건너뜀")

        self.mark("dxd변환")
        # 6. exocad DB 에 직접 등록 — 되면 가져오기 클릭이 필요 없습니다 (2026-09-10)
        registered = False
        patient_id = 0
        work, mesial, healthy, antagonist = make_project.plan_teeth(data["teeth"], data.get("bridges", []))
        for attempt in range(5):   # exocad·다른 런처가 DB 를 잠깐 잡고 있으면 재시도
            try:
                db = exocad_db.ExocadDb(cad)
                try:
                    tid, patient_id = db.register(
                        patient_name=patient, project_guid=project_guid,
                        tray_no=make_project.TRAY_NO, when=made_at,
                        teeth=exocad_db.teeth_from_plan(work, mesial, healthy, antagonist),
                    )
                finally:
                    db.close()
                registered = True
                self.note(f"exocad 목록에 등록했습니다 (treatment {tid}, 환자 {patient_id})")
                break
            except Exception as e:  # noqa: BLE001
                if "locked" in str(e).lower() or "busy" in str(e).lower():
                    time.sleep(1 + attempt)
                    continue
                self.log.exception("exocad DB 등록 실패")
                self.note(f"★ exocad 목록 자동 등록 실패: {e}")
                break
        if not registered:
            patient_id = make_project.next_patient_id()
        xml = make_project.build_project(
            patient_name=patient, teeth=data["teeth"], bridges=data.get("bridges", []),
            when=made_at, patient_id=patient_id, project_guid=project_guid,
            # ★ 스캔바디 스캔이 같이 왔으면 주문서에서 켭니다 (2026-10-06, 박상균 건)
            scan_abutment=scan_abutment,
        )
        (folder / f"{folder_name}.dentalProject").write_bytes(("﻿" + xml).encode("utf-8"))

        # 7. 끝
        self.say("5/5 exocad 목록에 등록")
        self.note(str(folder / f"{folder_name}.dentalProject"))
        self.mark("등록")
        self.report("done", f"{folder_name}")
        self.summary("완료" if registered else "완료(가져오기 필요)", self.durations())
        if registered:
            self.win.finish(f"완료 — exocad 에서 '{patient}' 를 여세요", ok=True)
        else:
            self.win.finish("완료 — exocad 에서 [가져오기]로 주문서를 고르세요", ok=True)


# ---------- 시작 ----------

#: 같은 주문의 두 번째 실행이 물러나는 시간. 한 실행이 보통 2~10초, dxd 변환이면 5분까지입니다.
OPEN_LOCK_SECONDS = 180


def _first_opener(order_id: str) -> bool:
    """이 주문을 지금 처음 여는 실행인가. 자물쇠는 logs/opening/<주문> 파일의 시각입니다."""
    try:
        lock_dir = LOG_DIR / "opening"
        lock_dir.mkdir(parents=True, exist_ok=True)
        lock = lock_dir / order_id
        if lock.exists() and time.time() - lock.stat().st_mtime < OPEN_LOCK_SECONDS:
            return False
        lock.write_text(dt.datetime.now().isoformat(timespec="seconds"), encoding="utf-8")
        return True
    except OSError:
        # 자물쇠를 못 만들면 막지 않습니다 — 두 번 여는 것이 아예 안 여는 것보다 낫습니다
        return True


def parse_launch(arg: str) -> tuple[str, str, str]:
    """
    (하는 일, 주문 ID, 토큰).

    ★ 프로토콜을 새로 만들지 않습니다 (2026-10-06). `denflow:` 는 이미
      등록돼 있고, 레지스트리 등록은 PC 마다 한 번씩 해야 하는 일입니다.
      같은 프로토콜의 **다른 방**으로 들어갑니다:
        denflow://exocad/<주문ID>?t=…   exocad 로 보내기
        denflow://print/<주문ID>?t=…    자동 출력 보내기
    """
    u = urlparse(arg)
    if u.scheme != "denflow" or u.netloc not in ("exocad", "print"):
        raise SystemExit(f"모르는 주소: {arg}")
    order_id = u.path.strip("/")
    token = parse_qs(u.query).get("t", [""])[0]
    if not order_id or not token:
        raise SystemExit("주문 ID 나 토큰이 없습니다")
    return u.netloc, order_id, token


def main() -> None:
    try:
        _main()
    except SystemExit as e:
        _step(f"main 끝남(SystemExit {e.code!r})")
        raise
    except BaseException as e:  # noqa: BLE001
        _step(f"main 죽음 {e!r}")
        raise


def _main() -> None:
    LOG_DIR.mkdir(exist_ok=True)
    # ★ 무엇보다 먼저 "불렸다" 를 남깁니다 — 브라우저가 부르긴 했는지 가리는 흔적
    with open(LOG_DIR / "chrome-hit.txt", "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now().isoformat(timespec='seconds')} py {sys.argv[1:]}\n")
    # ★ 로그 둘: 날짜별(전부) + 실행별(이 건만, runs/ 아래). 실패하면 실행별 파일을 열면 됩니다.
    (LOG_DIR / "runs").mkdir(exist_ok=True)
    handlers = [
        logging.FileHandler(LOG_DIR / f"{dt.date.today().isoformat()}.log", encoding="utf-8"),
        logging.FileHandler(LOG_DIR / "runs" / f"{dt.datetime.now():%Y%m%d-%H%M%S}-{os.getpid()}.log", encoding="utf-8"),
        # ★ 저장소에도 한 벌 (2026-10-16) — 실제 쪽에서 무슨 일이 있었는지 볼 길
        logging.FileHandler(Path(__file__).resolve().parent / "_real_launcher.log", encoding="utf-8"),
    ]
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=handlers)
    args = sys.argv[1:]
    mock: Path | None = None
    kind = "exocad"
    order_id = token = None
    if len(args) >= 2 and args[0] == "--mock":
        mock = Path(args[1])
    elif len(args) >= 1:
        kind, order_id, token = parse_launch(args[0])
    else:
        raise SystemExit(
            "사용: launcher.py denflow://exocad/<주문ID>?t=<토큰>"
            "  |  denflow://print/<주문ID>?t=<토큰>  |  --mock mock.json"
        )

    # ★ 자동 출력은 하는 일이 아예 다릅니다 — 여기서 갈라집니다
    if kind == "print":
        from auto_print_run import run_auto_print  # noqa: PLC0415

        raise SystemExit(run_auto_print(order_id, token))

    # ★★ 같은 주문을 두 번 띄우지 않습니다 (2026-10-20). 브라우저 링크(denflow://)와
    #   exocad 지켜보기가 같은 PC 에서 같이 돌면 0.5초 차이로 둘 다 띄워, exocad 에
    #   환자·치료가 둘씩 생겼습니다 (유선조·문상규·장양현). 단추를 두 번 누른 때도 같습니다.
    #   먼저 뜬 쪽만 일하고 뒤는 창도 없이 물러납니다.
    if order_id and not _first_opener(order_id):
        _step(f"같은 주문을 이미 여는 중 — 물러남 {order_id[:8]}")
        logging.getLogger("launcher").info("같은 주문을 이미 여는 중이라 물러납니다: %s", order_id[:8])
        return

    cfg = load_config()
    win = Window()
    job = Job(win, cfg, order_id, token, mock)
    threading.Thread(target=job.run, daemon=True).start()
    # ★ 시한 지킴이. 창이 살아 있는 동안만 돌므로 따로 끌 것이 없습니다
    win.root.after(JOB_LIMIT_MINUTES * 60_000, job.give_up)
    win.root.mainloop()   # quit() 은 Job 이 (뒷정리까지 끝낸 뒤) 부릅니다


if __name__ == "__main__":
    main()
