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

/**
 * 자동 출력 런처가 여는 주소 (2026-10-06).
 *
 * ★ 프로토콜을 새로 만들지 않습니다. `denflow:` 는 이미 등록돼 있고,
 *   레지스트리 등록은 치과·기공소 PC 마다 한 번씩 해야 하는 일입니다.
 *   같은 프로토콜의 **다른 방(netloc)** 으로 들어갑니다.
 * ★ 토큰은 exocad 것과 같은 것을 씁니다 — 주문 하나에 10분입니다.
 */
export function autoPrintLaunchUrl(orderId: string, token: string): string {
  return `denflow://print/${orderId}?t=${encodeURIComponent(token)}`;
}

export type ExocadResultStatus = 'done' | 'failed';

export function isExocadResultStatus(v: unknown): v is ExocadResultStatus {
  return v === 'done' || v === 'failed';
}

// ---------- 에이전트가 집어 가는 일감 ----------
//
// ★★ **왜 — 브라우저가 고리에서 빠집니다** (2026-10-14). 지금까지는 단추를
//   누르면 브라우저가 `denflow://` 를 쏘아 런처를 띄웠습니다. 그런데
//   브라우저가 안 쏘면 **창도 오류도 없이** 멈춥니다. 레지스트리도 런처도
//   멀쩡한데 화면엔 '여는 중' 만 남습니다 — 이틀을 거기서 썼습니다.
//   그쪽은 우리가 고칠 수 있는 자리가 아닙니다.
//
// ★ 그래서 단추는 **줄 하나 남기는** 일만 하고, 설계 PC 의 에이전트가
//   물어보고 가져갑니다. 자동 출력이 이미 이 길로 돕니다.

/**
 * 눌러 둔 줄을 에이전트가 집어 갈 수 있는 시간 (분).
 *
 * ★★ **지난 것을 집으면 안 됩니다.** 에이전트가 꺼져 있던 동안 쌓인 줄을
 *   켜자마자 다 열면, 사람이 안 시킨 케이스가 줄줄이 exocad 에 올라갑니다.
 *   "아까 눌렀는데 이제 열렸네" 까지가 사람이 납득하는 범위입니다.
 * ★ 넉넉히 둡니다 — 에이전트가 잠깐 멈췄다 떠도 방금 누른 것은 살려야
 *   합니다. 토큰이 10분이라 그보다 길게 둘 이유도 없습니다.
 */
export const EXOCAD_CLAIM_MINUTES = 10;

/**
 * 누른 지 이만큼 지나야 지켜보기가 집어 갑니다 (2026-10-20).
 *
 * ★★ 브라우저 링크(denflow://)와 exocad 지켜보기가 **같은 PC** 에서 돌면 한 건을
 *   둘 다 띄웠습니다 — 0.5초 차이로 런처가 두 번 뜨고 exocad 환자가 둘씩 생겼습니다
 *   (10/20 유선조·문상규·장양현). 링크 쪽이 먼저 받아 가면(fetchedAt) 지켜보기는
 *   볼 일이 없습니다. 브라우저가 없는 서버 PC 에서는 이 몇 초 뒤에 지켜보기가 엽니다.
 */
export const EXOCAD_CLAIM_DELAY_SECONDS = 8;

export interface PendingExport {
  orderId: string;
  requestedAt: string;
  fetchedAt: string | null;
}

/**
 * 지금 집어 갈 줄. 없으면 null.
 *
 * ★ **이미 가져간 것은 다시 안 줍니다**(fetchedAt). 런처가 주문 정보를
 *   받아 갈 때 서버가 그 자리를 찍습니다 — 그게 '가져갔다' 는 뜻입니다.
 * ★ 오래된 것부터 줍니다. 두 건을 눌러 뒀으면 누른 차례대로 열립니다.
 */
export function nextExport(rows: PendingExport[], now: Date = new Date()): PendingExport | null {
  const floor = now.getTime() - EXOCAD_CLAIM_MINUTES * 60_000;
  // ★ 방금 누른 것은 아직 안 줍니다 — 브라우저 링크가 먼저 열 틈 (EXOCAD_CLAIM_DELAY_SECONDS)
  const ceiling = now.getTime() - EXOCAD_CLAIM_DELAY_SECONDS * 1000;

  const waiting = rows
    .filter((r) => !r.fetchedAt && Date.parse(r.requestedAt) >= floor && Date.parse(r.requestedAt) <= ceiling)
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

  return waiting[0] ?? null;
}
