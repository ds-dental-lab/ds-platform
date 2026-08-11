// =========================================================
// 놓을 위치: src/lib/format/pickup.ts
//
// 수거요청 표시용 라벨과 화면이 쓰는 모양.
//
// ★ 왜 repositories 가 아니라 여기 있는가.
//   이 값들은 클라이언트 컴포넌트(PickupCard)가 씁니다.
//   repositories 는 next/headers 를 쓰는 서버 전용 모듈이라,
//   거기서 상수를 가져오면 서버 코드가 브라우저 번들로 끌려옵니다.
//   화면이 쓰는 것은 화면 쪽에 둡니다.
// =========================================================

export interface PickupRequestRow {
  id: string;
  kind: string;
  status: string;
  memo: string | null;
  created_at: string;
  order_id: string | null;
}

export const PICKUP_KIND_LABEL: Record<string, string> = {
  prosthesis: '보철물',
  model: '모델',
  impression: '인상체',
};

export const PICKUP_STATUS_LABEL: Record<string, string> = {
  open: '수거대기',
  assigned: '접수함',
  done: '수거완료',
  cancelled: '취소',
};
