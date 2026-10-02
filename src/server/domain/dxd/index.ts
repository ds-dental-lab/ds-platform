// =========================================================
// 놓을 위치: src/server/domain/dxd/index.ts
//
// dxd 안의 DentalCase.xml 읽기 — **규칙만** (사용자 요청 2026-10-02).
//
// ★ 치과 PC 올리미(파이썬 dxd_case.py)와 **같은 규칙**입니다. 치과가 손으로
//   올릴 때는 그 프로그램이 없으니, 브라우저가 같은 일을 해야 합니다.
//   자동으로 올라오든 손으로 올리든 주문서가 똑같이 채워져야 합니다.
//
// ★ 여기엔 zip 을 푸는 코드가 없습니다. 글자만 다룹니다 — 그래야 시험할 수
//   있습니다. 파일을 여는 쪽은 lib/dxd-read.ts 입니다.
//
// ★★ **생년월일은 안 읽습니다** (사용자 결정 2026-10-02). 파일에는 있지만
//   덴플로우가 쓸 일이 없습니다. 안 받는 것이 가장 확실한 보호입니다.
// =========================================================

export interface DxdCase {
  patientName: string;
  chartNo: string;
  clinicNameInFile: string;
  caseGuid: string;
  /** 'YYYY-MM-DD HH:MM' (한국 시각) */
  scannedAt: string;
  teeth: number[];
}

export const EMPTY_CASE: DxdCase = {
  patientName: '',
  chartNo: '',
  clinicNameInFile: '',
  caseGuid: '',
  scannedAt: '',
  teeth: [],
};

function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(xml);
  return (m?.[1] ?? '').trim();
}

/** '김' + '영애B' → '김영애B'. 영문은 'JULIA IRSALINA…' 로 띄어 씁니다 */
function joinName(last: string, first: string): string {
  if (!last && !first) return '';
  return /[가-힣]/.test(last + first) ? `${last}${first}`.trim() : `${first} ${last}`.trim();
}

/** '다서울치과, 다서울치과' 처럼 두 번 적힌 것을 한 번으로 */
function dedupe(name: string): string {
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 2 && parts[0] === parts[1]) return parts[0];
  return name.trim();
}

/**
 * 파일 이름에서 치식 읽기 — '김예림 #11,21 최' → [11, 21].
 *
 * ★ **'#' 이 있을 때만** 봅니다. 그냥 두 자리 숫자를 주우면 날짜와 차트번호가
 *   치식으로 둔갑합니다 ('2026-10-01', '2604040_DI_…'). 실파일로 확인했습니다.
 * ★ 치식으로 말이 되는 번호(11~48, 끝자리 1~8)만 남깁니다.
 */
export function teethFromName(name: string): number[] {
  const out = new Set<number>();

  for (const chunk of name.match(/#[\d,\s-]+/g) ?? []) {
    for (const raw of chunk.match(/\d{2}/g) ?? []) {
      const n = Number(raw);
      if (n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8) out.add(n);
    }
  }

  return [...out].sort((a, b) => a - b);
}

/**
 * 스캔 시각.
 *
 * ★★ xml 의 시각은 **UTC** 입니다. 파일 이름이 '…11-34-58' 인 스캔의 xml 이
 *   hour="2" 였습니다 (2026-10-02 실파일 확인). 그대로 쓰면 진료실 시계와
 *   아홉 시간 어긋납니다.
 */
function scannedAt(xml: string): string {
  const m = /<DateTime\s+day="(\d+)"\s+month="(\d+)"\s+year="(\d+)"(?:\s+hour="(\d+)")?(?:\s+minute="(\d+)")?/.exec(
    xml,
  );
  if (!m) return '';

  const [, d, mo, y, h, mi] = m;
  const at = new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0)) +
      9 * 60 * 60 * 1000,
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} ` +
    `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`
  );
}

/**
 * DentalCase.xml 글자 → 케이스.
 *
 * `fileName` 은 치식을 못 찾았을 때만 씁니다 (파일 이름에 적는 치과가 있습니다).
 */
export function readDentalCase(xml: string, fileName = ''): DxdCase {
  if (!xml) return { ...EMPTY_CASE, teeth: teethFromName(fileName) };

  const patient =
    joinName(tag(xml, 'LastName'), tag(xml, 'FirstName')) ||
    tag(xml, 'FullName').replace(/,/g, ' ').trim();

  const dentist = /<Dentist>([\s\S]*?)<\/Dentist>/.exec(xml)?.[1] ?? '';

  const inXml = [...xml.matchAll(/<ToothNumber>(\d{2})<\/ToothNumber>/g)].map((m) => Number(m[1]));
  const teeth = inXml.length > 0 ? [...new Set(inXml)].sort((a, b) => a - b) : teethFromName(fileName);

  return {
    patientName: patient,
    chartNo: tag(xml, 'PatientID'),
    clinicNameInFile: dedupe(tag(dentist, 'Name')),
    caseGuid: tag(xml, 'CaseGUID'),
    scannedAt: scannedAt(xml),
    teeth,
  };
}
