---
name: ds-flow-dentbird-terms
description: "덴트버드 약관과 FlowTemp 자동화의 관계 — 걸리는 조항, 사용자 판단(지금은 감수), 지켜야 할 규칙 둘"
type: project
---

**2026-10-19 약관(2025-03-16 판, imagoworks.gitbook.io/terms-and-conditions) 읽음.**

- 걸리는 조항: **III.3.B "accessing … through any automated means, such as scripts or web crawlers" 금지.** 우리 설계 일꾼(셀레니움 매크로)이 정확히 이것. II.3 계정은 개인용·공유 금지(서버 전용 계정도 그 옆).
- 안 걸리는 것: 결과물(STL)의 상업적 이용·제3자 제공을 막는 조항 **없음**. 기공소가 설계해 치과에서 뽑는 건 의도된 용도.
- 사용자 판단(2026-10-19): **"영세해서 안 알아챌 것, 기공소가 서비스 써서 원격 출력하는 것뿐" → 지금은 감수.** 나는 "들킬 확률 낮음 ≠ 위반 아님"을 분명히 했고, 그 위에서 사용자가 선택.

**How to apply (내가 지킬 것):**
1. 치과·홈페이지·안내·알림 어디에도 **"덴트버드" 이름을 쓰지 않는다** — FlowTemp 는 "덴플로우가 설계해 치과에서 뽑는 임시치아"로만 ([[ds-flow-lab-secret]] 과 같은 규칙).
2. 덴트버드 부분은 **갈아 끼울 수 있는 한 조각**(`dentbird_macro.py`·`dentbird_web.py`·`dentbird_params.py`)으로 유지. 다른 로직을 거기 섞지 말 것. 대안 후보: exocad 자동 크라운(디자인 PC 에 있음), 3Shape Automate, 다른 AI 설계 API.
3. **메이트 너머로 치과가 늘기 시작하면** 이마고웍스에 공식 문의(API/기업 계약)를 다시 꺼낸다 — 결제 전·건수 협상 카드로. 사용자가 거절한 게 아니라 "지금은 아님".
4. 탐지 회피(패턴 숨기기 등)는 **하지 않는다** — 위반을 감수하는 것과 숨기는 것은 다르다.
