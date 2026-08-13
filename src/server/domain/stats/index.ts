// =========================================================
// 놓을 위치: src/server/domain/stats/index.ts
//
// 통계 셈. (사용자 요청 2026-08-12 — "디자이너 별로 처리한 일량 /
// 리메이크율 / 어느치과가 주문을 많이했는지")
//
// ★ 0으로 나눈 값을 0%로 적지 않습니다.
//   한 건도 안 한 사람의 리메이크율이 0% 로 뜨면, 스무 건 하고 한 건
//   다시 만든 사람보다 잘한 것처럼 보입니다. **모수가 없으면 '—' 입니다.**
//
// ★ 모수가 작으면 비율을 믿을 수 없습니다.
//   세 건 중 한 건이 33.3% 로 찍히면 숫자가 사람을 잡습니다.
//   화면이 건수를 늘 함께 보여 주고, 적은 모수에는 표를 답니다.
//
// ★ 리메이크가 곧 디자인 잘못은 아닙니다.
//   쉐이드가 안 맞았을 수도, 치과에서 다시 뜬 것일 수도 있습니다.
//   이 숫자는 '어디를 들여다볼지' 를 고르는 자리이지 평가표가 아닙니다.
//   화면에 그렇게 적어 둡니다.
// =========================================================

/** 모수가 적어 비율을 믿기 어려운 기준 */
export const SMALL_SAMPLE = 5;

/**
 * 비율(%). 모수가 없으면 null — 0% 가 아닙니다.
 */
export function ratePercent(part: number, whole: number): number | null {
  if (whole <= 0) return null;

  return Math.round((part / whole) * 1000) / 10;
}

/** '12.5%' · 모수가 없으면 '—' */
export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export function isSmallSample(whole: number): boolean {
  return whole > 0 && whole < SMALL_SAMPLE;
}

/** 디자이너 한 사람 */
export interface DesignerTally {
  userId: string;
  name: string;
  /** 디자인을 잡은 건수 */
  picked: number;
  /** 제작주문까지 넘긴 건수 */
  handed: number;
  /** 그 사람이 디자인한 건 중 나중에 리메이크가 걸린 건수 */
  remade: number;
  /** 잡아서 넘길 때까지 걸린 날 (평균). 넘긴 게 없으면 null */
  avgDays: number | null;
  /**
   * 그 사람이 맡은 건 중 **그 기간에 배송된** 것의 치과 판매가 합.
   * (사용자 결정 2026-08-13 — "완성한 금액으로 능률을 측정")
   *
   * ★ 배송을 기준으로 셉니다.
   *   디자이너가 손을 뗀 시점은 출고입니다. 완료는 치과가 눌러야 붙는데
   *   안 누르고 지나가는 일이 흔해서, 능률이 남의 손에 걸립니다.
   *   정산과도 같은 잣대입니다 (isBillable 이 배송을 봅니다).
   *
   * ★ 조정은 빼고 원래 판매가로 셉니다.
   *   깎아 준 것은 디자인센터의 결정입니다. 그것까지 담당자 능률에서
   *   빼면, 할인해 준 거래처를 맡은 사람이 손해를 봅니다.
   *
   * ★ 리메이크·리페어는 0원입니다 (is_billable = false).
   *   다시 만든 일에는 값이 안 붙습니다 — 일량(picked)에는 남고
   *   금액에는 안 남습니다. 그게 이 숫자의 뜻입니다.
   *
   * ★ 단가를 안 정한 제품이 섞였으면 unpriced 가 섭니다.
   *   0원으로 조용히 세면 그 사람 능률이 낮아 보입니다.
   */
  amount: number;
  /** 단가 미정이 섞여 amount 가 실제보다 적은가 */
  amountUnpriced: boolean;
}

/**
 * 많이 한 사람부터. 같으면 이름순.
 *
 * ★ 리메이크율로 줄 세우지 않습니다.
 *   화면을 열자마자 '리메이크 많은 사람' 이 맨 위에 오면, 이 표는
 *   일량을 보는 자리가 아니라 사람을 세우는 자리가 됩니다.
 *   비율은 칸으로 보여 주고, 차례는 일한 양으로 잡습니다.
 */
export function sortDesigners(rows: DesignerTally[]): DesignerTally[] {
  return [...rows].sort(
    (a, b) => b.handed - a.handed || b.picked - a.picked || a.name.localeCompare(b.name),
  );
}

/** 치과 한 곳 */
export interface ClinicTally {
  orgId: string;
  name: string;
  orders: number;
  remakes: number;
  repairs: number;
}

/** 많이 넣은 곳부터 */
export function sortClinics(rows: ClinicTally[]): ClinicTally[] {
  return [...rows].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));
}

/** 평균 — 잰 것이 없으면 null */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;

  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}
