---
name: ds-flow-agent-install-windows
description: 치과 PC 에 에이전트 깔 때 윈도우 보안이 어디서 묻는지 — 2026-10-19 이 PC 에서 재현한 사실과 막은 방법
type: project
---

**사용자 최우선(2026-10-19): "치과에 깔 때 백신·윈도우에 걸리는지가 가장 중요".** 10/07 제일치과에서 PyInstaller exe 가 SmartScreen 에 막힌 일이 있음.

## 재현으로 확인한 사실 (이 PC, Windows 11, Defender 만)
- 압축(latest.zip 1.3.2, 22MB) 안 실행 파일 45개: 36 서명 유효(PSF·MS), 서명 없음 9 = Pillow .pyd 8 + `tcl\nmake\nmakehlp.exe`(안 씀 → 빌드에서 뺌).
- **Defender 사용자 지정 검사: 위협 없음.**
- 브라우저로 받은 zip → 탐색기로 풀면 **모든 파일에 Zone.Identifier(인터넷에서 받음)** 가 붙음. PowerShell Invoke-WebRequest 는 안 붙음(시험 때 주의).
- 표시 붙은 **서명 없는 .cmd 두 번 누르기 → "게시자를 확인할 수 없습니다 / 실행·취소"** (노란 방패, 체크박스 없어 매번 뜸). 막는 것은 아니고 묻는 것.
- 표시 붙은 **서명된 pythonw.exe 는 창 없이 바로 뜸.** → 자동 시작 .lnk(pythonw 직접)·바탕화면 아이콘은 안 물음.
- 프린터 찾기는 UDP 2021/1990 bind → **방화벽 "액세스 허용" 창**. IP 칸 없음(시리얼로 찾음)이라 취소하면 프린터 못 찾음.

## 막은 것 (커밋 a0621af)
1. `scan_agent.unblock_folder(HERE)` — 처음 뜰 때 자기 폴더 Zone.Identifier 전부 삭제 → 두 번째부터 안 물음.
2. build-embed: tcl/nmake 제외 → 압축에 서명 없는 exe 0개.
3. `/agent` 안내: 풀기 전 **zip 속성 → 차단 해제** 단계 + 뜰 수 있는 창 넷(노란 방패/파란 PC 보호/위협 검출/방화벽)을 생긴 모양대로.
- **1.3.3 올림 (2026-10-19 10:55, 커밋 ae1b648)** — latest.zip·1.3.3.zip, 23.2MB, exe 는 python/pythonw 둘뿐. 서버 AGENT_VERSION 도 1.3.3(푸시 필요). 빌드는 `DENFLOW_DIST="$TMP/claude/agent-build/덴플로우 에이전트"` 로 — 이 PC 치ㅣ 에이전트가 dist-embed 에서 돌아 제자리 빌드 불가. **끝 폴더 이름은 꼭 '덴플로우 에이전트'**(release 가 DIST.name 을 zip 안 폴더명으로 씀).
- VirusTotal URL 검사 0/93 (주소 평판일 뿐). **파일 검사(2026-10-19 11:10, Chrome 확장으로 올림): 우리 파일 전부(.cmd·.py·ico) + python/pythonw.exe + PIL .pyd 8개 = 6.7MB zip → 악성 표시 0, AhnLab-V3·ALYac(알약)·TACHYON(잉카 nProtect)·ViRobot(하우리)·Microsoft 전부 Undetected. 치과에 흔한 보안: V3 > 알약 > Defender 만 > nProtect(EDI·은행 모듈로 거의 다 있음).** sha256 [가림]. 정적 검사만 — V3 행동 감시(Startup .lnk 생성)는 실제 V3 PC 에서 봐야 함.
- 방법 메모: Chrome file_upload 는 10MB 한도. VT 파일 입력은 shadow DOM 안 → JS 로 input 을 body 로 옮기고 file_upload 후 change 이벤트 dispatch → "Confirm upload". 긴 JS 는 확장이 "Cookie/query string" 으로 막음 — 짧게.

## 내려받기는 여섯 자리 번호 뒤로 (사용자 결정 2026-10-19)
- 사용자 걱정: "다른 회사가 치과로 가입해 받아 갈 수 있다" → 로그인 게이트 거절, 센터 발급 번호도 거절 → **고정 여섯 자리 비밀번호 하나**. "설치는 내가 직접 가든 원격이든 해 준다".
- 구현: env `AGENT_DOWNLOAD_PIN`(코드에 없음, .env.local 에 [가림](사용자 지정) — **Vercel 에도 넣어야 함**), `domain/agent.pinMatches`(상수 시간), `actions/agent-download`(틀리면 1.5초 지연, 맞으면 1분 서명 주소, 파일명 영문 denflow-agent.zip), `components/agent/DownloadGate`. migration 20261019120000 버킷 public=false(**db push 전까지는 공개 주소가 아직 200**).
- 에이전트 "새 판" 띠는 여전히 /agent 로 보냄 → 사람이 번호 넣고 받음(자기 갱신 경로 없음, 사용자 의도).

## 바로가기 — powershell 뺌 (1.3.4, 2026-10-19 커밋 316b7ca, latest.zip 올림)
- 사용자 "사후처리보다는 미리". `shell_link.py` 가 IShellLinkW 를 ctypes 로 같은 프로세스 안에서 부름(새 프로그램 안 띄움). scan_agent 의 link_target·make_desktop_link·set_autostart 셋 다. subprocess import 도 없어짐.
- 함정: ctypes 에서 GUID 를 임시로 만들어 addressof 넘기면 부르는 사이 지워져 E_NOINTERFACE — 변수에 붙들 것.
- 검증: 윈도우 자체 리더로 대상·인자·폴더·최소화(7) 확인, 셸로 열어 실행 확인, 묶은 런타임 안에서 확인.

## 판 갈아 끼우기 (1.3.7·1.3.8, 2026-10-19)
- 1.3.7 `takeover.py`: 새 판을 켜면 **떠 있는 쪽이 더 옛 판일 때만** 내리고 자리 잡음(같은 판이면 창만 앞으로). 1.3.7+끼리는 `scan_agent.takeover` 파일로 곱게(1초 폴링), 1.3.6 이하는 창 제목→pid 로 끝냄. run 파일 `scan_agent.run.json`{pid,version,home}.
- 1.3.8: **zip 안 폴더 = "덴플로우 에이전트 {판}"** (돌고 있는 폴더는 DLL 잠겨 덮어쓰기 불가 — 사용자가 실제로 막힘). 자리 잡은 뒤 옛 폴더를 스스로 치움(`safe_to_remove`: 내 자리·내 자리를 품은 폴더·에이전트 모양 아닌 폴더는 안 건드림). 자동 시작·바탕화면 아이콘을 새 폴더로. `/agent` 안내는 3단계(차단 해제·아무 데나 풀기·두 번 누르기), '끝내기' 없음.
- 빌드: `DENFLOW_DIST` 는 이제 **부모 폴더**(`$TMP/claude/agent-build`), 결과는 그 아래 `덴플로우 에이전트 1.3.x`. release.py 도 같은 규칙.
- 이 PC 치ㅣ 에이전트(1.3.2, dist-embed)를 실제로 넘겨받는 건 사용자가 직접 해 보기로(내 작업 창에서 에이전트 안 띄움). 1.3.2 는 run 파일이 없어 기록에 "옛 판(옛 판)" 으로 뜸.

## 남은 위험 (안 고침)
- 시작프로그램 **폴더에 파일이 생기는 것 자체**를 보는 제품은 여전히 물을 수 있음(그건 설치 프로그램 다 하는 일이라 드묾).
- 치과에 다른 백신(V3·알약)이 있으면 결과가 다를 수 있음 — 이 PC 는 Defender 뿐.

## 설치 점검 (1.3.9, 2026-10-21 — 사용자 "설치 점검 기능 만들어줘")
- `install_check.py`: 에이전트 창 「설치 점검」 단추 / `--check`(창 없이). 검사: 연결 코드, denflow.kr 닿기+서버 시계 차이, 파일 저장소 닿기, 스캔 폴더(존재·최근 7일 파일 수만), 설정 폴더 쓰기, 자동 시작, 절전(powercfg AC), 백신(SecurityCenter2 — 디펜더 외면 예외 등록 안내), 프린터(방송 찾기 → 8883·990 포트 → 990 로그인 → 8883 상태). 빠진 것마다 고치는 말 한 줄. 결과는 `%APPDATA%\DenFlow\install_check.txt`.
- 왜: 전 구간이 우리 망·우리 프린터에서만 돌았음. 치과(스캐너 PC)에서 처음 막히는 곳은 망·방화벽·절전·백신. 치과 PC = **스캐너 PC** (폴더를 지켜보니 거기여야 함).
- 이 PC 실측(2026-10-21 16:14) 전부 O. 치과 설치 날 첫 순서로 이 단추.
- **1.3.9 올림 (2026-10-21 16:30, 커밋 d5c8316 푸시됨)** — latest.zip·1.3.9.zip 23.3MB. 치ㅣ 에이전트는 아직 1.3.8 → 새 판 띠 뜨면 갈아 끼울 것.
- **1.3.10 올림 (2026-10-21 17:30, 커밋 74288d8 푸시됨)** — 프린터 주소 훑기(printer_sweep). 치ㅣ 는 1.3.8 → 새 판 띠 뜨면 1.3.10 으로.
