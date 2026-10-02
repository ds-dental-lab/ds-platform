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

  const teeth = Array.isArray(raw.teeth)
    ? [...new Set(raw.teeth.filter((t): t is number => Number.isInteger(t) && t >= 11 && t <= 48))].sort(
        (a, b) => a - b,
      )
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
