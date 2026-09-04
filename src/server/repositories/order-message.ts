// =========================================================
// 놓을 위치: src/server/repositories/order-message.ts
//
// 주문별 대화. 치과 · 디자인센터 · 기공소 셋이 함께 봅니다.
// 누가 볼 수 있는지는 RLS 가 정합니다 (order_message_select).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { isFileBlockedFor } from '@/server/domain/file-access';
import { isImageName, opensInBrowser } from '@/server/domain/chat-attachment';
import { thumbTransform, THUMB_TTL } from '@/server/domain/shade-photo';
import type { Sector } from '@/server/domain/order-status';

/**
 * 대화에 붙은 파일. (2026-09-04)
 *
 * ★ 주소(storage_path)는 안 내려갑니다. 화면은 id 만 들고, 열 때
 *   actions/order-file 이 확인한 뒤 짧게 사는 주소를 만들어 줍니다.
 *   사진 미리보기만 예외 — 저장소가 줄여 준 작은 그림의 서명 주소입니다.
 */
export interface MessageAttachment {
  fileId: string;
  fileName: string;
  fileSize: number;
  /** 사진이면 채팅 안에 그립니다 */
  isImage: boolean;
  /** 새 탭에서 바로 열 수 있는가 (사진·html·pdf) */
  opens: boolean;
  /** 이 사람은 못 여는가 (기공소 + 사진 아닌 것) — 자물쇠를 그립니다 */
  blocked: boolean;
  /** 사진일 때만. 막혔거나 못 만들었으면 빈 글자 */
  thumbUrl: string;
}

export interface OrderMessage {
  id: string;
  body: string;
  /** 붙은 파일. 없으면 null. 파일이 지워졌으면 removedAttachment 가 true */
  attachment: MessageAttachment | null;
  removedAttachment: boolean;
  authorName: string;
  authorSector: Sector;
  createdAt: string;
  editedAt: string | null;
  /** 내가 쓴 글인가 — 오른쪽에 붙여 그립니다 */
  mine: boolean;
  /** 내가 고치고 지울 수 있는가 (글쓴이 본인 또는 디자인센터) */
  canManage: boolean;
}

interface RawMessage {
  id: string;
  body: string;
  author_org_id: string;
  author_name: string;
  author_sector: Sector;
  created_at: string;
  edited_at: string | null;
  file_id: string | null;
  file: {
    id: string;
    kind: string;
    file_name: string;
    file_size: number | null;
    storage_path: string;
    deleted_at: string | null;
    upload_status: string;
  } | null;
}

export async function listOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const supabase = await createClient();
  const session = await getSession();

  const { data, error } = await supabase
    .from('order_messages')
    .select(
      'id, body, author_org_id, author_name, author_sector, created_at, edited_at, file_id, file:order_files(id, kind, file_name, file_size, storage_path, deleted_at, upload_status)',
    )
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at');

  if (error || !data) return [];

  const myOrgId = session?.orgId ?? null;
  const viewer = session?.orgType ?? null;

  /*
    ★ 사진 미리보기 주소는 여기서 한 번에 만듭니다. 화면이 파일마다
      서버를 부르면 대화 하나 여는 데 왕복이 열 번입니다.
    ★ 기공소가 못 여는 것은 주소를 **만들지 않습니다.** 화면에서 안
      그리는 것과 주소가 아예 없는 것은 다릅니다 (설계서 §8.5).
  */
  const rows = data as unknown as RawMessage[];
  const thumbs = new Map<string, string>();

  await Promise.all(
    rows
      .filter((r) => r.file && !r.file.deleted_at && isImageName(r.file.file_name))
      .filter((r) => !isFileBlockedFor(viewer, { kind: r.file!.kind, fileName: r.file!.file_name }))
      .map(async (r) => {
        const { data: signed } = await supabase.storage
          .from('order-files')
          .createSignedUrl(r.file!.storage_path, THUMB_TTL, { transform: thumbTransform('grid') });
        if (signed?.signedUrl) thumbs.set(r.file!.id, signed.signedUrl);
      }),
  );

  const attachmentOf = (r: RawMessage): Pick<OrderMessage, 'attachment' | 'removedAttachment'> => {
    if (!r.file_id) return { attachment: null, removedAttachment: false };
    if (!r.file || r.file.deleted_at) return { attachment: null, removedAttachment: true };

    const f = r.file;
    return {
      removedAttachment: false,
      attachment: {
        fileId: f.id,
        fileName: f.file_name,
        fileSize: f.file_size ?? 0,
        isImage: isImageName(f.file_name),
        opens: opensInBrowser(f.file_name),
        blocked: isFileBlockedFor(viewer, { kind: f.kind, fileName: f.file_name }),
        thumbUrl: thumbs.get(f.id) ?? '',
      },
    };
  };

  // ★ 디자인센터는 남의 글도 정리합니다 (사용자 결정 2026-08-11).
  //   가운데에서 조율하는 자리라 잘못 적힌 글을 치울 수 있어야 합니다.
  //   실제 차단은 RLS 가 하고, 여기서는 버튼을 보일지만 정합니다.
  const isDesign = session?.orgType === 'design_center';

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    ...attachmentOf(row),
    authorName: row.author_name,
    authorSector: row.author_sector,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    mine: row.author_org_id === myOrgId,
    canManage: row.author_org_id === myOrgId || isDesign,
  }));
}
