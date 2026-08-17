// =========================================================
// 놓을 위치: src/server/domain/fit-value/index.ts
//
// 내면값 — 치과마다 다른 CAD 설계 수치. (사용자 요청 2026-08-17)
//
// "치과마다 원하는 수치값이 다르기 때문에 작업시 수시로 변하는
//  내면값을 확인해야 하거든"
//
// 보철이 치아에 얼마나 헐겁게(시멘트 갭) · 옆니와 얼마나 꽉(컨택)
// 앉을지를 치과 원장의 취향대로 적어 두는 표입니다. 디자이너는
// 주문을 열 때마다 이 값을 보고 CAD 에 넣습니다.
//
// ★ 필드 목록이 **여기에** 있습니다.
//   관리탭 표 · 수정 창 · 주문상세 카드 · 변경 이력 넷이 같은 필드를
//   그립니다. 한 곳에서 필드를 더하면 넷이 함께 늘어야 하는데,
//   목록이 화면마다 있으면 하나는 반드시 빠뜨립니다.
//
// ★ 변경을 **말로 만들어 두는 것**도 여기입니다 (diffFitValues).
//   "값이 바뀌면 웹페이지에서 알려야" 하는데, 알림의 단위는 숫자가
//   아니라 '자연치 0.02 → 0.04' 라는 문장입니다. 저장할 때 이 문장을
//   굳혀 두면, 나중에 필드가 늘거나 이름이 바뀌어도 지난 이력이
//   그대로 읽힙니다.
// =========================================================

/** 이 날수 안에 바뀐 값은 '최근 변경' 으로 도드라집니다 */
export const RECENT_DAYS = 7;

/** 수치의 한계 (mm). CAD 내면 수치가 이 밖이면 입력 실수입니다 */
export const FIT_LIMIT = 5;

export const IMPLANT_MAX = 120;
export const NOTE_MAX = 500;

export type FitNumberKey =
  | 'naturalTooth'
  | 'cnc'
  | 'inlay'
  | 'pla'
  | 'pmma'
  | 'contactAdj'
  | 'contactSingle';

export interface FitNumberField {
  key: FitNumberKey;
  label: string;
  /** 화면에서 묶어 그리는 단위 */
  group: 'material' | 'contact';
}

// 시안(스크린샷) 순서 그대로입니다
export const FIT_NUMBER_FIELDS: FitNumberField[] = [
  { key: 'naturalTooth', label: '자연치', group: 'material' },
  { key: 'cnc', label: 'CNC', group: 'material' },
  { key: 'inlay', label: 'Inlay', group: 'material' },
  { key: 'pla', label: 'PLA', group: 'material' },
  { key: 'pmma', label: 'PMMA', group: 'material' },
  { key: 'contactAdj', label: '맞결', group: 'contact' },
  { key: 'contactSingle', label: '단일', group: 'contact' },
];

export interface FitValues {
  naturalTooth: number | null;
  cnc: number | null;
  inlay: number | null;
  pla: number | null;
  pmma: number | null;
  contactAdj: number | null;
  contactSingle: number | null;

  hook: boolean;
  implantNote: string | null;
  note: string | null;
}

export const EMPTY_FIT_VALUES: FitValues = {
  naturalTooth: null,
  cnc: null,
  inlay: null,
  pla: null,
  pmma: null,
  contactAdj: null,
  contactSingle: null,
  hook: false,
  implantNote: null,
  note: null,
};

/**
 * 등록된 치과인가 — **줄이 있는가가 아니라 값이 있는가**입니다.
 *
 * ★ 관리자가 값을 다 비우고 저장하면 줄은 남지만 등록은 아닙니다.
 *   줄 유무로 가르면 '한 번 열어 본 치과' 가 전부 등록으로 보입니다.
 */
export function isRegistered(values: FitValues | null): boolean {
  if (!values) return false;

  return (
    FIT_NUMBER_FIELDS.some((f) => values[f.key] !== null) ||
    values.hook ||
    Boolean(values.implantNote?.trim()) ||
    Boolean(values.note?.trim())
  );
}

/**
 * 입력칸의 글자를 수로 바꿉니다. 빈 칸은 null (= 안 정함) 입니다.
 *
 * ★ 잘못 친 글자는 NaN 으로 남겨 checkFitValues 가 **어느 칸인지
 *   이름을 붙여** 알리게 합니다. 여기서 0 으로 눙치면 '0.04' 를
 *   치려다 '0.0.4' 를 친 사람이 0 을 저장하고 아무도 모릅니다.
 */
export function readFit(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  return Number(trimmed);
}

/** 저장을 막을 만한 것. 없으면 null */
export function checkFitValues(values: FitValues): string | null {
  for (const field of FIT_NUMBER_FIELDS) {
    const v = values[field.key];
    if (v === null) continue;

    if (!Number.isFinite(v)) return `${field.label} 값이 숫자가 아닙니다`;

    if (Math.abs(v) > FIT_LIMIT) {
      return `${field.label} 값이 너무 큽니다 (±${FIT_LIMIT} 안이어야 합니다)`;
    }

    // 0.001 자리까지만 받습니다 — CAD 가 그 아래를 안 씁니다
    if (Math.abs(Math.round(v * 1000) - v * 1000) > 1e-6) {
      return `${field.label} 값은 소수점 셋째 자리까지만 됩니다`;
    }
  }

  if ((values.implantNote ?? '').length > IMPLANT_MAX) {
    return `임플란트 정보는 ${IMPLANT_MAX}자까지입니다`;
  }
  if ((values.note ?? '').length > NOTE_MAX) {
    return `비고는 ${NOTE_MAX}자까지입니다`;
  }

  return null;
}

/**
 * 수치를 화면에 찍을 글자로. 없으면 '-'.
 *
 * 시안이 두 자리(0.04 · -0.05)라 **최소 두 자리**를 지키되,
 * 0.015 같은 셋째 자리는 그대로 보여 줍니다.
 */
export function formatFit(value: number | null): string {
  if (value === null) return '-';

  let s = value.toFixed(3);
  // 소수 셋째 자리가 0 이면 지웁니다 (두 자리는 남깁니다)
  if (s.endsWith('0')) s = s.slice(0, -1);

  return s;
}

// ---------- 무엇이 바뀌었나 ----------

export interface FitChange {
  label: string;
  from: string;
  to: string;
}

/** 이력에 긴 비고가 통째로 실리지 않게 자릅니다 */
function clip(value: string | null): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return '-';

  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}

/**
 * 저장 전후를 비교해 '자연치 0.02 → 0.04' 목록을 만듭니다.
 * 바뀐 것이 없으면 빈 목록 — 그때는 이력도 안 남깁니다.
 */
export function diffFitValues(before: FitValues | null, after: FitValues): FitChange[] {
  const base = before ?? EMPTY_FIT_VALUES;
  const changes: FitChange[] = [];

  for (const field of FIT_NUMBER_FIELDS) {
    if (base[field.key] !== after[field.key]) {
      changes.push({
        label: field.label,
        from: formatFit(base[field.key]),
        to: formatFit(after[field.key]),
      });
    }
  }

  if (base.hook !== after.hook) {
    changes.push({
      label: 'Hook',
      from: base.hook ? '있음' : '미사용',
      to: after.hook ? '있음' : '미사용',
    });
  }

  if (clip(base.implantNote) !== clip(after.implantNote)) {
    changes.push({ label: '임플란트', from: clip(base.implantNote), to: clip(after.implantNote) });
  }

  if (clip(base.note) !== clip(after.note)) {
    changes.push({ label: '비고', from: clip(base.note), to: clip(after.note) });
  }

  return changes;
}

/**
 * 이 변경이 아직 '최근' 인가. 주문상세의 치과명에 점을 찍는 기준입니다.
 *
 * ★ 알림을 따로 쏘지 않고 **이 판정 하나**로 알립니다.
 *   디자이너는 주문을 열 때마다 치과명을 봅니다 — 값이 갓 바뀐
 *   치과면 거기에 점이 붙고, 카드를 열면 무엇이 바뀌었는지 나옵니다.
 *   종을 울리면 지나가고 없어지지만, 점은 볼 때까지 남습니다.
 */
export function isRecentChange(changedAt: string | null, today: string): boolean {
  if (!changedAt) return false;

  const changed = Date.UTC(
    Number(changedAt.slice(0, 4)),
    Number(changedAt.slice(5, 7)) - 1,
    Number(changedAt.slice(8, 10)),
  );
  const now = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );

  return (now - changed) / 86_400_000 < RECENT_DAYS;
}
