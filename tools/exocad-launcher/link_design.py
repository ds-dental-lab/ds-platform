# -*- coding: utf-8 -*-
r"""설계 PC 를 덴플로우에 묶습니다 (2026-10-14).

    python link_design.py 123456

★★ **치과 열쇠를 안 건드립니다.** 이 PC 는 프린터를 돌리려고 치과 기기로도
  묶여 있습니다(scan_agent.json). 에이전트로 다시 묶으면 그 파일이 덮여
  **프린터 쪽이 끊깁니다.** 그래서 설계 PC 열쇠는 design_agent.json 에
  따로 적습니다.

★ 코드는 덴플로우 **계정정보 → 설계 PC 연결**에서 받습니다. 여섯 자리이고
  10분 살고 한 번 쓰면 끝입니다.
"""
from __future__ import annotations

import json
import os
import platform
import sys
import urllib.error
import urllib.request
from pathlib import Path

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow"
OUT = STATE / "design_agent.json"
BASE = "https://denflow.kr"


def main() -> int:
    code = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
    if not code.isdigit() or len(code) != 6:
        print("쓰기: python link_design.py <여섯자리코드>")
        return 1

    body = json.dumps({"code": code, "deviceName": f"설계 PC ({platform.node()})"}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api/device/link", data=body,
        headers={"content-type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            got = json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        got = json.loads(e.read().decode("utf-8", "replace") or "{}")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"서버에 닿지 못했습니다 — {e}")
        return 1

    if not got.get("ok"):
        print(f"묶지 못했습니다: {got.get('error')}")
        return 1

    STATE.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"token": got["token"], "device_id": got.get("deviceId"),
             "org": got.get("clinicName"), "base_url": BASE},
            ensure_ascii=False, indent=1,
        ),
        encoding="utf-8",
    )
    print(f"묶었습니다 — {got.get('clinicName')}")
    print(f"적은 곳: {OUT}")
    print("★ scan_agent.json 은 건드리지 않았습니다 (프린터 쪽 그대로)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
