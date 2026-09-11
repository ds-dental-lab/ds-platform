// =========================================================
// 놓을 위치: src/server/domain/privacy/index.ts
//
// 개인정보 처리방침의 **내용**. (사용자 결정 2026-08-12)
//
// ★ 문구를 화면에 흩어 두지 않습니다.
//   처리방침은 "우리가 실제로 무엇을 하는가" 를 적는 문서입니다. 그
//   내용이 JSX 사이에 섞여 있으면 시스템이 바뀔 때 아무도 못 찾습니다.
//   여기에 데이터로 두고, 화면은 그리기만 합니다.
//
// ★ 숫자를 여기 안 씁니다.
//   보관기간은 retention_settings 에서 그대로 받아 씁니다. 문서에 730을
//   적어 두고 표를 365로 바꾸면, 그 순간 처리방침이 **거짓말**이 됩니다.
//   실제와 어긋나는 것이 양식이 틀린 것보다 훨씬 위험합니다.
//
// ★ 저는 변호사가 아닙니다.
//   여기 적힌 것은 **우리 시스템이 하는 일을 그대로 옮긴 초안**입니다.
//   법률 검토 전에는 시행일이 없고, 화면이 '초안' 이라고 밝힙니다.
// =========================================================

import { RETENTION_META, type RetentionTarget } from '@/server/domain/retention';
import { formatDays } from '@/server/domain/retention';

/** 화면이 받는 값 — DB 함수 public_privacy_policy 가 주는 그대로 */
export interface PolicyFacts {
  orgName: string | null;
  bizNo: string | null;
  address: string | null;
  tel: string | null;
  officerName: string | null;
  officerDept: string | null;
  officerTel: string | null;
  officerEmail: string | null;
  effectiveOn: string | null;
  keepDays: Partial<Record<RetentionTarget, number>> | null;
  labs: { name: string }[] | null;
}

/**
 * 아직 공개할 수 없는 상태인가.
 *
 * ★ 시행일이 없으면 초안입니다.
 *   날짜를 넣는 행위가 곧 "검토를 마쳤다" 는 뜻입니다.
 */
export function isDraft(facts: PolicyFacts): boolean {
  return !facts.effectiveOn;
}

/** 채워야 하는데 빈 곳 — 관리 화면이 이걸로 잔소리합니다 */
export function missingFields(facts: PolicyFacts): string[] {
  const out: string[] = [];

  if (!facts.officerName?.trim()) out.push('개인정보 보호책임자');
  if (!facts.officerTel?.trim() && !facts.officerEmail?.trim()) out.push('책임자 연락처');
  if (!facts.bizNo?.trim()) out.push('사업자등록번호');
  if (!facts.address?.trim()) out.push('주소');
  if (!facts.keepDays || Object.keys(facts.keepDays).length === 0) out.push('보관기간');
  if (!facts.effectiveOn) out.push('시행일');

  return out;
}

// ---------- 보관기간 표 ----------

export interface KeepRow {
  what: string;
  from: string;
  period: string;
}

/**
 * 처리방침에 실을 보관기간 표.
 *
 * ★ 안 정한 항목은 '해당 없음' 이 아니라 **빠집니다.**
 *   안 정했다는 것은 안 지운다는 뜻인데, 그걸 표에 적으면
 *   "영구 보관" 이라고 공표하는 셈이 됩니다.
 */
export function keepRows(facts: PolicyFacts): KeepRow[] {
  const keep = facts.keepDays ?? {};

  return (Object.keys(RETENTION_META) as RetentionTarget[])
    .filter((target) => typeof keep[target] === 'number')
    .map((target) => ({
      what: RETENTION_META[target].label,
      from: RETENTION_META[target].from,
      period: formatDays(keep[target] as number),
    }));
}

// ---------- 법정 보존기간 ----------

/**
 * 다른 법이 더 오래 갖고 있으라고 정한 것.
 *
 * ★ 위 보관기간보다 **이쪽이 우선**입니다.
 *   "1년 뒤 파기" 라고 써 놓고 법이 2년을 요구하면 그 법을 어깁니다.
 */
export const LEGAL_KEEP: { what: string; period: string; law: string }[] = [
  { what: '치과기공물제작의뢰서', period: '2년', law: '의료기사 등에 관한 법률' },
  { what: '계약 또는 청약철회, 대금결제, 재화 등의 공급 기록', period: '5년', law: '전자상거래법' },
  { what: '소비자 불만 또는 분쟁처리에 관한 기록', period: '3년', law: '전자상거래법' },
  { what: '개인정보 접속기록', period: '1년 이상', law: '개인정보 보호법 및 고시' },
];

// ---------- 처리 목적과 항목 ----------

export interface PurposeRow {
  purpose: string;
  required: string;
  optional: string;
}

/**
 * ★ 이 표가 이 문서에서 제일 중요합니다.
 *   실제로 받는 것만 적습니다. 유사 업체 문구를 옮기면 안 받는 것까지
 *   받는다고 공표하게 됩니다 (AI 학습·계좌번호·면허번호 등).
 */
export const PURPOSES: PurposeRow[] = [
  {
    purpose: '회원 가입 및 관리',
    // ★ 담당자 휴대전화 — 가입 때 필수로 받음 (2026-09-11, 가입 알림톡·알림톡 번호)
    required: '상호, 대표자명, 사업자등록번호, 주소, 전화번호, 담당자 이름, 담당자 휴대전화번호, 이메일',
    optional: '팩스번호, 세금계산서 이메일',
  },
  {
    purpose: '보철 제작주문의 접수와 제작',
    /* ★ 쉐이드 사진은 얼굴 일부(코까지)가 찍힙니다 — 반드시 적습니다 (2026-09-08) */
    required: '환자 이름, 치식(치아 번호), 보철 종류·재료·쉐이드, 구강 스캔 파일, 쉐이드 사진(치아와 얼굴 일부)',
    optional: '환자 차트번호, 생년월일, 임플란트 제조사·규격, 주문 메모, 주문 대화 내용과 첨부 파일',
  },
  {
    purpose: '청구서 발송 및 정산',
    required: '상호, 사업자등록번호, 청구서 수신 이메일 또는 팩스번호',
    optional: '',
  },
  {
    /* ★ 홈페이지 수가표 문의 (2026-09-04 부터 받음). 비회원도 남깁니다 */
    purpose: '수가표 문의 응대',
    required: '치과명, 연락처, 이메일',
    optional: '구강스캐너 보유 여부, 현재 거래 기공에 대한 불만족점',
  },
  {
    /* ★ 알림톡·푸시 (2026-09-08) — 번호는 사람마다, 받을지 말지는 본인이 정합니다 */
    purpose: '주문·정산 알림 발송 (카카오톡 알림톡, 앱 푸시)',
    required: '휴대전화번호, 알림 수신 설정',
    optional: '앱 푸시 기기 식별 토큰',
  },
];

// ---------- 처리위탁 ----------

export interface ProcessorRow {
  name: string;
  work: string;
  /** 국외 사업자면 나라. 없으면 국내 처리 */
  abroad: string | null;
}

/**
 * 개인정보를 대신 다루는 곳 — **실제로 쓰는 것만** (2026-09-08).
 *
 * ★ 보철 제작은 회사가 직접 합니다. 외주 기공소가 없으므로 여기 없습니다
 *   (사용자 결정 2026-09-08). 생기면 그때 DB 가 아니라 이 표에 적습니다.
 * ★ 국외 사업자(Resend·Google·Apple)는 국외 이전 조항에 같이 실립니다.
 */
export const PROCESSORS: ProcessorRow[] = [
  { name: 'Supabase', work: '데이터베이스와 파일 저장소 운영 (서울 리전)', abroad: null },
  { name: 'Vercel', work: '서비스 서버 운영 (서울 리전)', abroad: null },
  { name: 'Resend', work: '가입 안내·청구서 안내 등 전자우편 발송', abroad: '미국' },
  { name: '알리고 · 카카오', work: '카카오톡 알림톡과 대체 문자 발송 (휴대전화번호, 상호, 주문번호, 환자 이름)', abroad: null },
  { name: 'Google · Apple', work: '앱 푸시 알림 전달 (기기 식별 토큰. 알림 내용에 환자 이름은 담지 않습니다)', abroad: '미국' },
];

/**
 * 문의·알림 기록의 고정 보유기간 — 코드가 지웁니다 (repositories/retention-job).
 * ★ 30일 — "오래 남길 필요 없다, 창고만 차지한다" (사용자 결정 2026-09-08).
 *   발송 분쟁은 한 달 안에 나옵니다.
 */
export const FIXED_KEEP: KeepRow[] = [
  { what: '수가표 문의', from: '처리를 마친 날', period: '30일' },
  { what: '알림 발송 기록', from: '보낸 날', period: '30일' },
];

/** 받지 않는 것 — 적어 두면 오해가 줄어듭니다 */
export const NOT_COLLECTED = [
  '주민등록번호 등 고유식별정보',
  '계좌번호·신용카드번호 등 결제정보',
  '의료인 면허번호',
  '성별',
];

// ---------- 안전성 확보조치 ----------

/**
 * ★ 실제로 하고 있는 것만 적습니다.
 *   "분기 1회 자체 감사" 처럼 안 하는 것을 적으면, 사고가 났을 때
 *   지키지 않은 약속이 됩니다.
 */
export const SAFEGUARDS: { title: string; body: string }[] = [
  {
    title: '접근 권한의 최소화',
    body:
      '데이터베이스 자체에 접근 규칙(Row Level Security)을 걸어, 권한이 없으면 ' +
      '화면이 아니라 데이터가 오지 않습니다. 다른 치과의 주문은 서로 보이지 않습니다.',
  },
  {
    title: '비밀번호의 암호화',
    body: '비밀번호는 복원할 수 없는 형태로 저장되며, 회사도 원문을 알지 못합니다.',
  },
  {
    title: '파일의 비공개 보관',
    body:
      '구강 스캔·디자인 파일은 비공개 저장소에 보관합니다. 내려받을 때마다 권한을 ' +
      '확인하고 짧은 시간만 유효한 주소를 만들어 제공합니다.',
  },
  {
    title: '접속기록의 보관과 점검',
    body:
      '환자 개인정보를 열람·내려받은 기록을 남깁니다. 기록에는 누가·언제·무엇을 ' +
      '보았는지만 남기며 환자 이름이나 조회 내용은 담지 않습니다.',
  },
  {
    title: '파기 절차',
    body:
      /* ★ 2026-09-07 부터 매일 새벽 자동 (사용자 결정). 주문 기록은 파기 대상이 아닙니다 */
      '보관기간이 지난 정보는 매일 새벽 자동으로 파기하며, ' +
      '저장소의 파일까지 함께 삭제합니다. 관리자가 직접 파기할 수도 있습니다. ' +
      '무엇을 몇 건 파기했는지 기록으로 남기며, 주문 기록 자체는 파기 대상이 아닙니다.',
  },
  {
    /* ★ 분석·광고 도구가 없는 것을 확인하고 적습니다 (2026-09-08) */
    title: '쿠키의 사용',
    body:
      '로그인 상태를 유지하기 위한 세션 쿠키만 사용하며, 광고·분석 목적의 쿠키나 ' +
      '추적 도구는 쓰지 않습니다. 브라우저에서 쿠키를 거부하면 로그인이 유지되지 않습니다.',
  },
];

// ---------- 권익침해 구제 ----------

export const HELP_DESKS = [
  { name: '개인정보분쟁조정위원회', tel: '1833-6972', site: 'www.kopico.go.kr' },
  { name: '개인정보침해신고센터', tel: '118', site: 'privacy.kisa.or.kr' },
  { name: '대검찰청', tel: '1301', site: 'www.spo.go.kr' },
  { name: '경찰청', tel: '182', site: 'ecrm.cyber.go.kr' },
];

/** 화면 목차 */
export const SECTIONS = [
  '제1조 (총칙)',
  '제2조 (개인정보의 처리 목적과 항목)',
  '제3조 (개인정보의 처리 및 보유기간)',
  '제4조 (개인정보의 제3자 제공 및 처리위탁)',
  '제4조의2 (개인정보의 국외 이전)',
  '제5조 (정보주체의 권리·의무 및 행사방법)',
  '제6조 (개인정보의 파기)',
  '제7조 (개인정보의 안전성 확보조치)',
  '제8조 (개인정보 보호책임자)',
  '제9조 (권익침해 구제방법)',
  '제10조 (처리방침의 변경)',
] as const;
