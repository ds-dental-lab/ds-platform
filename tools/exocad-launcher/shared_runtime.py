# -*- coding: utf-8 -*-
"""
파이썬 런타임을 **판과 상관없는 고정 자리**에서 돌립니다 (사용자 2026-10-24).

★★ 왜 — 윈도우 방화벽은 프로그램을 **파일 경로**로 기억합니다. 에이전트는 판마다 새 폴더
  (`덴플로우 에이전트 1.3.16\\runtime\\pythonw.exe`)에 풀리므로, 업데이트할 때마다 방화벽이
  "python 허용?" 을 다시 물었습니다. 이 PC 에만 판별 허용 규칙이 다섯 벌 쌓여 있었습니다.
  사용자 — "치과에서 허용이 계속 뜨게 되면 이게 맞나 의문점만 생길 것 같아".

★ 그래서 처음 뜰 때 판 폴더의 runtime 을 `%LOCALAPPDATA%\\DenFlow\\runtime\\<지문>` 에 한 번
  복사하고, **그 파이썬으로 다시 뜹니다.** 지문(RUNTIME_ID)은 빌드가 런타임 내용으로 만듭니다 —
  파이썬·꾸러미가 그대로면 판이 바뀌어도 같은 자리라 방화벽이 다시 묻지 않습니다.
  파이썬이나 꾸러미가 바뀐 판만 한 번 더 묻습니다(드뭅니다).

★ 무엇이든 실패하면 **원래대로** 판 폴더의 파이썬으로 그냥 뜹니다. 이 일이 에이전트를 못 뜨게
  만들면 안 됩니다.
★ 다시 뜬 쪽에는 DENFLOW_SHARED=1 을 붙여 두 번 다시 뜨지 않게 합니다.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ENV_FLAG = "DENFLOW_SHARED"
ID_FILE = "RUNTIME_ID"


def shared_root() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(base) / "DenFlow" / "runtime"


def runtime_id(runtime: Path) -> str | None:
    try:
        v = (runtime / ID_FILE).read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return v if v and v.isalnum() and len(v) <= 40 else None


def ensure_shared(own_runtime: Path, root: Path | None = None) -> Path | None:
    """판 폴더의 runtime 을 고정 자리로 (없으면) 복사하고 그 자리를 돌려줍니다. 못 하면 None"""
    rid = runtime_id(own_runtime)
    if not rid or not (own_runtime / "pythonw.exe").is_file():
        return None
    root = root or shared_root()
    target = root / rid
    if (target / "pythonw.exe").is_file() and runtime_id(target) == rid:
        return target
    tmp = root / f"{rid}.tmp-{os.getpid()}"
    try:
        root.mkdir(parents=True, exist_ok=True)
        if tmp.exists():
            shutil.rmtree(tmp, ignore_errors=True)
        shutil.copytree(own_runtime, tmp, ignore=shutil.ignore_patterns("__pycache__"))
        try:
            tmp.rename(target)
        except OSError:
            # 다른 쪽이 먼저 만들었으면 그것을 씁니다
            shutil.rmtree(tmp, ignore_errors=True)
            if not (target / "pythonw.exe").is_file():
                return None
        return target
    except OSError:
        shutil.rmtree(tmp, ignore_errors=True)
        return None


def prune(keep: Path, root: Path | None = None) -> int:
    """다른 지문의 옛 런타임을 치웁니다 — 쓰는 중이면 못 지우고 지나갑니다"""
    root = root or shared_root()
    gone = 0
    try:
        for d in root.iterdir():
            if d.is_dir() and d.resolve() != keep.resolve():
                try:
                    shutil.rmtree(d)
                    gone += 1
                except OSError:
                    pass
    except OSError:
        pass
    return gone


def running_shared(root: Path | None = None) -> bool:
    try:
        return Path(sys.executable).resolve().is_relative_to((root or shared_root()).resolve())
    except (OSError, ValueError):
        return False


def relaunch_if_needed(script: Path, argv: list[str], root: Path | None = None, spawn=None) -> bool:
    """
    고정 자리 파이썬으로 다시 띄웠으면 True — 부른 쪽은 바로 끝내야 합니다.
    이미 고정 자리면·다시 뜬 쪽이면·런타임 지문이 없으면(개발 실행) False.
    """
    if os.environ.get(ENV_FLAG) == "1" or running_shared(root):
        return False
    here_runtime = Path(sys.executable).resolve().parent
    shared = ensure_shared(here_runtime, root)
    if shared is None:
        return False
    exe_name = "python.exe" if Path(sys.executable).name.lower() == "python.exe" else "pythonw.exe"
    exe = shared / exe_name
    if not exe.is_file():
        return False
    env = dict(os.environ, **{ENV_FLAG: "1"})
    args = [str(exe), str(script), *argv]
    try:
        if spawn is not None:
            spawn(args, env)
        else:
            flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            subprocess.Popen(args, env=env, cwd=str(script.parent), creationflags=flags, close_fds=True)
        return True
    except OSError:
        return False
