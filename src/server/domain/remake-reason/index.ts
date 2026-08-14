// =========================================================
// 놓을 위치: src/server/domain/remake-reason/index.ts
//
// 리메이크 사유. (사용자 요청 2026-08-14 — "다시 발생하는걸 재발방지하고 싶거든")
//
// ★ 목록을 **표가 아니라 코드에 둡니다.** 제품과 반대입니다.
//   제품은 사장님이 늘리고 줄이는 것이라 표에 있습니다. 사유는 다릅니다 —
//   이건 **통계의 잣대**입니다. 항목이 조용히 바뀌면 지난달 숫자와
//   이번달 숫자가 다른 것을 세게 되고, 아무도 그걸 알아채지 못합니다.
//   바꿔야 할 때는 배포로 바꿉니다. 그 편이 기록에 남습니다.
//
// ★ **코드는 안 바뀝니다.** 화면 글은 고쳐도 `CS-01` 은 그대로 둡니다.
//   저장된 것이 코드라, 코드를 바꾸면 지난 기록이 통째로 미아가 됩니다.
//   (제품의 `code` 를 안 바꾸는 것과 같은 이유)
//
// ★ 여섯 갈래는 **책임의 갈래가 아니라 원인의 갈래**입니다.
//   '기공소' 가 있다고 해서 기공소를 탓하는 표가 아닙니다.
//   어디를 손봐야 덜 생기는지 고르려고 나눈 것입니다.
// =========================================================

export interface RemakeReason {
  /** 저장되는 값. **절대 바꾸지 않습니다** */
  code: string;
  /** 카드 위의 작은 딱지 */
  tag: string;
  /** 카드 본문 */
  label: string;
}

export interface RemakeReasonGroup {
  /** 갈래 코드 — 통계에서 묶는 열쇠 */
  key: string;
  /** 왼쪽 목록에 뜨는 이름 */
  name: string;
  reasons: RemakeReason[];
}

/** 자유 입력을 받는 자리. 여기만 글을 같이 담습니다 */
export const OTHER_CODE = 'ET-01';

/** 자유 입력 글자 수 상한 */
export const NOTE_MAX = 200;

export const REMAKE_REASON_GROUPS: RemakeReasonGroup[] = [
  {
    key: 'CS',
    name: '구강 스캔 이슈',
    reasons: [
      { code: 'CS-01', tag: '스캔오류', label: '지대치 좌표 오류, 노이즈' },
      { code: 'CS-02', tag: '스캔오류', label: '인접치 좌표 오류, 노이즈' },
      { code: 'CS-03', tag: '스캔오류', label: '교합 관계 오류' },
      { code: 'CS-04', tag: '스캔오류', label: '아치 왜곡 및 변형, 누락' },
      { code: 'CS-05', tag: '스캔오류', label: '스캔바디 오체결 & 변형 으로 인한 Path, 높낮이 변형' },
      { code: 'CS-06', tag: '데이터 누락', label: '스캔 데이터 부족 (치과 진행 요구)' },
    ],
  },
  {
    key: 'CP',
    name: '치과 프로세스 이슈',
    reasons: [
      { code: 'CP-01', tag: '지대치 형태 불량', label: '언더컷, 삽입로 미 확보' },
      { code: 'CP-02', tag: '지대치 형태 불량', label: '출혈, 타액 등으로 인한 마진 미 확보' },
      { code: 'CP-03', tag: '최소두께 불량', label: '보철물 최소두께 확보가 안된 상태로 진행' },
      { code: 'CP-04', tag: '주문 오류', label: '주문서 오 기입 및 내용 누락' },
      { code: 'CP-05', tag: '단순 변심', label: '최종보철물 시적 후 요구사항 변경' },
      { code: 'CP-06', tag: '분실', label: '최종보철물 배송 완료 후 치과 보관 부실' },
      { code: 'CP-07', tag: '재스캔 미실시', label: '구강상태 (교합 및 컨텍) 변형 후 재스캔 미실시' },
    ],
  },
  {
    key: 'CA',
    name: '환자 요인',
    reasons: [
      { code: 'CA-01', tag: '파손 및 분실', label: '장착 전 후 파절, 분실' },
      { code: 'CA-02', tag: '치과 방문 지연', label: '치과 내원 지연으로 인한 환자 구강상태 변형' },
      { code: 'CA-03', tag: '불편함 호소', label: '셋팅 후 환자 불편함 호소' },
    ],
  },
  {
    key: 'QD',
    name: '디자인 / 서비스 오류',
    reasons: [
      { code: 'QD-01', tag: '디자인', label: '해부학적 형태 부적절, 교합 및 컨텍 형태 오류' },
      { code: 'QD-02', tag: '서비스', label: '의사소통 오류 및 전달 누락' },
      { code: 'QD-03', tag: '설계 설정', label: '시멘트 공간 설정 오류, Path 설정 오류' },
      { code: 'QD-04', tag: '라이브러리 매칭오류', label: '스캔바디 및 치아 라이브러리 오매칭' },
      { code: 'QD-05', tag: '전산 오류', label: '전산 오류로 인한 주문서 누락 및 변경' },
    ],
  },
  {
    key: 'LT',
    name: '기공소',
    reasons: [
      { code: 'LT-01', tag: '가공 오류', label: '마진 치핑 및 디자인과 다른 최종보철물' },
      { code: 'LT-02', tag: '색상 오류', label: '쉐이드 불일치(밝음/어두움), 투명도 부적절' },
      { code: 'LT-03', tag: '배송 오류', label: '날짜 미확인, 배송 누락 및 오배송' },
      { code: 'LT-04', tag: '소재 불량', label: '블록 크랙, 얼룩' },
      { code: 'LT-05', tag: '밀링 장비 관리 불량', label: '켈리브레이션 및 bur 관리 주기 초과로 인한 리메이크' },
      { code: 'LT-06', tag: '후가공 불량', label: '연마 / 글레이징 , 치간 사이 분리감 표현 불량' },
      { code: 'LT-07', tag: '소결 불량', label: '소결 수축 보정값 미적용' },
      { code: 'LT-08', tag: '임플란트 오가공', label: '다른 회사 임플란트로 가공' },
    ],
  },
  {
    key: 'ET',
    name: '기타',
    reasons: [{ code: OTHER_CODE, tag: '기타', label: '기타 사유' }],
  },
];

/** 코드 하나로 빨리 찾기 위한 색인 */
const BY_CODE = new Map<string, { reason: RemakeReason; group: RemakeReasonGroup }>();

for (const group of REMAKE_REASON_GROUPS) {
  for (const reason of group.reasons) BY_CODE.set(reason.code, { reason, group });
}

export function findReason(code: string): RemakeReason | null {
  return BY_CODE.get(code)?.reason ?? null;
}

export function groupOf(code: string): RemakeReasonGroup | null {
  return BY_CODE.get(code)?.group ?? null;
}

/** 저장된 코드를 화면 글로. 목록에서 사라진 옛 코드도 뭔가는 보여 줍니다 */
export function reasonLabel(code: string): string {
  return findReason(code)?.label ?? code;
}

// ---------- 고른 것을 다듬습니다 ----------

export interface ReasonSelection {
  codes: string[];
  /** 기타를 골랐을 때만 값이 있습니다 */
  note: string | null;
}

/**
 * 화면에서 온 것을 저장할 모양으로 다듬습니다.
 *
 * ★ 모르는 코드는 **버립니다.** 목록에 없는 값이 들어오면 통계에서
 *   영원히 정체불명으로 남습니다. 막을 자리는 여기 하나입니다.
 *
 * ★ 차례를 목록 순서로 맞춥니다. 고른 차례대로 두면 같은 사유를 고른
 *   두 건이 서로 다르게 저장되고, 나중에 비교할 때 눈에 걸립니다.
 *
 * ★ 기타를 골랐는데 글이 비어 있으면 **기타를 뺍니다.**
 *   '기타' 만 있고 내용이 없는 줄은 통계에서 아무것도 안 알려 줍니다.
 */
export function normalizeSelection(codes: string[], note: string | null | undefined): ReasonSelection {
  const picked = new Set(codes.filter((c) => BY_CODE.has(c)));
  const trimmed = (note ?? '').trim().slice(0, NOTE_MAX);

  if (picked.has(OTHER_CODE) && !trimmed) picked.delete(OTHER_CODE);

  const ordered: string[] = [];
  for (const group of REMAKE_REASON_GROUPS) {
    for (const reason of group.reasons) {
      if (picked.has(reason.code)) ordered.push(reason.code);
    }
  }

  return { codes: ordered, note: ordered.includes(OTHER_CODE) ? trimmed : null };
}

// ---------- 세기 ----------

export interface ReasonCount {
  code: string;
  tag: string;
  label: string;
  groupKey: string;
  groupName: string;
  count: number;
}

export interface GroupCount {
  key: string;
  name: string;
  count: number;
  /** 전체에서 차지하는 몫(%). 모수가 없으면 null */
  share: number | null;
}

export interface ReasonTally {
  /** 사유가 하나라도 적힌 주문 수 */
  orders: number;
  /** 고른 사유의 총 개수. 한 건에 여럿을 고를 수 있어 주문 수보다 큽니다 */
  picks: number;
  groups: GroupCount[];
  reasons: ReasonCount[];
}

/**
 * 줄들을 세어 통계 모양으로.
 *
 * ★ **주문 수와 사유 수는 다릅니다.** 중복 선택이 되므로 한 건에
 *   사유가 셋일 수 있습니다. 둘을 같이 보여 주지 않으면 합계가
 *   주문 수보다 커 보여서 잘못 센 것처럼 읽힙니다.
 *
 * ★ 많은 차례로 세웁니다. 코드 순으로 두면 늘 CS 가 맨 위라
 *   '무엇이 제일 잦은가' 가 안 보입니다.
 */
export function tallyReasons(rows: { orderId: string; code: string }[]): ReasonTally {
  const orders = new Set<string>();
  const byCode = new Map<string, number>();

  for (const row of rows) {
    if (!BY_CODE.has(row.code)) continue;
    orders.add(row.orderId);
    byCode.set(row.code, (byCode.get(row.code) ?? 0) + 1);
  }

  const reasons: ReasonCount[] = [];
  const byGroup = new Map<string, number>();
  let picks = 0;

  for (const group of REMAKE_REASON_GROUPS) {
    for (const reason of group.reasons) {
      const count = byCode.get(reason.code) ?? 0;
      if (count === 0) continue;

      picks += count;
      byGroup.set(group.key, (byGroup.get(group.key) ?? 0) + count);
      reasons.push({
        code: reason.code,
        tag: reason.tag,
        label: reason.label,
        groupKey: group.key,
        groupName: group.name,
        count,
      });
    }
  }

  reasons.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const groups: GroupCount[] = REMAKE_REASON_GROUPS.map((group) => {
    const count = byGroup.get(group.key) ?? 0;
    return {
      key: group.key,
      name: group.name,
      count,
      share: picks > 0 ? Math.round((count / picks) * 1000) / 10 : null,
    };
  }).filter((g) => g.count > 0);

  groups.sort((a, b) => b.count - a.count);

  return { orders: orders.size, picks, groups, reasons };
}
