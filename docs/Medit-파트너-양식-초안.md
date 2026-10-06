# Medit Company Profile Form — 작성 초안

보낼 곳: integrations@medit.com (Medit Business Development)
받은 날: 2026-10-06 / 원본: `Medit_Company Profile Form.docx`

양식 오른쪽 칸에 Medit 자기 회사 정보가 **예시로** 채워져 있습니다. 그 자리를 우리 것으로 바꿔 넣으면 됩니다.
⬜ 는 사실 확인이 필요해 비워 둔 칸입니다.

---

## General Information

| 항목 | 넣을 값 |
|---|---|
| Company name | DenFlow (덴플로우) — registered as 덴플로우 치과기공소 / DenFlow Dental Laboratory |
| Founded in.. | Year 2026 |
| Head Office | ⬜ 사업자등록증의 소재지 (시·도 + Korea) |
| Website address | https://denflow.kr |
| Territories covered | South Korea |
| Business Field (Main product) | Cloud workflow platform for dental clinics and laboratories, operated together with our own dental laboratory |
| Software Type and Name | DenFlow — Lab/Case Management + Ordering platform (lab-side PMS). Includes CAD automation (exocad) and AI design hand-off |
| Software Web/App | Web-based (clinic and lab both use the browser). A small Windows companion app, *DenFlow Agent*, runs on the scanner PC to upload exports automatically |
| Supported Languages | Korean (English planned) |
| Registration Status (If "medical devices") | Not applicable — DenFlow is a workflow/ordering software, not a medical device. The operating entity is a licensed dental laboratory in Korea (registered 2026-09-07) |
| Main business region | South Korea |
| Approximate number of users (market share) | Early rollout: ⬜ 치과 N곳 · 월 주문 ⬜ 건 (2026-10 기준). Growing through direct onboarding of clinics |
| Vision / Core values / Positioning | We remove the manual steps between the chair and the lab. A clinic scans and exports as usual; DenFlow captures the scan, opens a pre-filled order, and routes the case straight into CAD. Our position is not another CAD vendor — we are the layer that makes an existing scanner's output immediately actionable, so clinics keep using the scanner they already own |

## Cooperation with Medit

| 항목 | 넣을 값 |
|---|---|
| Type of desired cooperation | **Open API / Integration** |

### 같이 적어 보낼 내용 (양식에 칸이 없으므로 메일 본문에)

1. **지금 무엇이 되어 있는지** — Medit Link 의 *Export* 로 내보낸 케이스(폴더/zip, OBJ·PLY·STL)를 그대로 읽어 환자 이름·케이스 이름·치식까지 주문서에 채워 넣는 부분은 **이미 동작합니다.** 치과에서 추가로 할 일은 치식과 보철 종류를 고르는 것뿐입니다.
2. **왜 API 가 필요한지** — 내보내기는 치과가 매번 눌러야 합니다. Medit Link 에 들어온 주문(case/order)을 바로 읽어올 수 있으면 그 한 번의 수동 조작도 사라집니다.
3. **필요한 범위** — 연결된 치과 계정의 케이스 목록 조회, 케이스 메타데이터(환자·치식·보철), 스캔 메시 다운로드. 쓰기는 필요 없습니다(상태 회신이 가능하다면 유용).
4. **요청** — `client_id` / `client_secret`, 콜백 URL 등록, API 문서, 그리고 샌드박스 계정.

---

## 메모

- 사용자 수를 묻는 칸이 우리 약점입니다. 숫자로 겨루지 말고 **"치과가 이미 쓰는 Medit 스캐너의 가치를 높이는 쪽"** 으로 적는 게 낫습니다. 위 Vision 칸 문장이 그 의도입니다.
- 실제 규모는 숨기지 않고 그대로 적습니다. 과장하면 샌드박스 받은 뒤에 드러납니다.
- 3Shape 쪽은 아직 샘플 내보내기 하나가 필요합니다(이름 규칙 확인용).
