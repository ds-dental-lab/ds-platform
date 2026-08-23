// =========================================================
// 놓을 위치: src/server/domain/shade-photo/index.ts
//
// 쉐이드 포토의 규칙. (명세서 SPEC_shade-photo, 사용자 결정 2026-08-21)
//
// ★ 만드는 이유 — 치과는 지금 폰으로 찍어 **카카오톡**으로 보냅니다.
//     ① 카톡이 눌러서 색이 왜곡됩니다 (쉐이드 판별에 치명적)
//     ② 대화방에 여러 환자가 섞여 어느 건인지 헷갈립니다
//     ③ 나중에 그 환자 사진을 못 찾습니다
//   답은 **사진이 처음부터 그 주문에 붙게** 하는 것입니다. 분류할
//   일이 아예 없어집니다.
//
// ★★ **쉐이드 사진은 안 줄입니다** (사용자 결정 2026-08-21).
//   다른 사진은 2026-08-14 결정대로 1600px·WebP 로 줄입니다. 그런데
//   쉐이드는 **카톡의 압축을 피하려고** 만드는 기능입니다 — 우리가
//   또 줄이면 만드는 이유가 없어집니다.
//   저장소는 하루 30건×3장×4MB 로 180일에 65GB 어름, 스캔 파일의
//   10분의 1입니다. 그 값은 치를 만합니다.
// =========================================================

import type { OrderStatus } from '../order-status';

/**
 * 진료실 화면에 세울 주문인가.
 *
 * ★ 아직 만들고 있는 것만 찍습니다. 배송이 나간 뒤에 쉐이드를 찍는
 *   일은 없습니다 — 있다면 그건 리메이크입니다.
 */
const SHOOTABLE: OrderStatus[] = ['uploading', 'received', 'rescan', 'designing'];

export function canShoot(status: OrderStatus): boolean {
  return SHOOTABLE.includes(status);
}

/**
 * 이 파일이 쉐이드 사진인가.
 *
 * ★ 확장자로 봅니다. 기공소에게 열어 주는 목록과 **같은 잣대**여야
 *   합니다 — 화면에서 '촬영 완료' 라고 해 놓고 기공소가 못 여는
 *   파일이면 거짓말이 됩니다 (domain/file-access).
 */
const PHOTO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'heif'];

export function isPhoto(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return false;

  return PHOTO_EXTENSIONS.includes(fileName.slice(dot + 1).toLowerCase());
}

/** 쉐이드 상태 — 사진이 한 장이라도 붙었으면 끝난 것입니다 */
export type ShadeStatus = 'waiting' | 'done';

export function shadeStatusOf(files: { file_name: string; kind: string }[]): ShadeStatus {
  /*
    ★ 디자인 파일은 안 셉니다. 그건 센터가 만든 것이지 진료실이
      찍은 것이 아닙니다. 미리보기 png 가 섞여 있어 헷갈립니다.
  */
  return files.some((f) => f.kind !== 'design' && isPhoto(f.file_name)) ? 'done' : 'waiting';
}

export const SHADE_STATUS_LABEL: Record<ShadeStatus, string> = {
  waiting: '쉐이드 대기',
  done: '촬영 완료',
};

/**
 * 찍은 사진에 붙일 이름.
 *
 * ★ 환자 이름을 안 씁니다. 파일명이 그대로 저장소 경로에 남고,
 *   내려받을 때 사람 눈에도 보입니다 (설계서 §8.5 · 파일명 마스킹).
 *   주문번호와 찍은 순서면 충분합니다.
 */
export function shadePhotoName(orderNo: string, index: number, takenAt: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${takenAt.getFullYear()}${two(takenAt.getMonth() + 1)}${two(takenAt.getDate())}` +
    `-${two(takenAt.getHours())}${two(takenAt.getMinutes())}`;

  return `${orderNo}_shade${index + 1}_${stamp}.jpg`;
}

/**
 * 컷 체크리스트. (명세서 S3, 사용자 결정 2026-08-23 — 셋에서 **둘로**)
 *
 * ★ 순서는 **권장이지 강제가 아닙니다.** 셔터는 언제나 눌립니다 —
 *   바쁜 진료실에서 절차가 걸림돌이 되면 안 됩니다.
 *
 * ★★ 시안·명세는 셋이었습니다(③ 자유컷). 사장님이 둘로 줄였습니다 —
 *   **원본 화질로 담기 때문에** 한 장이 크고, 한 케이스에 세 장이면
 *   저장소가 금세 찹니다. 색을 정하는 데 실제로 쓰이는 것은 앞의
 *   둘입니다. 셋째는 '있으면 좋은' 컷이었지, 없으면 못 만드는 컷이
 *   아니었습니다.
 *
 * ★ 줄인 것은 **권장 장수**지 상한이 아닙니다. 셔터는 계속 눌립니다 —
 *   필요하면 더 찍습니다.
 */
export const SHADE_CUTS = ['① 쉐이드탭 포함', '② 정면'] as const;

/**
 * 전치부인가. (사용자 요청 2026-08-23 — "전치부 경우 코까지 보였으면")
 *
 * ★★ **왜 코까지 담는가.** 앞니는 색만 맞아서는 안 됩니다. 얼굴 안에서
 *   봤을 때 맞아야 합니다 — 입술선·피부톤이 같이 보여야 기공소가
 *   그 사람에게 맞는 색인지 판단합니다. 치아만 크게 찍은 사진은
 *   색은 보이지만 **어울리는지는 안 보입니다.**
 *
 * ★ FDI 로 견치에서 견치까지입니다 (#13–#23, #33–#43).
 *   소구치부터는 웃어도 잘 안 보이니 얼굴을 담을 이유가 적습니다.
 */
export function isAnterior(toothNumbers: readonly number[]): boolean {
  return toothNumbers.some((n) => {
    const quadrant = Math.floor(n / 10);
    const position = n % 10;

    if (quadrant < 1 || quadrant > 4) return false;

    // 1~3번 = 중절치·측절치·견치
    return position >= 1 && position <= 3;
  });
}

/** 홈 목록에 세우는 기간. 그 이전은 검색으로만 (명세서 S1) */
export const HOME_DAYS = 7;

// ---------- 미분류 묶기 (명세서 S5·S6) ----------

export interface UnsortedBox {
  sessionId: string;
  count: number;
  /** 그 묶음을 찍기 시작한 시각 */
  takenAt: string;
}

/**
 * 미분류 사진을 **묶음 단위**로 셉니다.
 *
 * ★★ 매칭이 묶음 단위인 이유 — 한 환자를 세 장 찍었으면 세 장이 같이
 *   가야 합니다. 장마다 고르게 하면 그게 곧 카톡에서 하던 그 일입니다.
 *
 * ★ 묶음의 시각은 **제일 먼저 찍은 장**입니다. 그때 그 환자를 봤습니다.
 */
export function groupUnsorted(rows: { session_id: string; created_at: string }[]): UnsortedBox[] {
  const boxes = new Map<string, UnsortedBox>();

  for (const r of rows) {
    const box = boxes.get(r.session_id);

    if (box) {
      box.count += 1;
      if (r.created_at < box.takenAt) box.takenAt = r.created_at;
    } else {
      boxes.set(r.session_id, { sessionId: r.session_id, count: 1, takenAt: r.created_at });
    }
  }

  return [...boxes.values()].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

// ---------- 알림 (명세서 S4 — "기공소에 알림을 보냈습니다") ----------

export interface ShadeNotice {
  title: string;
  body: string;
}

/**
 * 쉐이드 사진이 붙었다는 알림.
 *
 * ★★ 화면이 "알림을 보냈습니다" 라고 **말만** 하고 있었습니다
 *   (2026-08-21). 하지도 않은 일을 했다고 하는 것이라 먼저 고칩니다.
 *
 * ★ 환자 이름을 씁니다. 기공소는 이름으로 케이스를 찾습니다
 *   ([[기공소가 보는 것]] — 이름은 봅니다).
 *
 * ★ 몇 장인지 적습니다. "왔다" 만으로는 세 장 중 한 장만 온 것을
 *   못 알아챕니다.
 */
export function shadeNotice(orderNo: string, patientLabel: string, count: number): ShadeNotice {
  return {
    title: `쉐이드 사진 ${count}장이 왔습니다`,
    body: `${orderNo} · ${patientLabel}`,
  };
}

/** 웹푸시로 나갈 때의 모양. 같은 주문이면 갈아끼웁니다 */
export function shadePushPayload(
  orderId: string,
  orderNo: string,
  patientLabel: string,
  count: number,
  link: string,
) {
  const notice = shadeNotice(orderNo, patientLabel, count);

  return { title: notice.title, body: notice.body, link, tag: `shade-${orderId}` };
}

// ---------- 섬네일 (명세서 §4 — 원본은 그대로, 목록용은 따로) ----------

/**
 * ★★ **섬네일 파일을 안 만듭니다.**
 *   명세는 "서버에서 별도 생성" 이라고 적었지만, 저장소가 이미
 *   줄여서 내줍니다(Supabase 이미지 변환). 실제로 재 봤습니다 —
 *   191KB PNG 를 480px 로 달라니 91KB 로 왔습니다.
 *
 *   그러면 원본은 손 하나 안 대고 그대로 남고, 저장소도 두 배로
 *   안 늘어납니다. **안 만드는 것이 만드는 것보다 낫습니다.**
 *
 * ★ 실제 크기 (2026-08-21 실측, 187KB PNG 기준)
 *     목록용 320  →  65KB … 그런데 **브라우저가 받으면 24KB** 입니다.
 *                    저장소가 `Accept: image/webp` 를 보고 WebP 로 줍니다.
 *     크게보기 1280 → 160KB
 *   ★ 잴 때 그 헤더를 안 보내면 세 배로 나옵니다 — 저도 한 번 속았습니다.
 *
 * ★ 줄인 것은 **보여 주기 위한 것**입니다. 쉐이드 판별은 원본으로
 *   합니다 — 기공소는 파일을 내려받아 봅니다.
 */

/** 목록 칸에 거는 크기. 폰이 3열이라 한 칸이 120px 어름, 3배 화면까지 봅니다 */
export const THUMB_EDGE = 320;

/** 눌러서 크게 볼 때. 원본이 아니라 이것으로 충분합니다 */
export const VIEW_EDGE = 1280;

export interface ThumbTransform {
  width: number;
  height: number;
  resize: 'cover' | 'contain';
  quality: number;
}

/**
 * 저장소에 줄여 달라고 할 때의 값.
 *
 * ★ 목록은 `cover` — 칸을 꽉 채워야 줄이 안 어그러집니다.
 * ★ 크게 볼 때는 `contain` — 잘리면 안 됩니다. 쉐이드탭이 가장자리에
 *   있는 사진이 흔합니다.
 */
export function thumbTransform(kind: 'grid' | 'view'): ThumbTransform {
  return kind === 'grid'
    ? { width: THUMB_EDGE, height: THUMB_EDGE, resize: 'cover', quality: 70 }
    : { width: VIEW_EDGE, height: VIEW_EDGE, resize: 'contain', quality: 85 };
}

/** 주소가 살아 있는 시간(초). 화면을 열어 두고 보는 동안 넉넉히 */
export const THUMB_TTL = 600;

// ---------- 전송 대기 (명세서 §5 · 엣지케이스 "업로드 중 네트워크 끊김") ----------

/**
 * ★★ **왜 필요한가.** 진료실 와이파이는 자주 약합니다. 지금까지는
 *   올리다 끊기면 그 자리에서 실패하고, 찍은 사진이 **사라졌습니다.**
 *   환자는 이미 일어났고 다시 찍을 수 없습니다.
 *
 * ★ 그래서 폰 안에 들고 있다가 연결이 돌아오면 다시 보냅니다.
 *   사진은 그 폰을 떠나기 전까지 안 없어집니다.
 */

/** 몇 번까지 스스로 다시 해 보는가 */
export const QUEUE_MAX_TRIES = 5;

/**
 * 이 사진을 또 보내 볼까.
 *
 * ★ 무한정 하지 않습니다. 다섯 번을 실패했으면 연결 문제가 아니라
 *   다른 사정입니다(파일이 깨졌거나 주문이 지워졌거나). 그때는
 *   사람에게 보여 주고 정하게 합니다 — 조용히 계속 두드리면
 *   배터리만 먹고 아무도 모릅니다.
 */
export function shouldRetry(tries: number): boolean {
  return tries < QUEUE_MAX_TRIES;
}

/** 전송 대기 띠에 쓸 말 */
export function queueLabel(waiting: number, stuck: number): string {
  if (stuck > 0 && waiting === 0) return `사진 ${stuck}장을 못 보냈습니다`;
  if (stuck > 0) return `전송 대기 ${waiting}장 · 못 보낸 것 ${stuck}장`;

  return `전송 대기 ${waiting}장`;
}
