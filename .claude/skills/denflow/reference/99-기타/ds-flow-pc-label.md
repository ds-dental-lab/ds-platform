---
name: ds-flow-pc-label
description: "사용자에게 할 일을 안내할 때 단계마다 어느 PC 인지 [디자인PC]·[서버PC] 로 붙임 (2026-11-02)"
type: feedback
---

안내하는 단계·명령마다 앞에 [디자인PC] 또는 [서버PC] 를 붙인다.
- [디자인PC] = 지금 나와 대화하는 PC (C:\Users\DS\Desktop\ds-platform, 커밋·푸시하는 곳)
- [서버PC] = 덴트버드 설계 일꾼·출력이 도는 PC (C:\DenFlow\ds-platform, 사용자 hep78, git pull·재시작·도구 실행)

**Why:** 2026-11-02 확인 도구를 홈 폴더에서 돌리고, 푸시 전에 pull 해서 두 번 헛걸음함. 사용자: "앞으로 어느 피시에서 진행해야 할지 괄호 치고 표기해 줘".
**How to apply:** 순서 안내·명령 블록 앞마다 꼭 붙임. 한 PC 만 쓰는 안내라도 붙임. 관련 [[ds-flow-server-pc-rebuild]], [[ds-flow-working-style]]
