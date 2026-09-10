# 덴플로우 → exocad 런처

PC 쪽 프로그램. 설계서: `Desktop/exocad-연동-설계서.md` (v2). 실제 실행 사본은 `C:\Users\DS\Desktop\denflow-exocad\` 에 있습니다 (config.json·logs 는 거기만).

- `install_machine.py` — `denflow://` 를 **컴퓨터 전체(HKLM)** 에 등록. 관리자 권한(UAC). ★ 이 PC 의 Chrome·Edge 는 사용자 영역(HKCU) 등록을 무시했음(2026-09-10) — 반드시 이걸로.
- `install.py` — 사용자 영역(HKCU) 등록. 윈도우 셸은 알아보지만 브라우저는 못 알아봄. 참고용
- `launcher.py` — 브라우저가 `denflow://exocad/<주문>?t=<토큰>` 을 열면 뜸. API → 다운로드 → 주문서 조립 → CAD-Data 배치 → 결과 보고
- `make_project.py` — `.dentalProject` 조립 (template.dentalProject 의 치아 블록을 틀로)
- `mock.json` — `python launcher.py --mock mock.json` 으로 API 없이 시험
- `config.json` (여기 없음) — `{ base_url, exocad_dir, converter_exe }`
- 필요: Python 3.10+, `pip install requests` (selenium 은 2단계용)

★ 첫 실전 통과 2026-09-10 (ORD-260910-001 zz: 12 크라운 + obj 1개 → 가져오기 정상). 브라우저 첫 클릭 때 "덴플로우 런처를 여시겠습니까?" → 항상 허용 체크 OK.
★ 1단계: dxd 는 기존 dxd-conversion.exe 를 띄우고 사람이 두 번 끌어다 놓음. DS Core 자동화는 `dxd-conversion-strings.txt` 를 참고해 2단계에서.
★ exocad 등록은 DentalDB 의 가져오기(Import) 클릭 한 번. sqlite 직접 등록은 2단계.
