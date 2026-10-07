# -*- coding: utf-8 -*-
"""
덴플로우 에이전트 — 치과 PC 에서 스캔을 올리는 프로그램 (2026-10-02).
이름은 '스캔 올리미' 였는데 치과에 드리는 것이라 바꿨습니다 (2026-10-06).

  구강스캐너 내보내기 폴더를 보고 있다가, **새 dxd 가 생기면** 덴플로우로 올리고
  주문 등록 창을 띄웁니다. 환자 이름과 차트번호는 dxd 안에서 읽습니다 (dxd_case).

★ 내보낼 때만 움직입니다. **지켜보기를 시작한 뒤에 나타난** 파일만 봅니다.
  시작할 때 폴더에 있던 것은 적어 두고 건드리지 않습니다 — 쌓여 있던 옛 케이스를
  한꺼번에 올리지 않습니다. 파일 날짜가 아니라 '목록에 새로 생겼는가' 로 봅니다
  (윈도우에서 복사하면 날짜가 원본 그대로라, 날짜로는 새 파일인지 알 수 없습니다).
★ 같은 케이스는 케이스 번호로 한 번만 올립니다 — 다시 내보내도 두 줄이 안 생깁니다.
★ 쓰기가 끝날 때까지 기다립니다 (크기가 멈출 때까지). 반쯤 올라간 파일을 안 만듭니다.
★ 비밀번호를 저장하지 않습니다. 계정정보에서 받은 **여섯 자리 코드**로 한 번 연결하고,
  그 뒤로는 기기 열쇠만 씁니다 (scan_agent.json).
★ 파일은 덴플로우 서버를 거치지 않고 저장소로 바로 올립니다 — 150MB 짜리입니다.
★ 윈도우를 켜면 저절로 떠서 지켜봅니다 (시작 폴더 바로가기). 진료실에서 아무도
  이 창을 띄워 줄 사람이 없다는 전제입니다 — 켜 두는 것을 사람이 기억할 수 없습니다.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

import tkinter as tk
from tkinter import filedialog

import pystray
from PIL import Image

import medit_case
from dxd_case import read_case

HERE = Path(__file__).resolve().parent

# ★ exe 로 묶으면 (PyInstaller --onefile) __file__ 은 매번 바뀌는 임시 폴더를
#   가리킵니다. 거기에 설정을 쓰면 **껐다 켤 때마다 연결이 풀립니다**.
#   그래서 묶였을 때는 사람 계정의 AppData 에 둡니다 — USB 로 들고 다니거나
#   읽기 전용 폴더에서 돌려도 됩니다. 기기 열쇠는 PC 마다 다른 것이 맞습니다.
FROZEN = getattr(sys, "frozen", False)

# ★★ **치과에 보낸 것인가**를 봅니다 (2026-10-07).
#   전에는 `sys.frozen` 만 봤는데, 백신 때문에 exe 를 없애면서 그 표시가
#   사라졌습니다. 그러면 설정이 **프로그램 폴더**에 쓰이고, 치과가 판을
#   바꾸며 폴더를 덮으면 **연결이 통째로 날아갑니다.** 더 나쁘게는, 1.1.0 이
#   AppData 에 적어 둔 연결을 1.2.0 이 못 찾아 "연결 안 됨" 이 됩니다.
#   끼워 넣은 파이썬(runtime 폴더)이 옆에 있으면 묶어 보낸 것입니다.
# ★ 옛 판은 그 폴더를 `런타임` 이라 불렀습니다 — cmd 가 한글을 깨뜨려
#   영문으로 바꿨습니다(1.2.3). 둘 다 봅니다.
PACKAGED = FROZEN or (HERE / "runtime").is_dir() or (HERE / "런타임").is_dir()

if PACKAGED:
    SETTINGS_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / "DenFlow"
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
else:
    # 여기서 고치며 돌릴 때는 소스 옆에 둡니다
    SETTINGS_DIR = HERE

SETTINGS = SETTINGS_DIR / "scan_agent.json"

# ★★ **고쳐서 새로 빌드할 때마다 올립니다.** 서버의
#   src/server/domain/agent/index.ts 의 AGENT_VERSION 과 **같아야** 합니다
#   (어긋나면 모든 치과에 "새 판이 있습니다" 가 영원히 뜹니다 — 시험이 봅니다).
AGENT_VERSION = "1.3.0"

SITE = "https://denflow.kr"
SUPABASE_URL = "https://dzliwedyqkondvcwnvbh.supabase.co"
BUCKET = "order-files"

# ★★ 거의 즉각 반응하게 만들었습니다 (사용자 요청 2026-10-06).
#   전에는 폴더를 5초마다 보고(POLL) 다 썼는지 4초를 기다려(SETTLE), 내보내기와
#   창이 뜨는 사이에 **최대 9초**가 그냥 흘렀습니다. 둘 다 없앴습니다.
POLL_SECONDS = 1
#: 크기가 멈췄는지 확인하는 간격 — 윈도우가 '아직 쓰는 중' 이라고 안 해 줄 때의 대비책
SETTLE_TICK = 0.4
#: 폴더(메딧)는 파일이 하나씩 떨어집니다. 이만큼 조용하면 다 떨어진 것으로 봅니다
QUIET_SECONDS = 1.5


def load_settings() -> dict:
    try:
        return json.loads(SETTINGS.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_settings(data: dict) -> None:
    SETTINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def post_json(url: str, body: dict, token: str | None = None) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:          # 서버가 이유를 적어 보냅니다
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def put_file(path: Path, storage_path: str, upload_token: str) -> bool:
    """저장소가 내준 주소로 바로 올립니다 (서명 업로드)."""
    url = f"{SUPABASE_URL}/storage/v1/object/upload/sign/{BUCKET}/{urllib.parse.quote(storage_path)}?token={upload_token}"

    with open(path, "rb") as f:
        req = urllib.request.Request(url, data=f, method="PUT")
        req.add_header("content-type", "application/octet-stream")
        req.add_header("content-length", str(path.stat().st_size))
        try:
            with urllib.request.urlopen(req, timeout=60 * 30) as res:
                return res.status in (200, 201)
        except Exception:
            return False


# ---------------------------------------------------------
# 윈도우 켤 때 저절로 시작 (사용자 요청 2026-10-02)
#
# ★ 시작 폴더에 바로가기를 둡니다. 레지스트리를 건드리지 않습니다 —
#   치과 PC 의 레지스트리는 손대지 않는 것이 서로 편합니다.
# ★ pythonw 로 띄웁니다. python 으로 두면 검은 창이 같이 떠서 원장님이 닫습니다.
# ---------------------------------------------------------

SHORTCUT_NAME = "덴플로우 에이전트.lnk"


def startup_link() -> Path:
    return Path(os.environ["APPDATA"]) / "Microsoft/Windows/Start Menu/Programs/Startup" / SHORTCUT_NAME


def pythonw() -> str:
    """창 없는 파이썬. 지금 돌고 있는 것이 python.exe 면 짝인 pythonw.exe 를 씁니다"""
    here = Path(sys.executable)
    mate = here.with_name("pythonw.exe")
    return str(mate if mate.exists() else here)


def autostart_on() -> bool:
    return startup_link().exists()


def desktop_link() -> Path:
    return Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop" / SHORTCUT_NAME


def link_target(lnk: Path) -> str | None:
    """바로가기가 가리키는 곳. 못 읽으면 None"""
    if not lnk.exists():
        return None
    # ★ PowerShell 은 콘솔 코드페이지(cp949)로 뱉습니다. 그대로 utf-8 로 읽으면
    #   **한글 경로가 깨져** 멀쩡한 바로가기도 "없는 파일" 로 판정됩니다.
    #   뱉는 쪽을 utf-8 로 돌려 놓습니다.
    script = (
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8;"
        "(New-Object -ComObject WScript.Shell).CreateShortcut('%s').TargetPath" % lnk
    )
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return (r.stdout or "").strip() or None
    except Exception:  # noqa: BLE001
        return None


def heal_links() -> None:
    """
    옛 판이 남긴 바로가기를 고칩니다 (2026-10-07).

    ★★ 판을 바꾸면 옛 바로가기가 **없어진 파일**을 가리킵니다. 1.1.0 까지는
      `덴플로우 에이전트.exe` 를 가리켰는데 1.2.0 에는 그 파일이 없습니다.
      그러면 **자동 시작이 조용히 죽습니다** — 치과는 PC 를 켜고 스캔을
      내보냈는데 아무 일도 안 일어나는 것을 한참 뒤에야 압니다.
      그게 이 프로그램에서 제일 나쁜 고장입니다.

    ★ 그래서 켤 때마다 봅니다. 가리키는 곳이 없으면 지금 내 자리로 다시 씁니다.
    ★ 치과가 일부러 지운 바탕화면 아이콘을 되살리지는 않습니다 —
      **깨진 것만** 고치고, 없으면 그때만 새로 만듭니다.
    """
    start = startup_link()
    if start.exists():
        target = link_target(start)
        if not target or not Path(target).exists():
            set_autostart(True)

    desk = desktop_link()
    if desk.exists():
        target = link_target(desk)
        if not target or not Path(target).exists():
            desk.unlink(missing_ok=True)

    make_desktop_link()


def make_desktop_link() -> None:
    """
    바탕화면에 아이콘을 하나 둡니다 (2026-10-07).

    ★★ 실행 파일을 없애면서 생긴 일입니다. 전에는 `덴플로우 에이전트.exe` 를
      두 번 누르면 됐는데, 이제 폴더 안에 있는 것은 `.cmd` 뿐입니다 —
      치과 책상에 두기엔 모양이 안 납니다. **처음 켤 때 바탕화면에
      제대로 된 아이콘을 만들어 둡니다.**

    ★ zip 안에 .lnk 를 넣어 보내지 않습니다. 바로가기는 **절대 경로**를
      품고 있어서, 치과가 다른 자리에 풀면 그 자리에서 깨집니다.
      지금 돌고 있는 내 자리를 알고 만드는 쪽이 안 틀립니다.

    ★ 이미 있으면 그냥 둡니다. 치과가 옮겨 뒀을 수 있습니다.
    """
    link = desktop_link()
    if link.exists():
        return

    icon = asset("denflow.ico")
    script = (
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk}');"
        "$s.TargetPath='{py}';"
        "$s.Arguments='{target}';"
        "$s.WorkingDirectory='{here}';"
        "$s.IconLocation='{icon}';"
        "$s.Save()"
    ).format(
        lnk=link,
        py=Path(sys.executable).resolve() if FROZEN else pythonw(),
        target="" if FROZEN else '\"%s\"' % Path(__file__).resolve(),
        here=Path(sys.executable).resolve().parent if FROZEN else HERE,
        icon=icon,
    )

    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            check=True, capture_output=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except Exception:  # noqa: BLE001 — 아이콘을 못 만들어도 에이전트는 돕니다
        pass


def set_autostart(on: bool) -> str:
    link = startup_link()

    if not on:
        try:
            link.unlink(missing_ok=True)
            return "윈도우 켤 때 저절로 시작하지 않습니다."
        except OSError as e:
            return f"바로가기를 지우지 못했습니다: {e}"

    # ★ 바로가기(.lnk)는 COM 으로만 만들어집니다. 파이썬에 그 모듈이 없을 수 있어
    #   윈도우에 늘 있는 powershell 에게 맡깁니다.
    #   exe 로 묶였으면 exe 자체를 가리킵니다 — 뒤에 붙일 것이 없습니다.
    exe = Path(sys.executable).resolve()
    #: ★ 윈도우가 켜질 때는 **창 없이** 트레이로만 뜹니다 (사용자 요청 2026-10-06).
    #   진료실 화면에 창이 하나 떠 있는 것 자체가 거슬립니다.
    target = "--tray" if FROZEN else '\"%s\" --tray' % Path(__file__).resolve()

    script = (
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk}');"
        "$s.TargetPath='{py}';"
        "$s.Arguments='{target}';"
        "$s.WorkingDirectory='{here}';"
        "$s.WindowStyle=7;"
        "$s.Save()"
    ).format(
        lnk=link,
        py=exe if FROZEN else pythonw(),
        target=target,
        here=exe.parent if FROZEN else HERE,
    )

    try:
        link.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            check=True, capture_output=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except Exception as e:
        return f"자동 시작을 켜지 못했습니다: {e}"

    return "윈도우를 켜면 저절로 떠서 지켜봅니다."


def _writer_done(path: Path) -> bool:
    """
    쓰던 프로그램이 파일을 **닫았는가** — 윈도우에게 직접 물어봅니다.

    ★★ 이게 속도의 핵심입니다. 크기가 멈추기를 몇 초씩 기다리는 대신,
      **아무도 안 쓰고 있는 파일인지**를 그 자리에서 알 수 있습니다.
      공유를 하나도 허용하지 않고(dwShareMode=0) 열어 봐서, 열리면 쓰던 쪽이
      이미 닫은 것입니다. 스캐너가 아직 쓰는 중이면 열리지 않습니다.
    ★ 윈도우가 아니거나 뭔가 막히면 False 를 돌려주고, 크기 비교 쪽으로 넘깁니다.
    """
    if os.name != "nt":
        return True

    import ctypes
    from ctypes import wintypes

    GENERIC_READ = 0x80000000
    OPEN_EXISTING = 3
    INVALID = ctypes.c_void_p(-1).value

    CreateFileW = ctypes.windll.kernel32.CreateFileW
    CreateFileW.restype = wintypes.HANDLE
    CreateFileW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
        wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
    ]

    handle = CreateFileW(str(path), GENERIC_READ, 0, None, OPEN_EXISTING, 0, None)
    if handle == INVALID or handle is None:
        return False

    ctypes.windll.kernel32.CloseHandle(wintypes.HANDLE(handle))
    return True


def settled(path: Path) -> bool:
    """이 파일을 지금 올려도 되는가"""
    return settled_all([path])


def settled_all(paths: list[Path]) -> bool:
    """
    이 파일들을 지금 올려도 되는가.

    ★ 먼저 **닫혔는지** 봅니다 (대개 그 자리에서 끝납니다).
    ★ 닫혔다고 해도 크기를 한 번 더 견줍니다 — 네트워크 드라이브처럼 윈도우가
      제대로 안 알려 주는 자리가 있어서, 아주 짧게(0.4초) 확인만 합니다.
    """
    try:
        if not all(p.stat().st_size > 0 for p in paths):
            return False
        if not all(_writer_done(p) for p in paths):
            return False

        before = [p.stat().st_size for p in paths]
        time.sleep(SETTLE_TICK)
        return before == [p.stat().st_size for p in paths]
    except OSError:
        return False


class Agent:
    """폴더를 보고 올리는 일. 창(App)이 이 객체를 쥐고 씁니다."""

    def __init__(self, say, on_link=None, notify=None) -> None:
        self.say = say
        #: 트레이 풍선 — 창이 숨어 있어도 보입니다 (없으면 조용히 넘어갑니다)
        self.notify = notify or (lambda _m: None)
        self.cfg = load_settings()
        self.stop = threading.Event()
        #: 연결이 끝나면 창이 자기 모습을 고칠 수 있게
        self.on_link = on_link

    # -- 연결 --
    def link(self, code: str, device_name: str) -> bool:
        result = post_json(f"{SITE}/api/device/link", {"code": code.strip(), "deviceName": device_name})
        if not result.get("ok"):
            self.say(f"연결 실패: {result.get('error', '')}")
            return False

        self.cfg["token"] = result["token"]
        self.cfg["device_id"] = result["deviceId"]
        # ★ 어느 치과에 붙었는지 화면에 적어 둡니다 — 엉뚱한 곳에 연결한 것을 바로 압니다
        self.cfg["clinic"] = result.get("clinicName", "")
        save_settings(self.cfg)

        where = self.cfg["clinic"] or "치과"
        self.say(f"{where} 에 연결됐습니다. 이제 내보내기만 하면 올라갑니다.")
        if self.on_link:
            self.on_link()
        return True

    # -- 올리기 --
    def upload_case(self, case_key: str, meta: dict, files: list[tuple[Path, str]], label: str) -> None:
        """
        한 케이스를 올립니다.

        ★ 파일이 여럿일 수 있습니다 (Medit 은 상악·하악·교합이 따로 나옵니다).
          묶어서 zip 하나로 보내지 않습니다 — exocad 런처가 파일 이름의 부위
          낱말로 가려 넣기 때문에, 묶으면 그 자리에서 사람이 풀어야 합니다.
        """
        # ★ 같은 케이스인지는 **서버가** 압니다 (2026-10-05).
        #   여기서 혼자 막으면, 재스캔해서 다시 내보낸 것까지 막힙니다.
        #   서버는 아직 주문에 안 붙은 줄만 '이미 올라감' 으로 봅니다.
        self.say(f"{label} — {meta.get('patientName') or '이름 모름'} 올리는 중…")

        slot = post_json(
            f"{SITE}/api/device/scan",
            {
                **meta,
                "fileName": files[0][1],
                "fileSize": files[0][0].stat().st_size,
                "files": [{"name": name, "size": path.stat().st_size} for path, name in files],
            },
            self.cfg.get("token"),
        )

        if not slot.get("ok"):
            self.say(f"   실패: {slot.get('error', '')}")
            return

        """
        ★★ 창을 **올리기 전에** 띄웁니다 (사용자 요청 2026-10-06).
          전에는 다 올리고 열어서, 65MB 면 8초 180MB 면 더 오래 빈 화면을 봤습니다.
          자리를 여는 순간 이미 환자 이름이 서버에 있으니 주문서는 채워집니다.
          치과가 치식·쉐이드를 고르는 사이에 뒤에서 올라가고, 대개 고르는 쪽이
          더 오래 걸려 기다릴 일이 없습니다. 아직이면 등록할 때 화면이 기다립니다.
        """
        # ★ 주문 등록 창 — 환자 이름과 이 스캔이 채워진 채로 열립니다
        webbrowser.open(f"{SITE}/clinic/orders/new?scan={slot['scanId']}")

        if slot.get("already"):
            self.say("   이미 올라간 케이스입니다 — 주문 등록 창만 다시 엽니다")
            return

        self.say("   주문 등록 창을 열었습니다. 뒤에서 올리는 중…")

        # 자리는 보낸 차례 그대로 돌아옵니다
        for (path, name), place in zip(files, slot.get("uploads") or [{"path": slot["path"], "token": slot["token"]}]):
            if len(files) > 1:
                self.say(f"      {name}")
            if not put_file(path, place["path"], place["token"]):
                self.say("   올리다 끊겼습니다. 다음 차례에 다시 해 봅니다")
                return

        done = post_json(f"{SITE}/api/device/scan/done", {"scanId": slot["scanId"]}, self.cfg.get("token"))
        if not done.get("ok"):
            self.say(f"   마무리 실패: {done.get('error', '')}")
            return

        self.say("   다 올렸습니다")
        self.notify(f"{meta.get('patientName') or '스캔'} — 다 올라갔습니다")

    def upload_dxd(self, path: Path) -> None:
        case = read_case(path)
        self.upload_case(
            case.case_guid,
            {
                "patientName": case.patient_name,
                "chartNo": case.chart_no,
                "clinicNameInFile": case.clinic_name,
                "caseGuid": case.case_guid,
                "scannedAt": case.scanned_at,
                "teeth": case.teeth,
            },
            [(path, path.name)],
            path.name,
        )

    def upload_medit(self, folder_name: str, files: list[Path]) -> None:
        """Medit 한 벌 — 폴더째 또는 zip 에서 푼 것"""
        case = medit_case.read_case(folder_name, [f.name for f in files])
        self.upload_case(
            case.case_key,
            {
                "patientName": case.patient_name,
                "chartNo": "",
                "clinicNameInFile": "",
                "caseGuid": case.case_key,
                "scannedAt": case.scanned_on,
                "teeth": case.teeth,
            },
            [(f, f.name) for f in files],
            f"{folder_name} (파일 {len(files)}개)",
        )

    def upload_zip(self, path: Path) -> None:
        """압축해서 내보낸 경우 — 풀어서 그물 파일만 올립니다"""
        try:
            if not any(medit_case.is_mesh(n) for n in medit_case.names_in_zip(path)):
                return
        except Exception:
            return                                   # zip 이 아니거나 깨진 것

        with tempfile.TemporaryDirectory() as tmp:
            files = medit_case.extract_zip(path, Path(tmp))
            if files:
                self.upload_medit(path.stem, sorted(files))

    # -- 지켜보기 --
    def watch(self, folder: Path) -> None:
        """
        ★ 세 가지를 봅니다 (2026-10-05).
            ① 새 dxd 파일            — 프라임스캔·시로나
            ② 새 폴더 (그물 파일 든)  — Medit '압축 안 함'
            ③ 새 zip                 — Medit '압축함'
        ★ 시작할 때 있던 것은 '이미 있던 것' 으로 적어 두고 건드리지 않습니다.
        """
        known = {p.name for p in folder.iterdir()} if folder.is_dir() else set()
        self.say(f"{folder} 를 봅니다. 이미 있던 {len(known)}개는 두고, 새로 들어오는 것만 올립니다.")

        #: 폴더(메딧)는 파일이 하나씩 떨어집니다 — '언제 마지막으로 바뀌었나' 를 적어 둡니다
        folder_seen: dict[str, tuple[tuple, float]] = {}

        while not self.stop.is_set():
            try:
                for path in sorted(folder.iterdir()):
                    if self.stop.is_set():
                        break
                    if path.name in known:
                        continue

                    if path.is_dir():
                        inside = [p for p in path.iterdir() if p.is_file()]
                        meshes = sorted(p for p in inside if medit_case.is_mesh(p.name))

                        if not meshes:
                            # ★ Medit 내보내기 창에서 obj·stl·ply 를 하나도 안 고르면
                            #   (meditMesh 만 켜면) 올릴 것이 없습니다. 조용히 지나가면
                            #   치과는 올라간 줄 압니다 — 한 줄 적어 둡니다 (2026-10-05).
                            if inside:
                                known.add(path.name)
                                self.say(
                                    f"{path.name} — 올릴 파일이 없습니다. "
                                    "메딧 내보내기에서 OBJ 나 PLY, STL 을 켜 주세요"
                                )
                            continue

                        # ★ 아직 더 떨어질 수 있습니다. 폴더 안이 **조용해질 때까지** 둡니다
                        #   (파일 이름·크기가 안 바뀐 채로 QUIET_SECONDS).
                        shape = tuple(sorted((f.name, f.stat().st_size) for f in inside))
                        last_shape, since = folder_seen.get(path.name, (None, 0.0))
                        if shape != last_shape:
                            folder_seen[path.name] = (shape, time.time())
                            continue
                        if time.time() - since < QUIET_SECONDS:
                            continue

                        if not settled_all(meshes):
                            continue

                        known.add(path.name)
                        folder_seen.pop(path.name, None)
                        self.upload_medit(path.name, meshes)

                    elif path.suffix.lower() == ".dxd":
                        if not settled(path):
                            continue
                        known.add(path.name)
                        self.upload_dxd(path)

                    elif path.suffix.lower() == ".zip":
                        if not settled(path):
                            continue
                        known.add(path.name)
                        self.upload_zip(path)

            except Exception:
                self.say("문제가 생겼습니다" + chr(10) + traceback.format_exc())

            self.stop.wait(POLL_SECONDS)


# ---------------------------------------------------------
# 창 (2026-10-06 — 치과에 드리는 프로그램이라 다시 그렸습니다)
#
# ★ 쓰는 색은 덴플로우 화면과 같습니다. 같은 회사 물건으로 보여야 합니다.
# ★ 지금 어느 상태인지가 **오른쪽 위 한 곳**에만 적힙니다 —
#   연결 안 됨 / 준비됨 / 지켜보는 중. 진료실에서는 흘깃 보고 알아야 합니다.
# ★ 연결이 끝나면 코드 칸을 치우고 **치과 이름**을 보여 줍니다. 엉뚱한 치과에
#   연결한 것을 그 자리에서 알 수 있습니다.
# ★ tk 기본 위젯은 투박합니다. 입력칸은 테두리를 직접 두르고(Frame 1px),
#   단추는 relief 를 없애고 hover 색을 답니다.
# ---------------------------------------------------------

INK, SUB, DIM, FAINT = "#1A2130", "#4A5567", "#7C8595", "#98A2B3"
LINE, PAPER, BG, TINT = "#E8EBF0", "#FFFFFF", "#F4F6F9", "#F2F7FE"
BLUE, BLUE_DARK = "#1279E8", "#0F68C9"
GREEN, GREY = "#1F9254", "#C4CBD6"
RED = "#D64545"   # 프린터 점검이 실패했을 때 (2026-10-06)
F = "Malgun Gothic"


def asset(name: str) -> Path:
    """묶인 뒤에는 _internal 안에 있습니다"""
    return Path(getattr(sys, "_MEIPASS", HERE)) / name


class App:
    def __init__(self) -> None:
        self.agent = Agent(self.say, on_link=self.refresh, notify=self.balloon)
        self.watching = False

        self.root = tk.Tk()
        self.root.title("덴플로우 에이전트")
        self.root.geometry("620x740")
        self.root.minsize(560, 640)
        self.root.configure(bg=BG)
        try:
            self.root.iconbitmap(str(asset("denflow.ico")))
        except Exception:  # noqa: BLE001
            pass

        self.folder = tk.StringVar(value=self.agent.cfg.get("folder", ""))
        self.code = tk.StringVar(value="")
        self.auto = tk.BooleanVar(value=autostart_on())

        # ★ 프린터는 **시리얼과 액세스 코드만** 적습니다 (2026-10-06).
        #   IP 는 공유기가 빌려주는 번호라 정전·재부팅으로 바뀝니다.
        #   주소는 보낼 때마다 시리얼로 찾습니다.
        self.p_serial = tk.StringVar(value=self.agent.cfg.get("printer_serial", ""))
        self.p_code = tk.StringVar(value=self.agent.cfg.get("printer_code", ""))
        self.p_on = tk.BooleanVar(value=self.agent.cfg.get("printer_kind") == "bambu")

        self._header()
        self._update_bar()
        body = tk.Frame(self.root, bg=BG)
        body.pack(fill="both", expand=True, padx=20, pady=(16, 18))

        self._step_connect(body)
        self._step_folder(body)
        self._step_printer(body)
        self._controls(body)
        self._log(body)

        self.refresh()
        self._tray()

        # ★ 바탕화면 아이콘을 만들고, 옛 판이 남긴 깨진 바로가기를 고칩니다.
        threading.Thread(target=heal_links, daemon=True).start()

        # ★★ X 를 누르면 **끄지 않고 숨깁니다** (사용자 요청 2026-10-06).
        #   전에는 X 가 곧 종료라, 직원이 창을 닫으면 그 뒤 스캔이 안 올라갔습니다.
        #   이제 오른쪽 아래 트레이에서 계속 지켜봅니다.
        self.root.protocol("WM_DELETE_WINDOW", self.hide)

        if "--tray" in sys.argv:
            self.root.withdraw()          # 윈도우가 켜질 때는 창 없이

        if self.agent.cfg.get("token"):
            self.say(f"{self.agent.cfg.get('clinic') or '치과'} 에 연결된 PC 입니다.")
        else:
            self.say("덴플로우 계정정보에서 연결 코드를 받아 넣어 주세요.")

        # ★ 연결도 폴더도 이미 있으면 사람을 안 기다립니다 (윈도우가 켜질 때 저절로 떴다면)
        if self.agent.cfg.get("token") and self.folder.get().strip() and Path(self.folder.get().strip()).is_dir():
            self.root.after(800, self.start)

    # ---------- 생김새 ----------

    def _header(self) -> None:
        bar = tk.Frame(self.root, bg=PAPER)
        bar.pack(fill="x")

        left = tk.Frame(bar, bg=PAPER)
        left.pack(side="left", padx=20, pady=(16, 14))
        title = tk.Frame(left, bg=PAPER)
        title.pack(anchor="w")
        tk.Label(title, text="덴플로우 에이전트", font=(F, 14, "bold"), bg=PAPER, fg=INK).pack(side="left")
        # ★ 판 번호를 보이게 둡니다 — 치과에 전화로 물을 때 읽어 주실 수 있게
        tk.Label(title, text=AGENT_VERSION, font=(F, 9), bg=PAPER, fg=FAINT).pack(side="left", padx=(7, 0), pady=(5, 0))
        tk.Label(
            left, text="구강스캐너에서 내보내면 스캔이 덴플로우로 올라갑니다",
            font=(F, 9), bg=PAPER, fg=DIM,
        ).pack(anchor="w", pady=(2, 0))

        pill = tk.Frame(bar, bg=TINT)
        pill.pack(side="right", padx=20)
        self.dot = tk.Label(pill, text="●", font=(F, 9), bg=TINT, fg=GREY)
        self.dot.pack(side="left", padx=(10, 4), pady=5)
        self.state = tk.Label(pill, text="연결 안 됨", font=(F, 9, "bold"), bg=TINT, fg=SUB)
        self.state.pack(side="left", padx=(0, 12), pady=5)

        tk.Frame(self.root, bg=LINE, height=1).pack(fill="x")

    def _update_bar(self) -> None:
        """
        새 판이 있을 때만 뜨는 띠 (사용자 요청 2026-10-06).

        ★ **저절로 받지 않습니다.** 알리고, 받는 것은 사람이 누릅니다.
          치과 PC 에서 프로그램이 저 혼자 바뀌면 스캔이 안 올라가는 날
          원인을 못 찾습니다.
        ★ 평소에는 아예 안 보입니다 — 늘 떠 있는 띠는 아무도 안 봅니다.
        """
        self.up_bar = tk.Frame(self.root, bg="#FFF6E5")
        self.up_text = tk.Label(
            self.up_bar, text="", font=(F, 9), bg="#FFF6E5", fg="#8A5A00", anchor="w",
        )
        self.up_text.pack(side="left", padx=(20, 0), pady=8)
        self._button(self.up_bar, "받는 곳 열기", self.open_update).pack(
            side="right", padx=(0, 20), pady=6, ipadx=8, ipady=3,
        )
        # pack 은 새 판이 있을 때만 합니다 (check_update)
        self.up_url = SITE
        threading.Thread(target=self.check_update, daemon=True).start()

    def check_update(self) -> None:
        """
        판 번호를 물어봅니다.

        ★ 서버가 안 되거나 답이 이상해도 **조용히 넘어갑니다.** 판 확인
          때문에 에이전트가 안 뜨면 그게 더 큰일입니다.
        ★ 켤 때 한 번, 그 뒤 여섯 시간에 한 번. 치과 PC 는 며칠씩 켜 둡니다.
        """
        while True:
            try:
                got = post_json(
                    f"{SITE}/api/device/agent",
                    {"version": AGENT_VERSION},
                    self.agent.cfg.get("token"),
                )
                if got.get("outdated"):
                    self.up_url = got.get("url") or SITE
                    note = (got.get("note") or "").strip()
                    text = f"새 판이 있습니다 — {got.get('latest')}"
                    if note:
                        text += f" · {note}"
                    self.root.after(0, lambda t=text: self._show_update(t))
            except Exception:  # noqa: BLE001 — 판 확인이 에이전트를 막지 않습니다
                pass
            time.sleep(6 * 60 * 60)

    def _show_update(self, text: str) -> None:
        self.up_text.config(text=text)
        if not self.up_bar.winfo_ismapped():
            self.up_bar.pack(fill="x", after=self.root.winfo_children()[0])
        self.say(text)

    def open_update(self) -> None:
        webbrowser.open(self.up_url)

    def _card(self, parent, step: str, title: str) -> tk.Frame:
        wrap = tk.Frame(parent, bg=LINE)
        wrap.pack(fill="x", pady=(0, 10))
        card = tk.Frame(wrap, bg=PAPER)
        card.pack(fill="x", padx=1, pady=1)

        head = tk.Frame(card, bg=PAPER)
        head.pack(fill="x", padx=14, pady=(11, 0))
        tk.Label(head, text=step, font=(F, 9, "bold"), bg=BLUE, fg=PAPER, width=3).pack(side="left")
        tk.Label(head, text=title, font=(F, 10, "bold"), bg=PAPER, fg=INK).pack(side="left", padx=(8, 0))
        return card

    def _field(self, parent, textvar, width=None, big=False) -> tk.Frame:
        """테두리 있는 입력칸 — tk.Entry 기본 모양이 투박해서 테를 직접 두릅니다"""
        box = tk.Frame(parent, bg=LINE)
        tk.Entry(
            box, textvariable=textvar,
            font=(F, 13, "bold") if big else (F, 10),
            relief="flat", bg=PAPER, fg=INK, insertbackground=INK,
            width=width or 0, justify="center" if big else "left",
        ).pack(padx=1, pady=1, ipady=6, ipadx=6, fill="x", expand=True)
        return box

    def _button(self, parent, text, command, kind="ghost") -> tk.Button:
        fill, hover, fg = {
            "primary": (BLUE, BLUE_DARK, PAPER),
            "ghost": ("#EEF1F5", "#E2E7EE", SUB),
        }[kind]

        b = tk.Button(
            parent, text=text, command=command, font=(F, 9, "bold"),
            relief="flat", bd=0, cursor="hand2",
            bg=fill, fg=fg, activebackground=hover, activeforeground=fg,
        )
        b.bind("<Enter>", lambda _e, w=b, c=hover: w.config(bg=c))
        b.bind("<Leave>", lambda _e, w=b, c=fill: w.config(bg=c))
        return b

    def _step_connect(self, body) -> None:
        card = self._card(body, "1", "치과 연결")
        self.connect_body = tk.Frame(card, bg=PAPER)
        self.connect_body.pack(fill="x", padx=14, pady=(8, 13))

    def _draw_connect(self) -> None:
        for w in self.connect_body.winfo_children():
            w.destroy()

        if self.agent.cfg.get("token"):
            row = tk.Frame(self.connect_body, bg=PAPER)
            row.pack(fill="x")
            tk.Label(row, text="✓", font=(F, 11, "bold"), bg=PAPER, fg=GREEN).pack(side="left")
            tk.Label(
                row, text=f"{self.agent.cfg.get('clinic') or '치과'} 에 연결됨",
                font=(F, 10, "bold"), bg=PAPER, fg=INK,
            ).pack(side="left", padx=(6, 0))
            self._button(row, "다시 연결", self.unlink).pack(side="right", ipadx=8, ipady=3)
            tk.Label(
                self.connect_body, text="비밀번호는 이 PC 에 저장되지 않습니다",
                font=(F, 9), bg=PAPER, fg=FAINT,
            ).pack(anchor="w", pady=(6, 0))
            return

        row = tk.Frame(self.connect_body, bg=PAPER)
        row.pack(fill="x")
        self._field(row, self.code, width=8, big=True).pack(side="left")
        self._button(row, "연결하기", self.link, kind="primary").pack(side="left", padx=(8, 0), ipadx=14, ipady=5)
        tk.Label(
            self.connect_body,
            text="덴플로우 → 계정정보 → 스캐너 PC 연결 → 연결 코드 만들기 (10분)",
            font=(F, 9), bg=PAPER, fg=FAINT,
        ).pack(anchor="w", pady=(7, 0))

    def _step_folder(self, body) -> None:
        card = self._card(body, "2", "내보내기 폴더")
        inner = tk.Frame(card, bg=PAPER)
        inner.pack(fill="x", padx=14, pady=(8, 13))

        row = tk.Frame(inner, bg=PAPER)
        row.pack(fill="x")
        self._field(row, self.folder).pack(side="left", fill="x", expand=True)
        self._button(row, "찾아보기", self.pick).pack(side="left", padx=(8, 0), ipadx=10, ipady=5)
        tk.Label(
            inner, text="스캐너 프로그램의 내보내기 설정에 적힌 그 폴더입니다",
            font=(F, 9), bg=PAPER, fg=FAINT,
        ).pack(anchor="w", pady=(7, 0))

    def _step_printer(self, body) -> None:
        """
        치과에 프린터가 있을 때만 켭니다 (자동 템포러리, 2026-10-06).

        ★ 꺼 두면 가짜로 돕니다 — 실수로 진짜 기계에 출력이 걸리지 않습니다.
        ★ IP 칸이 없습니다. 일부러입니다 — 시리얼로 찾습니다.
        """
        card = self._card(body, "3", "프린터 (쓰실 때만)")
        inner = tk.Frame(card, bg=PAPER)
        inner.pack(fill="x", padx=14, pady=(8, 13))

        tk.Checkbutton(
            inner, text="이 치과에서 자동 출력을 씁니다", variable=self.p_on,
            command=self.save_printer, font=(F, 9), bg=PAPER, fg=SUB,
            activebackground=PAPER, activeforeground=SUB, selectcolor=PAPER,
            cursor="hand2",
        ).pack(anchor="w")

        row = tk.Frame(inner, bg=PAPER)
        row.pack(fill="x", pady=(8, 0))
        tk.Label(row, text="시리얼", font=(F, 9), bg=PAPER, fg=SUB, width=7, anchor="w").pack(side="left")
        self._field(row, self.p_serial).pack(side="left", fill="x", expand=True)

        row2 = tk.Frame(inner, bg=PAPER)
        row2.pack(fill="x", pady=(6, 0))
        tk.Label(row2, text="접속 코드", font=(F, 9), bg=PAPER, fg=SUB, width=7, anchor="w").pack(side="left")
        self._field(row2, self.p_code).pack(side="left", fill="x", expand=True)
        self._button(row2, "프린터 찾기", self.find_printer).pack(side="left", padx=(8, 0), ipadx=8, ipady=5)

        self.p_status = tk.Label(
            inner, text="프린터에서 LAN 모드를 켜면 두 값이 화면에 뜹니다",
            font=(F, 9), bg=PAPER, fg=FAINT, anchor="w", wraplength=520, justify="left",
        )
        self.p_status.pack(anchor="w", fill="x", pady=(7, 0))

    def save_printer(self) -> None:
        self.agent.cfg["printer_kind"] = "bambu" if self.p_on.get() else "mock"
        self.agent.cfg["printer_serial"] = self.p_serial.get().strip()
        self.agent.cfg["printer_code"] = self.p_code.get().strip()
        save_settings(self.agent.cfg)

        # ★ 지켜보는 중에 체크를 켜면 그 자리에서 출력도 가져오기 시작합니다.
        #   다시 켜 달라고 하지 않습니다 — 치과는 그런 걸 모릅니다.
        if self.watching:
            self.start_printing()

    def find_printer(self) -> None:
        """
        ★ 왜 안 되는지까지 말합니다. 치과에서 "안 돼요" 대신 이 문장을
          전해 주실 수 있어야 고칠 수 있습니다.
        """
        self.save_printer()
        self.p_status.config(text="찾는 중…", fg=SUB)
        self.root.update_idletasks()

        def work() -> None:
            try:
                from printer_find import self_test
                got = self_test(self.agent.cfg)
                # 찾았으면 그 주소를 적어 둡니다 — 방송을 못 듣는 날의 보조 바퀴
                if got.ip:
                    self.agent.cfg["printer_last_ip"] = got.ip
                    save_settings(self.agent.cfg)
            except Exception as e:  # noqa: BLE001
                got = type("X", (), {"ok": False, "message": f"찾다 멈췄습니다 — {e}"})()

            def show() -> None:
                self.p_status.config(text=got.message, fg=GREEN if got.ok else RED)
                self.say(("프린터: " if got.ok else "프린터 — ") + got.message)
            self.root.after(0, show)

        threading.Thread(target=work, daemon=True).start()

    def _controls(self, body) -> None:
        row = tk.Frame(body, bg=BG)
        row.pack(fill="x", pady=(2, 10))

        tk.Checkbutton(
            row, text="윈도우 켤 때 저절로 시작", variable=self.auto, command=self.toggle_auto,
            font=(F, 9), bg=BG, fg=SUB, activebackground=BG, activeforeground=SUB,
            selectcolor=PAPER, cursor="hand2",
        ).pack(side="left")

        self.start_btn = self._button(row, "지켜보기 시작", self.toggle_watch, kind="primary")
        self.start_btn.pack(side="right", ipadx=22, ipady=7)

    def _log(self, body) -> None:
        wrap = tk.Frame(body, bg=LINE)
        wrap.pack(fill="both", expand=True)
        card = tk.Frame(wrap, bg=PAPER)
        card.pack(fill="both", expand=True, padx=1, pady=1)

        tk.Label(card, text="기록", font=(F, 9, "bold"), bg=PAPER, fg=FAINT).pack(anchor="w", padx=14, pady=(9, 2))
        self.text = tk.Text(
            card, font=(F, 9), bg=PAPER, fg=SUB, relief="flat",
            state="disabled", wrap="word", height=8, padx=14, pady=4,
        )
        self.text.pack(fill="both", expand=True, pady=(0, 10))
        self.text.tag_configure("time", foreground=FAINT)

    # ---------- 트레이 (오른쪽 아래) ----------

    def _tray(self) -> None:
        """
        ★ 창을 닫아도 오른쪽 아래에 남아 계속 지켜봅니다.
        ★ 메뉴 글자는 상태에 따라 바뀝니다 (pystray 는 함수를 받아 줍니다).
        """
        try:
            image = Image.open(asset("denflow.ico"))
        except Exception:  # noqa: BLE001
            image = Image.new("RGB", (64, 64), BLUE)

        menu = pystray.Menu(
            pystray.MenuItem("열기", lambda *_: self.show(), default=True),
            pystray.MenuItem(
                lambda _i: "지켜보기 멈춤" if self.watching else "지켜보기 시작",
                lambda *_: self.root.after(0, self.toggle_watch),
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("끝내기", lambda *_: self.quit()),
        )

        self.tray = pystray.Icon("denflow-agent", image, "덴플로우 에이전트", menu)
        threading.Thread(target=self.tray.run, daemon=True).start()

    def _tray_title(self, state: str) -> None:
        if getattr(self, "tray", None) is None:
            return
        try:
            where = self.agent.cfg.get("clinic") or ""
            self.tray.title = f"덴플로우 에이전트 — {state}" + (f" ({where})" if where else "")
            self.tray.update_menu()
        except Exception:  # noqa: BLE001
            pass

    def balloon(self, msg: str) -> None:
        try:
            self.tray.notify(msg, "덴플로우 에이전트")
        except Exception:  # noqa: BLE001
            pass

    def show(self) -> None:
        def _do() -> None:
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()
        self.root.after(0, _do)

    def hide(self) -> None:
        """X 를 눌렀을 때 — 끄지 않고 숨깁니다"""
        self.root.withdraw()
        if not self.agent.cfg.get("told_tray"):
            self.agent.cfg["told_tray"] = True
            save_settings(self.agent.cfg)
            try:
                self.tray.notify("오른쪽 아래에서 계속 지켜봅니다. 끝내려면 트레이에서 '끝내기'.", "덴플로우 에이전트")
            except Exception:  # noqa: BLE001
                pass

    def quit(self) -> None:
        self.agent.stop.set()
        try:
            self.tray.stop()
        except Exception:  # noqa: BLE001
            pass
        self.root.after(0, self.root.destroy)

    # ---------- 상태 ----------

    def refresh(self) -> None:
        """지금 상태를 오른쪽 위 한 곳에 적습니다"""
        def _do() -> None:
            self._draw_connect()

            if self.watching:
                text, color = "지켜보는 중", GREEN
            elif self.agent.cfg.get("token"):
                text, color = "준비됨", BLUE
            else:
                text, color = "연결 안 됨", GREY

            self.state.config(text=text)
            self.dot.config(fg=color)
            self._tray_title(text)
            self.start_btn.config(text="지켜보기 멈춤" if self.watching else "지켜보기 시작")

        self.root.after(0, _do)

    # ---------- 동작 ----------

    def pick(self) -> None:
        picked = filedialog.askdirectory(title="구강스캐너 내보내기 폴더")
        if picked:
            self.folder.set(picked)

    def say(self, msg: str) -> None:
        stamp = time.strftime("%H:%M")

        def _put() -> None:
            self.text.config(state="normal")
            self.text.insert("end", stamp + "  ", "time")
            self.text.insert("end", msg.rstrip() + chr(10))
            self.text.see("end")
            self.text.config(state="disabled")

        if hasattr(self, "text"):
            self.root.after(0, _put)
        else:
            print(msg)

    def toggle_auto(self) -> None:
        self.say(set_autostart(self.auto.get()))

    def link(self) -> None:
        code = self.code.get().strip()
        if len(code) < 6:
            self.say("연결 코드 여섯 자리를 넣어 주세요")
            return
        threading.Thread(
            target=self.agent.link,
            args=(code, os.environ.get("COMPUTERNAME", "스캐너 PC")),
            daemon=True,
        ).start()

    def unlink(self) -> None:
        """이 PC 에서만 지웁니다 — 덴플로우 쪽 연결 해제는 계정정보에서 합니다"""
        self.stop_watch()
        for key in ("token", "device_id", "clinic"):
            self.agent.cfg.pop(key, None)
        save_settings(self.agent.cfg)
        self.code.set("")
        self.say("이 PC 의 연결을 지웠습니다. 새 코드로 다시 연결해 주세요.")
        self.refresh()

    def toggle_watch(self) -> None:
        self.stop_watch() if self.watching else self.start()

    def stop_watch(self) -> None:
        if not self.watching:
            return
        self.agent.stop.set()
        self.watching = False
        # ★ 출력 가져오기도 그 신호를 보고 끝납니다. 손잡이를 놓아 둬야
        #   다시 켤 때 "아직 돌고 있다" 고 잘못 보지 않습니다.
        self.print_thread = None
        self.say("지켜보기를 멈췄습니다. 지금 내보낸 것은 안 올라갑니다.")
        self.refresh()

    def start(self) -> None:
        folder = Path(self.folder.get().strip())
        if not self.agent.cfg.get("token"):
            self.say("먼저 연결 코드로 연결해 주세요")
            return
        if not self.folder.get().strip() or not folder.is_dir():
            self.say("내보내기 폴더를 골라 주세요")
            return

        self.agent.cfg["folder"] = str(folder)
        save_settings(self.agent.cfg)

        # ★ 멈췄다 다시 켤 수 있게 새 신호를 답니다 (한 번 set 된 Event 는 계속 켜져 있습니다)
        self.agent.stop = threading.Event()
        self.watching = True
        self.refresh()
        threading.Thread(target=self.agent.watch, args=(folder,), daemon=True).start()
        self.start_printing()

    # ---------- 출력 가져오기 ----------

    def start_printing(self) -> None:
        """
        덴플로우에 "출력할 것 있나요" 하고 물어보는 일을 띄웁니다.

        ★★ 이게 없으면 **아무도 출력 작업을 가져가지 않습니다.** 기공소에서
          보내도 치과 화면은 '출력 대기' 에 멈춘 채고, 아무 오류도 안 납니다.
          프린터 칸과 「프린터 찾기」만 만들어 두고 이걸 빠뜨렸습니다
          (2026-10-07에 찾음).

        ★ **프린터를 쓰겠다고 켠 치과만** 가져갑니다. 안 켠 치과가 작업을
          집어가면 가짜 프린터로 '출력' 해 버리고, 그 건은 끝난 것으로
          표시됩니다 — 아무 데서도 안 나온 채로요.
        """
        if self.agent.cfg.get("printer_kind") != "bambu":
            return
        if getattr(self, "print_thread", None) and self.print_thread.is_alive():
            return
        if not self.agent.cfg.get("token"):
            return

        try:
            from print_loop import PrintWorker  # noqa: PLC0415
        except Exception as e:  # noqa: BLE001
            self.say(f"출력 가져오기를 켜지 못했습니다: {e}")
            return

        worker = PrintWorker(
            self.agent.cfg["token"], self.agent.cfg, SETTINGS_DIR / "출력", say=self.say
        )
        self.print_thread = threading.Thread(
            target=lambda: worker.loop(stop=lambda: self.agent.stop.is_set()),
            daemon=True,
        )
        self.print_thread.start()
        self.say("출력 작업도 지켜봅니다.")

    def run(self) -> None:
        self.root.mainloop()
        self.agent.stop.set()


if __name__ == "__main__":
    App().run()
