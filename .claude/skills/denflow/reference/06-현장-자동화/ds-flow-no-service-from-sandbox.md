---
name: ds-flow-no-service-from-sandbox
description: 상시 프로그램(지켜보기·일꾼·에이전트)을 내 작업 창에서 띄우지 말 것 — 세션 재시작 때 같이 죽음
type: feedback
---

상시 도는 프로그램(exocad 지켜보기·임시치아 지켜보기·설계 일꾼·덴플로우 에이전트)은 **내 Bash/PowerShell 도구에서 띄우지 않는다.** 사용자에게 시작프로그램 폴더(`shell:startup`)의 vbs·바로가기를 두 번 눌러 달라고 하거나 재부팅을 권한다.

**Why:** 2026-10-16 12:00 무렵 Claude 앱의 작업 환경이 재연결되면서, 내가 도구에서 띄운 넷이 전부(spawn.detached·explorer 경유 포함) 함께 꺼졌다. 그 사이 메이트 '늘봄 김동일' exocad 요청 두 번(12:10, 12:26)을 아무도 안 가져가 사용자가 "변환이 안 된다"고 했다. 메이트 피해 금지 원칙에 걸리는 일.

**How to apply:** 코드 고친 뒤 새 코드로 갈아 끼울 때도 마찬가지 — 프로세스를 끄는 것까지만 하고(시작프로그램 반복기가 10초 뒤 다시 띄움; 반복기 자체가 내가 띄운 것이면 안 됨), 반복기가 없으면 사용자에게 띄워 달라고 한다. 시험용 단발 실행(--once 등)은 괜찮다. [[ds-flow-fdm-print]]

## 더 근본: 내 도구가 쓴 AppData 는 실제 Windows 에서 안 보임 (2026-10-16 확인)
- 실제 부팅 때 뜬 일꾼에게 design_agent.json 이 **FileNotFoundError** (내 쪽에선 보임). 내 도구 안에서 AppData 에 쓴 파일(열쇠·로그·크롬 프로필의 로그인)은 **나만 보는 사본**. 내 "dangerouslyDisableSandbox" 확인도 진짜 바깥이 아니었음.
- **저장소 폴더(Desktop\ds-platform)는 양쪽이 같이 봄.** 그래서: 실제 쪽 상태는 `tools/exocad-launcher/_real_state.txt`(gitignore)로 봄 — ensure_design_key·일꾼 say 가 거기에도 씀. 실제 AppData 에 무엇을 넣어야 하면 저장소에 임시 사본(_seed_*.json, gitignore) → 실제 쪽 프로그램이 옮기고 지움.
- 내가 띄운 크롬에서 한 덴트버드 로그인도 내 사본 프로필에만 남음 → 실제 쪽 일꾼이 띄운 크롬에서 로그인해야 함(2026-10-16 12:38 실제 크롬은 로그인돼 있었음).
- 시작프로그램 vbs·저장소 코드 수정은 실제 쪽에 반영됨(Startup 폴더 파일은 보였음 — 예외인 이유는 미확인).
- **런처 config.json 도 같은 함정이었음** (2026-10-16): 실제 쪽 런처가 FileNotFoundError 로 조용히 죽어 12시 이후 메이트 exocad 8건 안 열림 → state.adopt_seeds(_seed_launcher, settings.json(비번) 은 제외). 실제 쪽 OrcaSlicer.conf 는 있음(확인).
- 진단 방법: 실제 쪽 프로그램이 저장소 `_real_state.txt`·`_real_launcher.log` 에 남김. 실제 쪽 프로세스를 **끄는 것**은 내가 해도 됨(시작프로그램 반복기가 실제 쪽에서 다시 띄움).

## 막는 장치 셋 (2026-10-16, 사용자 "다시 안 생기도록")
1. **문지기 훅** `.claude/settings.json` → `.claude/hooks/guard_real_side.py` (PreToolUse; Bash·PowerShell·Write·Edit): python/pythonw 로 상시 프로그램 실행, wscript·Start-Process 로 vbs 띄우기, 실제 DenFlow 설정 폴더에 쓰기를 **거절**. 읽기·끄기·grep·git·`--once`·heredoc 본문은 통과. 시험 `python .claude/hooks/test_guard_real_side.py`. 막히면 우회하지 말고 사용자에게 부탁; 오탐이면 훅을 고치고 시험에 사례 추가. 루트 `.gitignore` 의 `settings.json` 줄은 DS Core 비번용이라 `!.claude/settings.json` 로 예외만 둠.
2. **설계 PC 자기 점검** `watch_common.preflight()` — 설계 열쇠·런처 config.json·OrcaSlicer.conf·시작프로그램 vbs 셋. 일꾼 heartbeat `status.missing` → 상태판 '확인 필요'·"빠진 것: …". 일꾼 재시작 뒤부터 적용.
3. **exocad 3분 무응답 알림** — `exocad_stuck_watchdog` (pg_cron 1분, migration 20261016180000, 칸 `stuck_alerted_at`). 설계센터 org 에 'exocad.stuck' 알림 → /design/devices.
