// =========================================================
// 놓을 위치: src/server/domain/ping/index.ts
//
// 안 읽은 알림을 탭 제목에 붙이는 규칙. (사용자 결정 2026-08-13)
//
// ★ 왜 규칙으로 두는가.
//   문자열을 앞에 붙였다 뗐다 하는 일은 **반드시 겹칩니다.**
//   화면을 옮기면 Next 가 제목을 새로 쓰고, 그 위에 또 붙이면
//   '(2) (1) DS Flow' 가 됩니다. 눈으로는 잘 안 보이는 종류의 버그라
//   테스트로 못박습니다.
// =========================================================

/** 이미 붙어 있는 숫자표. '(3) ' */
const PREFIX = /^\(\d+\)\s*/;

/** 붙인 것을 떼어 낸 본래 제목 */
export function baseTitle(title: string): string {
  return title.replace(PREFIX, '');
}

/**
 * 탭에 걸 제목.
 *
 * ★ 0이면 아무것도 안 붙입니다. '(0)' 은 있으나 마나 한 소음입니다.
 * ★ 이미 붙어 있으면 갈아 끼웁니다. 겹쳐 붙지 않습니다.
 */
export function titleWithUnread(title: string, unread: number): string {
  const base = baseTitle(title);
  if (unread <= 0) return base;
  return `(${unread > 99 ? '99+' : unread}) ${base}`;
}

/**
 * 소리를 낼 것인가.
 *
 * ★ **늘어났을 때만** 냅니다.
 *   화면을 열자마자(before 를 모를 때) 울리면, 어제 온 알림 때문에
 *   아침마다 소리가 납니다. 읽어서 줄어들 때도 안 냅니다.
 */
export function shouldPing(before: number | null, after: number): boolean {
  if (before === null) return false;
  return after > before;
}
