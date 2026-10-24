# -*- coding: utf-8 -*-
"""
에이전트 **스스로 새 판으로 바꾸기** (사용자 2026-10-24 — "계속 다운로드 말고 최신 버전 있으면 자동 업데이트").

흐름
  1) 서버에 묻습니다(/api/device/agent/update). 이미 연결된 기기라 다운로드 번호가 필요 없습니다.
     서버는 이 기기가 받을 판(시험 PC 는 베타, 치과는 사장님이 올려 준 안정판)과 지문·서명 주소를 줍니다.
  2) **한가할 때만** — 출력 중·스캔 올리는 중이면 다음 차례로 미룹니다.
  3) 받아서 **지문(sha256)이 맞는지** 봅니다. 다르면 버립니다.
  4) 지금 폴더 옆에 「덴플로우 에이전트 <판>」 으로 풀고 새 판을 띄웁니다.
     새 판이 옛 판에게 자리를 넘겨 달라고 하고(takeover), 옛 폴더도 치웁니다 — 1.3.7 부터 되던 일.
  5) 파이썬은 고정 자리(shared_runtime)라 방화벽이 다시 묻지 않습니다(1.3.17).

★ 무엇이든 실패하면 **아무 일도 안 일어난 것처럼** 지금 판이 계속 돕니다. 업데이트 때문에
  에이전트가 멈추면 그게 가장 나쁩니다.
★ 브라우저로 받은 파일이 아니라 '인터넷에서 받음' 표시가 안 붙습니다 — 실행 확인 창도 안 뜹니다.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

#: 압축 안 맨 위 폴더 이름의 머리 — 이 모양이 아니면 풀지 않습니다
HOME_PREFIX = "덴플로우 에이전트 "
#: 받기 시한
DOWNLOAD_TIMEOUT = 300


def parse_version(v) -> tuple[int, ...] | None:
    try:
        parts = tuple(int(p) for p in str(v).strip().split("."))
    except ValueError:
        return None
    return parts if 2 <= len(parts) <= 4 else None


def is_newer(theirs, mine: str) -> bool:
    a, b = parse_version(theirs), parse_version(mine)
    return bool(a and b and a > b)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, sha256: str, work: Path) -> Path:
    """받아서 지문을 봅니다. 다르면 ValueError"""
    work.mkdir(parents=True, exist_ok=True)
    out = work / "update.zip"
    with urllib.request.urlopen(url, timeout=DOWNLOAD_TIMEOUT) as r, open(out, "wb") as f:
        shutil.copyfileobj(r, f)
    got = sha256_of(out)
    if got.lower() != str(sha256).lower():
        out.unlink(missing_ok=True)
        raise ValueError(f"받은 파일의 지문이 다릅니다 ({got[:12]} ≠ {str(sha256)[:12]})")
    return out


def install(zip_path: Path, parent: Path, version: str) -> Path:
    """
    지금 폴더 옆(parent)에 풉니다. 돌려주는 것: 새 판 폴더.
    ★ 압축 안이 「덴플로우 에이전트 <판>/…」 한 폴더뿐이고 밖으로 나가는 길이 없을 때만 풉니다.
    ★ 같은 이름 폴더가 이미 있으면(지난번에 받다 만 것) 지우고 새로 풉니다.
    """
    want = f"{HOME_PREFIX}{version}"
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        tops = {n.replace("\\", "/").split("/", 1)[0] for n in names if n.strip("/")}
        if tops != {want}:
            raise ValueError(f"압축 안 모양이 다릅니다: {sorted(tops)[:3]}")
        base = (parent / want).resolve()
        for n in names:
            dest = (parent / n).resolve()
            if not dest.is_relative_to(base):
                raise ValueError(f"압축 안 경로가 밖으로 나갑니다: {n}")
        if base.exists():
            shutil.rmtree(base)
        z.extractall(parent)
    if not (base / "scan_agent.py").is_file() or not (base / "runtime" / "pythonw.exe").is_file():
        raise ValueError("풀었는데 에이전트 파일이 없습니다")
    return base


def launch(home: Path, spawn=None) -> bool:
    """새 판을 트레이로 띄웁니다. 새 판이 고정 자리 파이썬으로 다시 뜨고, 옛 판에게 자리를 넘겨받습니다"""
    exe = home / "runtime" / "pythonw.exe"
    args = [str(exe), str(home / "scan_agent.py"), "--tray"]
    env = {k: v for k, v in os.environ.items() if k != "DENFLOW_SHARED"}
    try:
        if spawn is not None:
            spawn(args, env)
        else:
            flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            subprocess.Popen(args, env=env, cwd=str(home), creationflags=flags, close_fds=True)
        return True
    except OSError:
        return False


class Updater:
    """
    ask()      → 서버 답 dict ({ok, version, url, sha256}) 또는 None
    idle()     → 지금 바꿔도 되는가
    say(text)  → 기록
    """

    def __init__(self, current: str, home: Path, ask, idle, say=print, enabled=lambda: True):
        self.current = current
        self.home = home
        self.ask = ask
        self.idle = idle
        self.say = say
        self.enabled = enabled
        #: 같은 판을 계속 실패하면 하루에 한 번만 다시 해 봅니다
        self.failed: dict[str, float] = {}
        self.started = False

    def try_once(self) -> str:
        """한 번 해 봅니다. 돌려주는 것: 'off'·'none'·'busy'·'skip'·'failed'·'started'"""
        if self.started:
            return "started"
        if not self.enabled():
            return "off"
        got = self.ask() or {}
        version, url, sha = got.get("version"), got.get("url"), got.get("sha256")
        if not (version and url and sha) or not is_newer(version, self.current):
            return "none"
        if time.time() - self.failed.get(str(version), 0) < 24 * 60 * 60:
            return "skip"
        if not self.idle():
            return "busy"
        self.say(f"새 판 {version} 을 받습니다 — 다 되면 저절로 바뀝니다")
        work = Path(tempfile.mkdtemp(prefix="denflow-update-"))
        try:
            z = download(url, sha, work)
            new_home = install(z, self.home.parent, str(version))
            if not launch(new_home):
                raise OSError("새 판을 띄우지 못했습니다")
        except Exception as e:  # noqa: BLE001 — 업데이트가 에이전트를 멈추면 안 됩니다
            self.failed[str(version)] = time.time()
            self.say(f"새 판으로 못 바꿨습니다 — {e}. 지금 판으로 계속 돕니다")
            return "failed"
        finally:
            shutil.rmtree(work, ignore_errors=True)
        self.started = True
        self.say(f"새 판 {version} 을 띄웠습니다 — 곧 자리를 넘깁니다")
        return "started"
