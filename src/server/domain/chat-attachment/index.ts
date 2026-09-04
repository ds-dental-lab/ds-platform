// =========================================================
// 놓을 위치: src/server/domain/chat-attachment/index.ts
//
// 대화에 붙이는 파일의 규칙. (사용자 요청 2026-09-04 —
//   "대화창에서 카톡처럼 다운로드받고 바로 볼 수 있게 하면 안 되나")
//
// ★★ 대화가 파일을 **가지지 않고 가리킵니다.** 떨어뜨린 파일은 그
//   주문의 order_files 로 들어가고, 대화 줄은 그 id 하나만 듭니다.
//   그래야 보관기간·기공소 잠금·열람 기록·용량 셈이 그대로 먹습니다.
//
// ★ 종류는 둘뿐입니다 — **사진(photo)** 과 **그 밖(etc)**.
//   스캔(scan)·설계(design)는 대화로 안 보냅니다. 그 둘은 제 자리
//   (파일 칸)가 있고, 특히 설계 파일은 기공소가 받으면 '제작' 으로
//   넘어가는 신호라 대화에 흘려 넣으면 안 됩니다.
//
// ★ 기공소는 **그대로 잠급니다** (사용자 결정 2026-09-04). photo 는
//   사진이라 열리고, etc(html 뷰어 등)는 기공소가 못 엽니다 —
//   file-access 의 규칙(사진만) 이 그대로 적용됩니다. 여기서 다시
//   적지 않습니다.
// =========================================================

import { extensionOf, isLabOpenable } from '../file-access';
import type { Sector } from '../order-status';

/** 대화로 보낼 수 있는 파일 종류. order_file_kind 의 두 값입니다 */
export type AttachmentKind = 'photo' | 'etc';

/**
 * 대화 첨부 상한.
 *
 * ★ 스캔(500MB)보다 훨씬 낮게 잡습니다. 대화에 오가는 것은 사진(수 MB)과
 *   exocad html 뷰어(5MB 안팎)입니다. 큰 덩어리는 파일 칸으로 가야
 *   진행률이 보이고 이어 올리기가 됩니다 — 대화창은 그런 장치가 없습니다.
 */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/**
 * 브라우저가 **바로 열 수 있는** 확장자 — 새 탭에서 열기 단추를 냅니다.
 *
 * ★ html 이 들어 있습니다. exocad 가 뱉는 3D 뷰어가 html 한 장이라,
 *   카톡으로 받아 더블클릭하던 것을 여기서 한 번 누르면 됩니다.
 *   우리 화면 **안에** 그리지는 않습니다 — html 은 그림이 아니라
 *   프로그램이라, 새 탭(저장소 도메인)에서 격리해 엽니다.
 */
const OPENS_IN_BROWSER = ['html', 'htm', 'pdf'] as const;

/** 사진인가 — 채팅 안에 미리보기를 그립니다 */
export function isImageName(fileName: string): boolean {
  return isLabOpenable(fileName);
}

/** 이 파일을 어느 종류로 넣는가 */
export function attachmentKindFor(fileName: string): AttachmentKind {
  return isImageName(fileName) ? 'photo' : 'etc';
}

/** 새 탭에서 바로 열 수 있는가 (사진도 새 탭에서 크게 봅니다) */
export function opensInBrowser(fileName: string): boolean {
  if (isImageName(fileName)) return true;

  return (OPENS_IN_BROWSER as readonly string[]).includes(extensionOf(fileName));
}

/**
 * 누가 대화에 파일을 붙일 수 있나.
 *
 * ★ 치과와 디자인센터입니다. 기공소는 읽기만 — 사용자가 잠가 두라고
 *   했습니다. 기공소가 완성 사진을 보내는 일이 생기면 그때 엽니다.
 */
export function canAttach(sector: Sector | null | undefined): boolean {
  return sector === 'clinic' || sector === 'design_center';
}

export type AttachmentVerdict = { ok: true } | { ok: false; reason: string };

/** 붙이기 전에 봅니다. 크기만 봅니다 — 형식은 안 가립니다 */
export function checkAttachment(file: { name: string; size: number }): AttachmentVerdict {
  if (!file.name.trim()) return { ok: false, reason: '이름이 없는 파일입니다' };
  if (file.size <= 0) return { ok: false, reason: '빈 파일입니다' };

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: `대화로는 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB 까지 보낼 수 있습니다. 큰 파일은 파일 칸에 올려 주세요`,
    };
  }

  return { ok: true };
}

/**
 * 글 없이 파일만 보냈을 때 **알림에 쓰는** 한 줄.
 *
 * ★ 대화 본문은 비워 둡니다 — 카드가 곧 내용입니다. 하지만 종(알림)과
 *   푸시에는 글이 있어야 합니다. 빈 알림은 무엇이 왔는지 모릅니다.
 */
export function attachmentNotice(fileName: string): string {
  return isImageName(fileName) ? '사진을 보냈습니다' : `파일을 보냈습니다 · ${fileName}`;
}

/** 사람이 읽는 크기. 대화 카드용 — 소수점 한 자리 */
export function attachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + 'KB';

  return Math.max(0, bytes) + 'B';
}
