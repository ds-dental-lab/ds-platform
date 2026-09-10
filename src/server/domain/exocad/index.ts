// =========================================================
// 놓을 위치: src/server/domain/exocad/index.ts
//
// exocad 로 보내기 — 주문을 PC 런처가 먹을 모양으로 바꿉니다. (2026-09-09)
// 설계서: Desktop/exocad-연동-설계서.md (v2 · 런처 방식)
//
// ★ 흐름: 센터 주문 상세의 버튼 → `denflow://exocad/<주문>?t=<토큰>` →
//   PC 의 런처가 뜸 → 이 페이로드를 받아 exocad 주문서(.dentalProject)를
//   조립하고 스캔을 내려받아 CAD-Data 에 놓음. 상주 프로세스 없음
//   (사용자 결정 2026-09-09 — "버튼 누를 때 매크로처럼").
//
// ★ 여기는 순수 함수뿐입니다. DB·서명·HTTP 는 server/exocad 와 API 가 합니다.
//   런처가 기대하는 JSON 모양이 곧 계약이라 테스트로 잠급니다.
// =========================================================

/** exocad 쪽 네 가지 — 설계서 §4-1 */
export type ExocadType = 'crown' | 'implant' | 'inlay' | 'pontic';

export interface ExocadTooth {
  number: number;
  type: ExocadType;
}

export interface ExocadFile {
  /** 업로드 때 붙은 타임스탬프 접두어를 뗀 원래 이름 */
  name: string;
  url: string;
  /** 바이트. 런처가 진행률을 보여 주는 데 씁니다 */
  size: number | null;
}

export interface ExocadPayload {
  orderId: string;
  orderNo: string;
  patientName: string;
  /** yyyy-mm-dd — exocad 폴더 이름의 앞부분 */
  orderDate: string;
  teeth: ExocadTooth[];
  bridges: number[][];
  files: ExocadFile[];
}

/**
 * Denflow 종류 → exocad 종류.
 *
 * ★ 폰틱이 먼저입니다. 폰틱은 크라운 자리에 is_pontic 으로 표시되므로
 *   type_code 만 보면 crown 으로 새어 나갑니다.
 * ★ 모르는 코드는 crown 으로 눕히지 않고 null — 런처가 "이 치아는 모른다"
 *   고 사람에게 보여 주는 편이 잘못 만든 주문서보다 낫습니다.
 */
export function exocadType(typeCode: string, isPontic: boolean): ExocadType | null {
  if (isPontic) return 'pontic';
  if (typeCode === 'crown') return 'crown';
  if (typeCode === 'implant') return 'implant';
  if (typeCode === 'inlay') return 'inlay';
  return null;
}

/**
 * 업로드 파일명의 타임스탬프 접두어를 뗍니다.
 *   '1788961097003_2026-08-21_홍길동-upperjaw.ply' → '2026-08-21_홍길동-upperjaw.ply'
 *
 * ★ 숫자 13자리(밀리초) + '_' 만 뗍니다. 사람이 붙인 앞 숫자는 건드리지 않습니다.
 */
export function stripUploadPrefix(fileName: string): string {
  return fileName.replace(/^\d{13}_/, '');
}

/**
 * 스캔 파일만 exocad 로 갑니다 — 사진·설계 파일·기타는 아닙니다.
 * ★ 다 올라온 상태값은 'uploaded' 입니다 (file_upload_status enum: pending·uploaded·failed).
 *   처음에 'done' 으로 적어 첫 실전(2026-09-10)에서 파일 0개가 갔습니다.
 */
export function isExocadScanFile(file: { kind: string; uploadStatus: string }): boolean {
  return file.kind === 'scan' && file.uploadStatus === 'uploaded';
}

export interface ExocadSourceItem {
  id: string;
  toothNumber: number;
  typeCode: string;
  isPontic: boolean;
}

export interface ExocadSourceBridge {
  /** order_items.id 들 */
  memberItemIds: string[];
}

/**
 * 페이로드 조립. 같은 치아가 두 줄(slot 1·2)이면 첫 줄만 갑니다 —
 * exocad 주문서는 치아마다 한 줄입니다.
 *
 * @returns unknownTypes — exocad 종류로 못 옮긴 type_code 들. 비면 깨끗합니다.
 */
export function buildExocadPayload(input: {
  orderId: string;
  orderNo: string;
  patientName: string;
  orderDate: string;
  items: ExocadSourceItem[];
  bridges: ExocadSourceBridge[];
  files: { name: string; url: string; size: number | null }[];
}): { payload: ExocadPayload; unknownTypes: string[] } {
  const teeth: ExocadTooth[] = [];
  const seen = new Set<number>();
  const unknown = new Set<string>();
  const numberOfItem = new Map<string, number>();

  for (const it of input.items) {
    numberOfItem.set(it.id, it.toothNumber);
    if (seen.has(it.toothNumber)) continue;
    const type = exocadType(it.typeCode, it.isPontic);
    if (!type) {
      unknown.add(it.typeCode);
      continue;
    }
    seen.add(it.toothNumber);
    teeth.push({ number: it.toothNumber, type });
  }
  teeth.sort((a, b) => a.number - b.number);

  const bridges = input.bridges
    .map((b) =>
      Array.from(
        new Set(
          b.memberItemIds
            .map((id) => numberOfItem.get(id))
            .filter((n): n is number => typeof n === 'number'),
        ),
      ).sort((a, b) => a - b),
    )
    .filter((b) => b.length >= 2);

  const files: ExocadFile[] = input.files.map((f) => ({
    name: stripUploadPrefix(f.name),
    url: f.url,
    size: f.size,
  }));

  return {
    payload: {
      orderId: input.orderId,
      orderNo: input.orderNo,
      patientName: input.patientName,
      orderDate: input.orderDate,
      teeth,
      bridges,
      files,
    },
    unknownTypes: Array.from(unknown),
  };
}

// ---------- 일회용 토큰 (서명은 server/exocad/token 이) ----------

/** 버튼이 만든 토큰이 사는 시간. 런처가 뜨고 받아 가기에 넉넉하고, 흘러도 곧 죽습니다 */
export const EXOCAD_TOKEN_TTL_SECONDS = 10 * 60;

/** 서명할 글. 주문 id 와 만료를 묶어야 다른 주문에 못 씁니다 */
export function exocadTokenMessage(orderId: string, expiresAt: number): string {
  return `exocad:${orderId}:${expiresAt}`;
}

/** 런처가 여는 주소 — 프로토콜 이름이 곧 레지스트리 등록 이름입니다 */
export function exocadLaunchUrl(orderId: string, token: string): string {
  return `denflow://exocad/${orderId}?t=${encodeURIComponent(token)}`;
}

export type ExocadResultStatus = 'done' | 'failed';

export function isExocadResultStatus(v: unknown): v is ExocadResultStatus {
  return v === 'done' || v === 'failed';
}
