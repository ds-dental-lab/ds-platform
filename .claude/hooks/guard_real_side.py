# -*- coding: utf-8 -*-
"""
작업 도구(Claude)가 실제 쪽을 건드리지 못하게 막는 문지기 (2026-10-16).

★ 왜 — 2026-10-16 하루에 두 번 당했습니다.
  1) 작업 도구에서 띄운 감시 프로그램들이 세션 재시작 때 같이 죽어서
     메이트 exocad 요청 8건을 아무도 안 가져갔습니다.
  2) 작업 도구가 %APPDATA%\\DenFlow 에 쓴 파일(설계 열쇠·런처 설정)은
     **실제 Windows 에서 안 보입니다** — 저만 보이는 사본이었습니다.
  메모만으로는 또 실수합니다. 그래서 명령 자체를 막습니다.

막는 것: AppData\\Roaming\\DenFlow 에 쓰기·복사·이동·삭제 / 상시 프로그램 띄우기.
두는 것: 읽기(cat·tail·ls·Get-Content), 프로세스 끄기(taskkill·Stop-Process),
        저장소 안 테스트, design_worker --once 같은 한 번 돌리기.
"""

import json
import re
import sys

REASON = (
    "상시 프로그램·실제 AppData 는 작업 도구에서 건드리지 않습니다 — "
    "사용자에게 시작프로그램/재부팅을 부탁하거나 저장소 _seed 사본을 쓰세요. "
    "(기억: ds-flow-no-service-from-sandbox)"
)

DENFLOW_DIR = re.compile(
    r"(appdata[\\/]+roaming[\\/]+denflow|\$appdata[\\/]+denflow|\$\{appdata\}[\\/]+denflow"
    r"|\$env:appdata[\\/]+denflow|%appdata%[\\/]+denflow|getenv\(['\"]appdata['\"]\)"
    r"|environ\[['\"]appdata['\"]\]|environ\.get\(['\"]appdata['\"]\))",
    re.I,
)

# 실제 쪽 폴더를 바꾸는 말들
WRITE_WORDS = re.compile(
    r"(^|[\s;|&(])(cp|mv|rm|rmdir|mkdir|touch|tee|install|ln|"
    r"copy-item|move-item|remove-item|new-item|set-content|add-content|out-file|"
    r"rename-item|clear-content|del|copy|move|xcopy|robocopy|ren)\b"
    r"|>>?|\.write_text|\.write_bytes|open\([^)]*['\"][wax]\+?b?\\?['\"]|shutil\.|os\.remove|os\.replace"
    r"|os\.rename|unlink\(|mkdir\(",
    re.I,
)

SERVICES = re.compile(
    r"(exocad_watch|temp_watch|scan_agent|print_loop)\.py"
    r"|design_worker\.py(?![^\n;|&]*--once)"
    r"|open_browser"
    r"|wscript(\.exe)?\b[^\n]*\.vbs"
    r"|start-process[^\n]*\.vbs"
    r"|explorer(\.exe)?\b[^\n]*\.vbs"
    r"|cscript(\.exe)?\b[^\n]*덴플로우",
    re.I,
)

# 끄기·읽기·찾기는 그대로 둡니다
HARMLESS_START = re.compile(
    r"^\s*(taskkill|stop-process|get-process|tasklist|grep|rg|cat|head|tail|ls|dir|"
    r"get-content|get-childitem|select-string|git\s|wmic\s+process\s+(where|get)|find\b)",
    re.I,
)


def verdict(cmd: str) -> str | None:
    if not cmd:
        return None
    if DENFLOW_DIR.search(cmd) and WRITE_WORDS.search(cmd):
        return "실제 쪽 설정 폴더(AppData\\Roaming\\DenFlow)에 쓰려고 합니다. " + REASON
    if SERVICES.search(cmd) and not HARMLESS_START.match(cmd):
        return "상시 프로그램을 작업 도구에서 띄우려고 합니다. " + REASON
    return None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:  # noqa: BLE001 — 입력을 못 읽으면 막지 않습니다
        return 0
    tool_input = data.get("tool_input") or {}
    cmd = str(tool_input.get("command") or "")
    why = verdict(cmd)
    # Write·Edit 로 그 폴더에 직접 쓰는 것도 같은 일입니다
    path = str(tool_input.get("file_path") or "")
    if not why and path and DENFLOW_DIR.search(path.replace("/", "\\")):
        why = "실제 쪽 설정 폴더(AppData\\Roaming\\DenFlow)에 쓰려고 합니다. " + REASON
    if why:
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": why,
            }
        }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
