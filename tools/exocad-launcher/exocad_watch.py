# -*- coding: utf-8 -*-
r"""설계 PC 에서 "exocad 로 열 것 있나요" 하고 물어봅니다 (2026-10-14).

    pythonw exocad_watch.py

★★ **왜 — 브라우저를 고리에서 뺍니다.** 지금까지는 주문 화면의 단추가
  `denflow://` 를 쏘아 런처를 띄웠습니다. 그런데 브라우저가 안 쏘면
  **창도 오류도 없이** 멈춥니다. 레지스트리도 런처도 멀쩡한데 화면엔
  '여는 중' 만 남습니다 (2026-10-13~14, 일곱 건). 브라우저가 열어 줄
  마음이 있느냐에 전부 걸려 있었고, 그건 우리가 고칠 자리가 아닙니다.

★ 이제 단추는 **서버에 줄 하나 남기는** 일만 합니다. 그다음은 우리
  프로그램끼리입니다 — 자동 출력이 이미 이 길로 돕니다.

★★ **런처를 다시 만들지 않습니다.** 받아 온 주문으로 `launcher.py` 를
  그대로 띄웁니다. 창도 단계 표시도 실패 창도 쓰던 그대로입니다 —
  같은 일을 두 벌로 만들면 한 벌만 고치는 날이 옵니다.

★ 열쇠는 스캔 올리는 에이전트와 **같은 기기 열쇠**입니다
  (%APPDATA%\DenFlow\scan_agent.json). 설계 PC 를 계정정보에서 한 번
  묶어 두면 됩니다.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow"

#: ★★ **설계 PC 열쇠는 따로 둡니다** (2026-10-14). 같은 PC 가 치과 기기로도
#:   묶여 있을 수 있습니다 — 지금 사장님 PC 가 그렇습니다(프린터를 돌리려고
#:   치ㅣ 치과 기기로 묶여 있음). 한 파일을 같이 쓰면 설계 PC 로 묶는 순간
#:   **치과 열쇠가 덮여 사라지고** 프린터 쪽을 다시 묶어야 합니다.
#: ★ 없으면 scan_agent.json 을 봅니다 — 치과 PC 에서는 그 하나뿐이고,
#:   거기서는 이 지켜보기가 돌 일도 없습니다.
DESIGN_SETTINGS = STATE / "design_agent.json"
SCAN_SETTINGS = STATE / "scan_agent.json"
LOG = STATE / "launcher" / "exocad-지켜보기.txt"

#: 몇 초마다 물어보나. 사람이 단추를 누르고 기다리는 시간입니다 — 짧게.
POLL_SECONDS = 3
#: 서버가 안 받아 줄 때는 천천히 — 꺼진 서버를 3초마다 두드리지 않습니다
BACKOFF_SECONDS = 60


def say(line: str) -> None:
    text = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {line}"
    print(text, flush=True)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(text + "\n")
    except OSError:
        pass


def settings_path() -> Path | None:
    for p in (DESIGN_SETTINGS, SCAN_SETTINGS):
        if p.is_file():
            return p
    return None


def settings(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def ask(base: str, token: str) -> dict:
    req = urllib.request.Request(
        f"{base}/api/device/exocad",
        data=b"{}",
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8", "replace"))
        except (ValueError, OSError):
            return {"ok": False, "error": f"서버가 {e.code} 로 답했습니다"}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"ok": False, "error": f"서버에 닿지 못했습니다 — {e}"}


def open_exocad(order_id: str, token: str) -> None:
    """런처를 그대로 띄웁니다 — 창이 뜨고 단계가 보입니다"""
    exe = Path(sys.executable)
    pythonw = exe.with_name("pythonw.exe")
    url = f"denflow://exocad/{order_id}?t={token}"
    subprocess.Popen(
        [str(pythonw if pythonw.exists() else exe), str(HERE / "launcher.py"), url],
        close_fds=True,
    )


def main() -> int:
    path = settings_path()
    if not path:
        say(f"기기 열쇠가 없습니다 — {DESIGN_SETTINGS}")
        say("덴플로우 계정정보에서 '설계 PC 연결' 코드를 받아 link_design.py 로 묶어 주세요")
        return 1

    cfg = settings(path)
    say(f"열쇠: {path.name}")
    base = cfg.get("base_url", "https://denflow.kr").rstrip("/")
    token = cfg.get("token")
    if not token:
        say("설정에 기기 열쇠가 없습니다")
        return 1

    say(f"지켜봅니다 — {base} · {POLL_SECONDS}초마다")
    quiet = False

    while True:
        got = ask(base, token)

        if not got.get("ok"):
            # ★ 같은 말을 3초마다 적지 않습니다 — 로그가 쓸려 나갑니다
            if not quiet:
                say(f"못 물어봤습니다: {got.get('error')}")
                quiet = True
            time.sleep(BACKOFF_SECONDS)
            continue

        quiet = False
        job = got.get("job")
        if job:
            say(f"열 것이 왔습니다 — 주문 {job['orderId'][:8]}")
            try:
                open_exocad(job["orderId"], job["token"])
            except OSError as e:
                say(f"런처를 못 띄웠습니다 — {e}")
            # ★ 띄우고 **조금 쉽니다.** 런처가 주문 정보를 받아 가야 서버에
            #   '가져갔다' 가 찍힙니다. 그 전에 또 물으면 같은 건을 두 번
            #   띄웁니다 — exocad 케이스가 둘로 만들어집니다.
            time.sleep(15)
            continue

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
