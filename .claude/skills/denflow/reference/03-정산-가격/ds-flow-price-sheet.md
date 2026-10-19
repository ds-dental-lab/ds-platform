---
name: ds-flow-price-sheet
description: 수가표(치과에 보내는 가격표) — 기본값은 코드, 문의 화면에서 조정해 메일 본문으로 보냄, 보낸 값은 문의 줄에 남음
type: project
---

# 수가표 보내기 (2026-09-07, 커밋 eff052a)

- 종이 수가표: `C:\Users\DS\Desktop\덴플로우_수가표.html` → headless Chrome 으로 `덴플로우_수가표.pdf`. 옛 DS덴탈랩 양식에서 상호·Crown Zirconia 45,000·비고 열 삭제.
- 시스템: `domain/price-sheet` 기본값 6줄(PMMA 10,000 · Crown Zir 45,000 · Hybrid 40,000 · Inlay Zir 40,000 · Custom Abut 45,000 · Custom Abut+Zir 90,000). PC(/design/contacts)·폰(/m/contacts) 문의 줄에 **수가표 보내기** 버튼 → 값 조정 → **메일 본문**(HTML, PDF 첨부 아님)으로 발송(Resend). 보낸 값 `contact_requests.price_sheet_sent(_at)`, '기본값으로 저장' 은 `organizations.price_sheet`(null 이면 코드 기본값).
- 사용자 의도: "보내기 전에 조정, 지금 값이 기본값". 대화 알림톡처럼 남발 우려 없음.
- 시험 발송이 사용자 메일(dleotls124@gmail.com)로 한 통 갔음 — PMMA 12,000 은 시험값, 저장 기본값은 되돌려 둠.

관련: [[ds-flow-homepage]] [[ds-flow-business-registration]]

## 상담용 종이 (2026-09-30, 커밋 4635ebb)
- 사용자 요청: "스스로 수가표 만들 수 있게, 원장님과 상담할 때 A4 로 뽑아 가게".
- `/design/price-sheet` (메뉴 '수가표', **관리자만** — nav 테스트가 requireManagerSector 를 강제).
- 줄 추가·삭제·이름·금액을 화면에서 고치고 **인쇄/PDF**. 치과 이름을 적으면 머리에 '○○치과 귀중', 날짜 자동, 회사 이름·전화·주소는 SITE_LEGAL·SITE_TEL.
- 값은 문의 메일 수가표와 **같은 곳**(organizations.price_sheet). '기본값으로 저장' 은 새 액션 submitSavePriceSheet(관리자·checkPriceSheet 통과만).
- 인쇄는 기공의뢰서와 같은 A4 규칙(work-order-sheet 클래스 = @page work-order, 머리글 없음). 기본 6줄이면 1장.
- 2026-09-30: 메뉴 '수가표 요청'+'수가표' → **한 항목 '수가표'(/design/contacts)**, 안에서 탭(PriceSheetTabs: 문의 · 상담용 종이). 인쇄에는 탭 안 나옴.
- 종이 양식 = **메일 양식과 동일**(2026-09-30): 색(#16324F·#5B7186·#E3E9EF·#14B8A6), 대분류 rowspan+민트 띠, '리메이크 1년 무상 보증' 띠, 꼬리말(상호·전화·주소·denflow.kr). 색을 바꾸면 mail/price-sheet-mail 과 같이 바꿔야 함.
- 종이가 위쪽만 차던 것 → **A4 한 장 채우기**(2026-09-30): .price-sheet-paper min-height 279mm + .price-sheet-table flex:1(height:1px 요령), 보증 띠·꼬리말 print:mt-auto.
- **항상 한 장**(2026-09-30): PriceSheetEditor 가 종이 높이를 재서 넘칠 때만 --price-zoom(최소 0.5) 을 걸고, min-height 를 배율로 나눠 끝까지 채움. 잴 때는 zoom·min-height 를 잠깐 원래대로(안 그러면 배율이 바닥까지 내려감). 6줄 1.0 · 18줄 0.79 · 32줄 0.52 (실측, 모두 1장).
