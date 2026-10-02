// =========================================================
// 놓을 위치: src/server/domain/device-link/index.ts
//
// 치과 스캐너 PC 를 묶는 규칙 (사용자 요청 2026-10-02).
//
// ★ 여섯 자리 숫자 코드입니다. 치과 관리자가 화면에서 발급해 PC 프로그램에 적습니다.
//   10분 뒤 만료되고, 한 번 쓰면 끝입니다 — 적어 두고 돌려쓰는 열쇠가 아닙니다.
// ★ 헷갈리는 글자를 안 씁니다. 숫자만 쓰되 0 과 1 은 뺍니다 (O·I 와 섞입니다).
// ★ 기기 열쇠는 길고, **해시로만** 저장합니다 (repositories/device-link).
// =========================================================

export const LINK_CODE_LENGTH = 6;
export const LINK_CODE_TTL_MINUTES = 10;

/** 코드에 쓰는 글자 — 0·1 을 뺀 숫자 */
const CODE_ALPHABET = '23456789';

export function makeLinkCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function isLinkCode(value: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`).test(value.trim());
}

export function linkCodeExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();
}

export interface ScanMeta {
  patientName: string;
  chartNo: string;
  clinicNameInFile: string;
  caseGuid: string;
  scannedAt: string;
  teeth: number[];
  fileName: string;
  fileSize: number;
}

/** 프로그램이 보낸 값을 그대로 믿지 않습니다 — 길이와 모양만 봅니다 */
export function cleanScanMeta(raw: Partial<ScanMeta> | null | undefined): ScanMeta | null {
  if (!raw || typeof raw.fileName !== 'string' || !raw.fileName.toLowerCase().endsWith('.dxd')) {
    return null;
  }

  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';

  // ★ 치식으로 말이 되는 번호만 둡니다 — 11~48 이면서 끝자리가 1~8.
  //   '19' 나 '30' 같은 칸은 없습니다 (PC 가 보낸 값을 그대로 믿지 않습니다).
  const teeth = Array.isArray(raw.teeth)
    ? [
        ...new Set(
          raw.teeth.filter(
            (t): t is number =>
              Number.isInteger(t) && t >= 11 && t <= 48 && t % 10 >= 1 && t % 10 <= 8,
          ),
        ),
      ].sort((a, b) => a - b)
    : [];

  return {
    patientName: text(raw.patientName, 60),
    chartNo: text(raw.chartNo, 40),
    clinicNameInFile: text(raw.clinicNameInFile, 60),
    caseGuid: text(raw.caseGuid, 60),
    scannedAt: text(raw.scannedAt, 20),
    teeth,
    fileName: text(raw.fileName, 200),
    fileSize: Number.isFinite(raw.fileSize) ? Math.max(0, Math.trunc(raw.fileSize as number)) : 0,
  };
}


// ---------------------------------------------------------
// 이름 맞추기 (사용자 결정 2026-10-02 — "치과이름은 안내해줘")
// ---------------------------------------------------------

/** 띄어쓰기·대소문자를 지웁니다 — 사람이 적는 방식이 매번 다릅니다 */
function squeeze(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * 치과 간판에 흔히 붙는 꼬리를 뗍니다.
 *
 * ★ 덴플로우에는 '다서울치과', 스캐너에는 '다서울치과의원' 으로 적혀 있을 수 있습니다.
 *   꼬리 때문에 다르다고 알리면, 맞는 집에 매번 경고가 뜹니다.
 */
function withoutSuffix(value: string): string {
  return squeeze(value).replace(/(치과의원|치과병원|치과|의원|병원|dental(clinic)?|clinic)$/u, '');
}

/**
 * 파일에 적힌 치과명이 우리가 아는 치과명과 같은가.
 *
 * ★ 한쪽이 비면 **같다고 봅니다** — 모르는 것을 틀렸다고 알리지 않습니다.
 * ★ 한쪽이 다른 쪽을 품고 있으면 같다고 봅니다 ('서울치과 본점' / '서울치과').
 */
export function sameClinicName(inFile: string, ours: string): boolean {
  const a = withoutSuffix(inFile ?? '');
  const b = withoutSuffix(ours ?? '');
  if (!a || !b) return true;

  /*
    ★ 글자가 하나도 없으면 치과명이 아닙니다 — 알리지 않습니다.
      실제 내보낸 파일의 <Dentist> 칸에 '2510' 처럼 번호만 적힌 것이 있었습니다
      (2026-10-02 확인). 그것까지 '다른 치과' 라고 하면 맞는 집에 매번 띠가 뜹니다.
  */
  if (!/\p{L}/u.test(squeeze(inFile))) return true;

  return a === b || a.includes(b) || b.includes(a);
}

/**
 * 같은 환자인가 — 재스캔 주문을 찾을 때 씁니다.
 *
 * ★ 띄어쓰기만 지우고 **나머지는 그대로** 봅니다. 환자는 품는 것으로 맞추면
 *   '김민' 이 '김민수' 에 붙습니다. 남의 주문에 스캔을 붙이는 쪽이 더 위험합니다.
 */
export function samePatientName(a: string, b: string): boolean {
  const left = squeeze(a ?? '');
  return left.length > 0 && left === squeeze(b ?? '');
}
