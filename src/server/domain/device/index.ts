// =========================================================
// 놓을 위치: src/server/domain/device/index.ts
//
// 폰인가 아닌가. (2026-08-23)
//
// ★★ **왜 필요한가.** 치과 계정으로 폰에서 들어오면 데스크톱 화면이
//   떴습니다. 사이드바 200px 가 화면의 절반을 먹고, '재스캔' 이
//   글자 하나씩 세로로 흘러내립니다 — 사장님이 그 화면을 찍어
//   보내 주셨습니다. 만들어 둔 진료실 화면(/m)이 있는데도
//   **거기로 가는 길이 없었습니다.**
//
// ★ 태블릿은 폰이 아닙니다. 데스크는 아이패드로 의뢰서를 씁니다 —
//   거기까지 진료실 화면으로 보내면 주문등록을 못 합니다.
//
// ★ 이 값으로 **권한을 정하지 않습니다.** 어디로 보낼지만 정합니다.
//   User-Agent 는 누구나 바꿔 쓸 수 있어서, 그걸로 막으면 안 막힙니다.
// =========================================================

/**
 * 손에 드는 폰인가.
 *
 * ★ 안드로이드는 `Mobile` 이 있어야 폰입니다. 그 글자가 없으면
 *   안드로이드 태블릿입니다.
 */
export function isPhone(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;

  const ua = userAgent.toLowerCase();

  // 아이패드는 뺍니다 (태블릿)
  if (ua.includes('ipad')) return false;

  if (ua.includes('iphone') || ua.includes('ipod')) return true;
  if (ua.includes('windows phone')) return true;
  if (ua.includes('android') && ua.includes('mobile')) return true;

  return false;
}
