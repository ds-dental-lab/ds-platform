// =========================================================
// 놓을 위치: src/server/actions/order-message.ts
//
// 주문별 대화 — 쓰기 · 고치기 · 지우기.
// 실제 차단은 RLS 가 합니다 (order_message_* 정책).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { publishOrderMessage } from '@/server/events';
import { signalOrderChanged } from '@/server/events/signal';
import { attachmentNotice } from '@/server/domain/chat-attachment';

export type MessageResult = { ok: true } | { ok: false; error: string };

const MAX_LENGTH = 200;

function checkBody(body: string, hasFile = false): string | null {
  const trimmed = body.trim();
  // ★ 파일이 붙어 있으면 글은 비어도 됩니다 — 카드가 곧 내용입니다 (2026-09-04)
  if (!trimmed && !hasFile) return '내용을 입력해 주세요';
  if (trimmed.length > MAX_LENGTH) return `${MAX_LENGTH}자까지 쓸 수 있습니다`;
  return null;
}

/** 세 섹터의 상세 화면이 같은 주문을 보므로 전부 다시 그립니다 */
function refreshAll() {
  revalidatePath('/clinic/orders', 'layout');
  revalidatePath('/design/orders', 'layout');
  revalidatePath('/lab/orders', 'layout');
}

/**
 * @param fileId 대화에 붙일 파일 — 그 주문의 order_files 줄 (2026-09-04).
 *   대화가 파일을 갖지 않고 가리킵니다. 파일은 이미 lib/upload 로
 *   올라가 있어야 합니다.
 */
export async function submitOrderMessage(
  orderId: string,
  body: string,
  fileId: string | null = null,
): Promise<MessageResult> {
  const session = await getSession();
  if (!session?.orgId || !session.orgType) {
    return { ok: false, error: '소속 조직이 있어야 글을 쓸 수 있습니다' };
  }

  const problem = checkBody(body, Boolean(fileId));
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  /*
    ★★ 가리키는 파일이 **이 주문의** 파일인지 확인합니다.
      화면이 보낸 id 를 그대로 믿으면 남의 주문 파일 id 를 붙여
      내 대화에서 열어 볼 길이 생깁니다. RLS 가 그 파일을 보여 주더라도
      (같은 조직의 다른 주문) 주문이 어긋나면 막습니다.
  */
  let fileName = '';
  if (fileId) {
    const { data: file } = await supabase
      .from('order_files')
      .select('id, file_name, order_id, upload_status')
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();

    const found = file as { file_name: string; order_id: string; upload_status: string } | null;
    if (!found || found.order_id !== orderId) return { ok: false, error: '붙일 파일을 찾을 수 없습니다' };
    if (found.upload_status !== 'uploaded') return { ok: false, error: '파일이 아직 다 올라가지 않았습니다' };
    fileName = found.file_name;
  }

  // after() 안에서도 쓰므로 좁혀진 값을 꺼내 둡니다
  const author = {
    orgId: session.orgId,
    sector: session.orgType,
    name: session.orgName ?? '',
  };
  const text = body.trim();
  // ★ 글 없이 파일만 보냈으면 종·푸시에는 무엇이 왔는지 적어 줍니다
  const noticeText = text || (fileName ? attachmentNotice(fileName) : '');

  const { error } = await supabase.from('order_messages').insert({
    order_id: orderId,
    author_org_id: session.orgId,
    author_user_id: session.user.id,
    author_name: session.orgName ?? '',
    author_sector: session.orgType,
    body: text,
    file_id: fileId,
  });

  if (error) return { ok: false, error: `보내지 못했습니다: ${error.message}` };

  /*
    ★ 대화도 종에 붙습니다 (사용자 결정 2026-08-13).
      전에는 대화만 알림을 하나도 안 만들었습니다. 상태가 바뀌면
      숫자가 붙는데 글은 아무 소리 없이 쌓여서, 치과가 급한 것을 적어
      놓아도 상대가 그 주문을 다시 열 때까지 아무도 몰랐습니다.

    ★ 보낸 사람을 기다리게 하지 않습니다.
      알림을 만드는 동안 전송 버튼이 멈춰 있을 이유가 없습니다.
      after() 는 응답을 보낸 뒤에 돕니다.
  */
  after(async () => {
    await publishOrderMessage({
      orderId,
      authorOrgId: author.orgId,
      authorUserId: session.user.id,
      authorSector: author.sector,
      authorName: author.name,
      body: noticeText,
    });

    // ★ 신호는 알림 다음입니다 (2026-08-19).
    //   받은 쪽은 신호를 듣고 화면을 다시 읽는데, 그때 알림(종 숫자)이
    //   아직 안 만들어져 있으면 글은 붙고 종은 늦는 어긋남이 보입니다.
    await signalOrderChanged(orderId);
  });

  refreshAll();
  return { ok: true };
}

export async function submitEditOrderMessage(
  messageId: string,
  body: string,
): Promise<MessageResult> {
  const problem = checkBody(body);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // order_id 는 신호를 쏠 곳입니다 — 고친 글도 상대 화면에서 바뀌어야 합니다
  const { data, error } = await supabase
    .from('order_messages')
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select('id, order_id');

  if (error) return { ok: false, error: `고치지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '고칠 수 있는 글이 아닙니다' };
  }

  const orderId = (data[0] as { order_id: string }).order_id;
  after(() => signalOrderChanged(orderId));

  refreshAll();
  return { ok: true };
}

/**
 * 지우기.
 *
 * ★ 행을 없애지 않고 deleted_at 만 채웁니다.
 *   RLS 의 select 가 deleted_at is null 로 걸러 화면에서는 사라지고,
 *   "누가 무엇을 지웠나" 는 남습니다.
 */
export async function submitDeleteOrderMessage(messageId: string): Promise<MessageResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select('id, order_id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '지울 수 있는 글이 아닙니다' };
  }

  const orderId = (data[0] as { order_id: string }).order_id;
  after(() => signalOrderChanged(orderId));

  refreshAll();
  return { ok: true };
}
