// =========================================================
// 놓을 위치: src/server/domain/rescan/index.ts
//
// 스캔 재등록 때 무엇을 치우고, 접수로 돌려도 되는지 정합니다.
//
// ★ 치우는 것은 스캔뿐입니다 (2026-11-25).
//   화면이 '디자인 파일이 아닌 것 전부' 를 치울 목록으로 보내서
//   쉐이드 사진과 대화 첨부까지 같이 사라졌습니다 (운영 기록 2건).
//   재스캔은 스캔만 다시 받는 일입니다. 화면이 무엇을 보내든
//   여기서 스캔만 남깁니다.
//
// ★ 올렸다는 숫자를 믿지 않고 표에 있는 파일을 봅니다.
//   화면이 "3개 올렸다" 고 해도 표에 없으면 옛 스캔을 치운 순간
//   볼 것이 하나도 없는 주문이 접수로 돌아갑니다.
// =========================================================

export interface LivingFile {
  id: string;
  kind: string;
  /** 저장소에 다 올라온 파일인가 */
  uploaded: boolean;
}

export type ResubmitPlan =
  | { ok: true; remove: string[]; kept: number }
  | { ok: false; error: string };

export function planResubmit(
  living: LivingFile[],
  replaceFileIds: string[],
  reuse: boolean,
): ResubmitPlan {
  const scans = living.filter((f) => f.kind === 'scan');

  // 이전 스캔을 그대로 쓰면 아무것도 치우지 않습니다
  const asked = new Set(reuse ? [] : replaceFileIds);
  const remove = scans.filter((f) => asked.has(f.id)).map((f) => f.id);
  const kept = scans.filter((f) => !asked.has(f.id) && f.uploaded).length;

  if (kept === 0) {
    return {
      ok: false,
      error: reuse
        ? '다시 쓸 이전 스캔이 없습니다. 새로 올려 주세요'
        : '새로 올린 스캔 파일이 보이지 않습니다. 다시 올려 주세요',
    };
  }

  return { ok: true, remove, kept };
}
