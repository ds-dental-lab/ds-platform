// =========================================================
// 놓을 위치: src/server/domain/order-list/index.ts
//
// 주문목록이 쓰는 표시 규칙. (기능명세서 §4.3)
//
// ★ 이 파일은 Next.js 도 Supabase 도 모릅니다.
//   D-Day 계산과 치식 표기는 규칙이라 테스트로 고정할 수 있어야 합니다.
// =========================================================

import { byArchOrder } from '../tooth';
import type { OrderStatus } from '../order-status';
import type { IsoDate } from '../week';

// ---------- 상태 색 (명세서 §4.3) ----------
// ★ 상태마다 색을 주지 않습니다. **담당 섹터**가 같으면 같은 색입니다.
//   목록을 훑을 때 "지금 누구 손에 있는가"가 먼저 보여야 하기 때문입니다.

export type StatusSector = 'clinic' | 'design' | 'lab' | 'done';

export const SECTOR_COLOR: Record<StatusSector, { color: string; label: string }> = {
  clinic: { color: '#E08A1B', label: '치과' },
  design: { color: '#E0409A', label: '디자인센터' },
  lab: { color: '#1B63E8', label: '기공소' },
  done: { color: '#5C6779', label: '완료' },
};

/** 목록 필터에 나오는 상태와 그 담당 섹터. 취소는 목록 필터에 없습니다 */
export const LIST_STATUSES: { status: OrderStatus; sector: StatusSector }[] = [
  /*
    ★ 업로드중은 **치과 색**입니다. 파일을 마저 올려야 넘어가므로
      공이 치과에 있습니다 (작업지시서 §3-3).
    ★ 기공소 목록에는 안 뜹니다 — statusesForSector 가 걸러냅니다.
      배정 전 단계라 어차피 볼 일이 없습니다.
  */
  { status: 'uploading', sector: 'clinic' },
  { status: 'rescan', sector: 'clinic' },
  { status: 'received', sector: 'clinic' },
  { status: 'designing', sector: 'design' },
  { status: 'production_wait', sector: 'lab' },
  { status: 'production', sector: 'lab' },
  { status: 'shipping', sector: 'lab' },
  { status: 'completed', sector: 'done' },
];

export function sectorOfStatus(status: OrderStatus): StatusSector {
  return LIST_STATUSES.find((s) => s.status === status)?.sector ?? 'done';
}

/**
 * 그 섹터의 목록에 세울 상태들.
 *
 * ★ 기공소는 접수 · 재스캔 · 디자인을 걸러 봐야 할 이유가 없습니다.
 *   기공소가 하는 일은 '배정받은 파일을 실물로 만들어 치과로 보내기' 뿐이라,
 *   그 앞 단계는 애초에 배정 전이어서 목록에 뜨지도 않습니다.
 *   숫자가 늘 0인 아이콘은 자리만 차지하고 눈을 흐립니다.
 *
 *   치과와 디자인센터는 전 구간을 봅니다 — 자기 주문이 어디까지 갔는지
 *   알아야 하고, 디자인센터는 흐름 전체를 조율합니다.
 */
export function statusesForSector(sector: 'clinic' | 'design_center' | 'lab') {
  if (sector !== 'lab') return LIST_STATUSES;
  return LIST_STATUSES.filter((s) => s.sector === 'lab' || s.sector === 'done');
}

export function colorOfStatus(status: OrderStatus): string {
  return SECTOR_COLOR[sectorOfStatus(status)].color;
}

// ---------- 이슈 (명세서 §4.3 이슈 필터) ----------

export type IssueType = 'rescan' | 'remake' | 'repair' | 'analog';

export const ISSUE_META: Record<IssueType, { label: string; bg: string; fg: string }> = {
  rescan: { label: '재스캔', bg: '#F3E9FB', fg: '#8A4FC4' },
  remake: { label: '리메이크', bg: '#FDE7E7', fg: '#C4383A' },
  repair: { label: '리페어', bg: '#E4F6E4', fg: '#3A8A45' },
  analog: { label: '아날로그', bg: '#E8EEF8', fg: '#3D5A9E' },
};

export const ISSUE_ORDER: IssueType[] = ['rescan', 'remake', 'repair', 'analog'];

// ---------- D-Day ----------

export interface DDay {
  /** 화면에 굵게 찍는 글자 — 'D-3' · 'D-Day' · 'D+2' · '완료' */
  label: string;
  /** 남은 일수. 지났으면 음수 */
  days: number;
  /** 3일 이하로 남았는가. 빨갛게 강조합니다 */
  urgent: boolean;
}

/**
 * 요청시한까지 며칠 남았는가.
 *
 * ★ 끝난 주문은 날짜를 세지 않습니다.
 *   완료된 건이 'D+30' 으로 빨갛게 뜨면 목록이 온통 경고가 됩니다.
 */
export function computeDDay(dueDate: IsoDate, today: IsoDate, status: OrderStatus): DDay {
  if (status === 'completed' || status === 'cancelled') {
    return { label: status === 'completed' ? '완료' : '취소', days: 0, urgent: false };
  }

  const days = daysBetween(today, dueDate);

  return {
    label: days < 0 ? `D+${-days}` : days === 0 ? 'D-Day' : `D-${days}`,
    days,
    urgent: days <= 3,
  };
}

/** from 에서 to 까지 며칠. 문자열로만 계산해 시간대에 흔들리지 않습니다 */
function daysBetween(from: IsoDate, to: IsoDate): number {
  const n = (d: IsoDate) => {
    const [y, m, day] = d.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000);
  };
  return n(to) - n(from);
}

// ---------- 치식 표기 ----------

export interface ToothCell {
  tooth: number;
  isPontic: boolean;
}

/**
 * 목록의 '치식' 열. (명세서 §4.3)
 *   치식도에 놓인 순서대로 늘어놓고, 폰틱은 번호 대신 X 로 씁니다.
 *   같은 치아가 두 번 등록돼도 번호는 한 번만 적습니다.
 */
export function formatToothList(cells: ToothCell[]): string {
  const seen = new Map<number, boolean>();

  for (const cell of cells) {
    // 하나라도 폰틱이 아니면 번호로 적습니다
    seen.set(cell.tooth, (seen.get(cell.tooth) ?? true) && cell.isPontic);
  }

  return [...seen.entries()]
    .sort(([a], [b]) => byArchOrder(a, b))
    .map(([tooth, allPontic]) => (allPontic ? 'X' : String(tooth)))
    .join(', ');
}

// ---------- 기간 필터 ----------

export type RangePreset = '3개월' | '6개월' | '1년' | '전체';

export const RANGE_PRESETS: RangePreset[] = ['3개월', '6개월', '1년', '전체'];

/**
 * 프리셋이 가리키는 시작일. '전체'는 시작이 없습니다.
 * 오늘을 인자로 받아, 서버 시간대에 따라 결과가 달라지지 않게 합니다.
 */
export function rangeStart(preset: RangePreset, today: IsoDate): IsoDate | null {
  if (preset === '전체') return null;

  const [y, m, d] = today.split('-').map(Number);
  const months = preset === '3개월' ? 3 : preset === '6개월' ? 6 : 12;

  const dt = new Date(Date.UTC(y, m - 1 - months, d));
  return dt.toISOString().slice(0, 10);
}

// ---------- 아이콘 필터 (여러 개 고르기) ----------
//
// 사용자 요청 2026-08-13 — "중복으로 필터가 되게 해줘".
// 전에는 하나만 켜졌습니다. 아이콘을 누르면 앞의 것이 꺼져서,
// '제작대기 + 제작' 처럼 **지금 기공소에 가 있는 것 전부**를 한 번에
// 볼 수가 없었습니다.
//
// 주소에는 쉼표로 담습니다 — `?status=production_wait,production`.
// 같은 이름을 여러 번 붙이는 방식(`?status=a&status=b`)이 아닙니다.
// 링크를 만들 때 URLSearchParams.set 한 번으로 끝나고, 주소를 눈으로
// 읽을 수 있습니다. **값 하나짜리 옛 주소도 그대로 동작합니다** —
// HOME 카드가 `?status=received` 로 보내고 있습니다.

/**
 * 쉼표로 이어진 값을 허용 목록으로 거릅니다.
 *
 * ★ 주소는 사용자가 직접 고칠 수 있습니다. 모르는 값은 조용히 버립니다.
 * ★ 중복은 한 번만 남깁니다 — `a,a` 를 두 번 세면 개수가 어긋납니다.
 * ★ **차례는 허용 목록의 차례**입니다. 누른 순서로 두면 같은 조합인데
 *   주소가 달라져 뒤로가기·즐겨찾기가 서로 다른 것처럼 보입니다.
 */
export function parseFilterList<T extends string>(raw: string, allowed: readonly T[]): T[] {
  if (!raw) return [];

  const picked = new Set(raw.split(',').map((s) => s.trim()));

  return allowed.filter((a) => picked.has(a));
}

/** 켜져 있으면 빼고, 아니면 더합니다. 차례는 허용 목록을 따릅니다 */
export function toggleFilter<T extends string>(
  current: readonly T[],
  value: T,
  allowed: readonly T[],
): T[] {
  const next = new Set<string>(current);

  if (next.has(value)) next.delete(value);
  else next.add(value);

  return allowed.filter((a) => next.has(a));
}

/** 주소에 실을 값. 비어 있으면 빈 문자열 — 그러면 파라미터를 지웁니다 */
export function filterListToParam(list: readonly string[]): string {
  return list.join(',');
}

// ---------- 정렬 ----------

/** 명세서 §4.3 — 치식과 이슈를 뺀 나머지 열은 모두 정렬됩니다 */
export type SortColumn =
  | 'status'
  | 'due_date'
  | 'received_at'
  | 'clinic_name'
  | 'patient_label'
  | 'lab_name'
  | 'remake_count';

export const SORTABLE_COLUMNS: SortColumn[] = [
  'status',
  'due_date',
  'received_at',
  'clinic_name',
  'patient_label',
  'lab_name',
  'remake_count',
];

export function isSortable(column: string): column is SortColumn {
  return (SORTABLE_COLUMNS as string[]).includes(column);
}

// ---------- 리메이크 표기 (사용자 확정 2026-08-11, 다 안) ----------

export interface RemakeCell {
  /** 칸에 찍을 글자. 숫자만입니다 */
  text: string;
  /** 이 줄 자신이 리메이크인가 — 색으로 가릅니다 */
  isSelf: boolean;
  /** 마우스를 올렸을 때 무엇을 세는 숫자인지 */
  title: string;
}

/**
 * 목록의 '리메이크' 칸.
 *
 * ★ 숫자만 찍습니다 (사용자 결정 2026-08-12 — "1차 2차가 아닌 그냥 1,2").
 *   '2회'·'2차' 처럼 단위를 붙이면 좁은 칸에서 줄이 흔들립니다.
 *
 * ★ 그런데 두 숫자는 뜻이 다릅니다.
 *     원주문   몇 번 다시 만들었나   (remakeCount)
 *     리메이크 내가 몇 차인가        (remakeSeq)
 *   글자를 똑같이 '2' 로 찍으면 이 둘이 구별되지 않습니다. 그래서
 *   **색과 툴팁**으로 가릅니다 — 숫자만 보고 싶다는 요청은 지키되,
 *   무엇을 세는 숫자인지는 잃지 않습니다.
 *
 * ★ 2차 리메이크가 0 으로 보이면 안 됩니다.
 *   remakeCount 만 쓰면 그렇게 됩니다 — 자기가 아직 안 다시 만들어졌을
 *   뿐인데 리메이크가 아닌 줄 압니다.
 */
export function formatRemakeCell(row: {
  isRemake: boolean;
  remakeSeq: number;
  remakeCount: number;
}): RemakeCell {
  if (row.isRemake) {
    return {
      text: String(row.remakeSeq),
      isSelf: true,
      title: `이 주문은 ${row.remakeSeq}차 리메이크입니다`,
    };
  }

  return {
    text: String(row.remakeCount),
    isSelf: false,
    title:
      row.remakeCount > 0
        ? `이 주문은 ${row.remakeCount}번 다시 만들어졌습니다`
        : '다시 만든 적이 없습니다',
  };
}
