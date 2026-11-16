# -*- coding: utf-8 -*-
"""
출력 파일 하나를 **이 PC 에 물린 프린터**로 한 번 보냅니다. (2026-11-16, 시험 출력용)

  python print_once.py <파일.gcode.3mf>

★ 주문과 무관합니다. 프린터가 잘 나오는지 볼 때만 씁니다 — 주문의 출력은
  에이전트(print_loop)가 합니다.
★ 프린터 접속 값은 에이전트 설정에서 **읽기만** 하고 화면에 찍지 않습니다.
★ 프린터가 다른 것을 뽑는 중이면 보내지 않습니다.
★ 베드가 비었는지는 **사람이 먼저 확인**합니다. 이 도구는 묻지 않습니다.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import printer_send


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__)
        return 2
    path = Path(argv[0])
    if not path.is_file():
        print(f"파일이 없습니다: {path.name}")
        return 2

    settings_path = Path.home() / "AppData" / "Roaming" / "DenFlow" / "scan_agent.json"
    if not settings_path.exists():
        print("에이전트 설정이 없습니다 — 에이전트에서 프린터를 먼저 연결해 주세요")
        return 2
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    if (settings.get("printer_kind") or "").lower() != "bambu":
        print("에이전트에 프린터가 연결돼 있지 않습니다")
        return 2

    printer = printer_send.build(settings, path.parent)

    try:
        state = printer.status()
    except Exception as e:  # noqa: BLE001
        print(f"프린터에 닿지 못했습니다: {e}")
        return 1
    now = str(state.get("gcode_state") or "").upper()
    print(f"프린터 상태: {now or '모름'}")
    if now in ("RUNNING", "PREPARE", "PAUSE", "SLICING"):
        print("프린터가 다른 것을 뽑는 중입니다 — 보내지 않습니다")
        return 1

    last = ""
    for p in printer.send(path):
        if p.failed:
            print(f"{time.strftime('%H:%M:%S')} 실패: {p.failed}")
            return 1
        bits = []
        if p.started:
            bits.append("프린터가 우리 파일을 뽑기 시작했습니다")
        if p.paused:
            bits.append(f"멈춤: {p.paused}")
        if p.percent is not None:
            bits.append(f"{p.percent:.0f}%")
        if p.layer is not None and p.layers:
            bits.append(f"{p.layer}/{p.layers}층")
        if p.remaining is not None:
            bits.append(f"남은 {p.remaining}분")
        if p.note:
            bits.append(p.note)
        line = " · ".join(bits)
        if line and line != last:
            print(f"{time.strftime('%H:%M:%S')} {line}", flush=True)
            last = line
        if p.done:
            print(f"{time.strftime('%H:%M:%S')} 끝")
            return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
