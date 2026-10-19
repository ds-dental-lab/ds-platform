---
name: ds-flow-skill-sync
description: "DenFlow 스킬 — 메모리가 원본, 저장소 .claude/skills/denflow 와 claude.ai zip 은 생성물. 대화형 결과는 '덴플로우 인계' 블록으로 돌아옴 (2026-10-19)"
type: project
---

사용자 요청(2026-10-19): Code 대화창·대화형 클로드 어디서든 지금까지 기록을 보고 같은 결과를 내고, 결과물을 서로 잇고 싶다.

- **원본은 이 메모리 폴더 하나.** `tools/skill/build_denflow_skill.py` 가 주제별로 `.claude/skills/denflow/reference/` 에 복사(세션 ID 지움, 비밀값 [가림])하고 `tools/skill/dist/denflow-skill.zip`(gitignore) 을 만든다.
- **메모리를 고치면 PostToolUse 훅이 자동으로 다시 만든다** (`.claude/settings.json`). 새 메모리를 만들면 스크립트의 `GROUPS` 에 한 줄 넣을 것 — 안 넣으면 99-기타로 감.
- **비밀값이 하나라도 남으면 빌드가 멈추고 이전 reference 를 지키는 구조.** .env.local 값·내려받기 번호·JWT·긴 16진 열쇠를 검사. 값 자체는 메시지에 안 찍음.
- 서버 PC 처럼 메모리가 없는 PC 는 커밋된 reference 를 그대로 읽음 (빌드는 건너뜀).
- claude.ai 쪽은 **사용자가 zip 을 손으로 올림** (설정 → 기능 → 스킬). 메모리가 크게 바뀌면 다시 올려야 함.
- 대화형 → Code: 답 끝의 **"덴플로우 인계" 블록**(`.claude/skills/denflow/handoff.md` 형식)을 사용자가 Code 에 붙여 넣으면 → `docs/handoff/` 저장 → 메모리 반영 → 빌드 → 커밋.

**Why:** 기록이 이 PC 에만 있어 claude.ai 와 내일 들어올 서버 PC 가 처음부터 다시 배워야 했다.
**How to apply:** reference/ 는 손으로 고치지 않는다. 기록을 바꾸려면 메모리를 고친다. 인계 블록을 받으면 위 순서대로. 관련: [[ds-flow-working-style]] [[ds-flow-backlog]]
