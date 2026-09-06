// =========================================================
// 놓을 위치: src/components/order/OrderChat.tsx
//
// 주문상세 오른쪽의 대화 패널. (사용자가 준 화면)
//   한 주문을 두고 치과 · 디자인센터 · 기공소 셋이 주고받습니다.
//
// ★ 기공소도 읽습니다 (사용자 결정 2026-08-11).
//   그래서 여기에 환자 실명을 적으면 §8.5 의 실명 차단이 뚫립니다.
//   입력칸 아래에 누가 함께 보는지 늘 적어 둡니다.
//
// ★ 고치고 지우는 것은 글쓴이 본인과 디자인센터입니다.
//   버튼을 보일지는 저장소가 canManage 로 정해 줍니다 — 화면은 그리기만 합니다.
//
// ★★ 파일을 끌어다 놓을 수 있습니다 (사용자 요청 2026-09-04 —
//   "카톡처럼 다운로드받고 바로 볼 수 있게"). 사진은 채팅 안에 바로
//   보이고, html(exocad 3D 뷰어)·pdf 는 '열기' 로 새 탭에서 바로 돕니다.
//
//   ★ 대화가 파일을 **가지지 않고 가리킵니다.** 떨어뜨린 파일은 그
//     주문의 파일(photo·etc)로 들어가고, 글은 그 id 만 듭니다. 그래서
//     보관기간·기공소 잠금·열람 기록·용량 셈이 그대로 먹습니다.
//   ★ 기공소는 그대로 잠겨 있습니다 — 사진만 열립니다. 붙이는 것도
//     치과·센터만 합니다 (domain/chat-attachment).
//   ★ html 은 우리 화면 **안에** 그리지 않습니다. 그림이 아니라
//     프로그램이라 새 탭(저장소 도메인)에서 격리해 엽니다.
// =========================================================

'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitOrderMessage,
  submitEditOrderMessage,
  submitDeleteOrderMessage,
} from '@/server/actions/order-message';
import { getOrderFileUrl } from '@/server/actions/order-file';
import { markOrderChatRead } from '@/server/actions/notification';
import { uploadOrderFiles } from '@/lib/upload';
import {
  canAttach,
  checkAttachment,
  attachmentKindFor,
  attachmentSize,
} from '@/server/domain/chat-attachment';
import type { OrderMessage, MessageAttachment } from '@/server/repositories/order-message';
import type { Sector } from '@/server/domain/order-status';

const MAX_LENGTH = 200;

const SECTOR_META: Record<Sector, { label: string; color: string; soft: string }> = {
  clinic: { label: '치과', color: '#1279E8', soft: '#EDF3FE' },
  design_center: { label: '디자인센터', color: '#5546C8', soft: '#EFEDFB' },
  lab: { label: '기공소', color: '#12855B', soft: '#E6F4EE' },
};

export interface OrderChatProps {
  orderId: string;
  messages: OrderMessage[];
  /** 보는 사람의 소속 — 파일을 붙일 수 있는지 정합니다 */
  sector: Sector;
}

export default function OrderChat({ orderId, messages, sector }: OrderChatProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [removing, setRemoving] = useState<OrderMessage | null>(null);

  // ---------- 파일 ----------
  const attachable = canAttach(sector);
  const [dragging, setDragging] = useState(false);
  /** 올리는 중인 파일 — 이름과 % */
  const [uploading, setUploading] = useState<{ name: string; percent: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const busy = saving || refreshing || uploading !== null;

  // 새 글이 붙으면 아래로 따라갑니다
  useEffect(() => {
    const box = listRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length]);

  /*
    ★ 이 화면을 보고 있으면 읽은 것입니다 (2026-08-19).
      열 때 한 번, 그리고 신호로 새 글이 붙을 때마다(길이가 변할 때)
      읽음으로 돌립니다. 그래야 목록의 💬 뱃지와 HOME 띠가 실제
      읽음과 같이 움직입니다. 안 읽은 게 없으면 액션이 아무것도
      안 하므로 (0행이면 revalidate 도 안 함) 헛돌지 않습니다.
  */
  useEffect(() => {
    markOrderChatRead(orderId);
  }, [orderId, messages.length]);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setSaving(true);
    const result = await action();
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? '처리하지 못했습니다');
      return false;
    }

    startTransition(() => router.refresh());
    return true;
  }

  async function send() {
    if (!draft.trim()) return;
    const ok = await run(() => submitOrderMessage(orderId, draft));
    if (ok) setDraft('');
  }

  /*
    ★ 파일은 **한 장씩** 올리고 한 장씩 글을 만듭니다.
      묶어 올리면 하나가 실패할 때 어느 것이 갔는지 모릅니다.
      카톡도 사진 셋을 보내면 풍선이 셋입니다.
  */
  async function attach(files: File[]) {
    if (!attachable || files.length === 0) return;
    setError('');

    for (const file of files) {
      const verdict = checkAttachment(file);
      if (!verdict.ok) {
        setError(`${file.name}: ${verdict.reason}`);
        continue;
      }

      setUploading({ name: file.name, percent: 0 });

      const result = await uploadOrderFiles(
        orderId,
        [file],
        (p) => setUploading({ name: file.name, percent: p.overallPercent }),
        attachmentKindFor(file.name),
      );

      const saved = result.uploaded[0];
      if (!result.ok || !saved?.id) {
        setUploading(null);
        setError(`${file.name}: ${result.failures[0]?.reason ?? '올리지 못했습니다'}`);
        continue;
      }

      const posted = await submitOrderMessage(orderId, '', saved.id);
      if (!posted.ok) setError(posted.error);
    }

    setUploading(null);
    startTransition(() => router.refresh());
  }

  /*
    ★ 새 탭은 **누르는 순간** 열어 둡니다. 서버에 주소를 물어본 뒤에 열면
      브라우저가 팝업으로 알고 막습니다 — 사용자 동작과 창 열기 사이에
      await 가 끼면 그렇습니다. 빈 탭을 먼저 열고 주소를 나중에 넣습니다.
  */
  async function open(a: MessageAttachment) {
    setError('');
    const tab = window.open('', '_blank', 'noopener');
    const result = await getOrderFileUrl(a.fileId, 'open');

    if (!result.ok) {
      tab?.close();
      setError(result.error);
      return;
    }

    if (tab) tab.location.href = result.url;
    else window.location.assign(result.url);
  }

  async function save(a: MessageAttachment) {
    setError('');
    const result = await getOrderFileUrl(a.fileId);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    // 새 탭이 아니라 내려받기로 — stl 이 브라우저에 통째로 열리지 않게
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div
      className="relative flex h-full min-h-[420px] flex-col rounded-lg border border-[#E8EBF0] bg-white"
      onDragOver={(e) => {
        if (!attachable) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!attachable) return;
        e.preventDefault();
        setDragging(false);
        void attach(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center border-b border-[#E8EBF0] px-4 py-3">
        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">대화</h2>
        {messages.length > 0 && (
          <span className="ml-2 text-[13px] text-[#98A2B3]">{messages.length}</span>
        )}
      </div>

      {/* 끌어다 놓는 동안 덮개 — 어디에 놓아도 됩니다 */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-lg border-2 border-dashed border-[#1279E8] bg-[#1279E8]/5">
          <span className="rounded-md bg-white px-4 py-2 text-[13.5px] font-bold text-[#1279E8] shadow">
            여기 놓으면 대화에 올라갑니다
          </span>
        </div>
      )}

      {/* ---------- 지난 글 ---------- */}
      {/*
        ★ 바탕을 옅게 깝니다.
          흰 화면에 흰 말풍선을 두면 테두리 하나로만 버팁니다.
          바탕이 한 톤 내려가야 풍선이 풍선으로 보입니다 — 카톡도
          대화 바탕만 따로 깔아 둡니다.
      */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F7F8FA] px-4 py-4"
      >
        {messages.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[#98A2B3]">
            아직 대화가 없습니다.
            {attachable && (
              <>
                <br />
                <span className="text-[12.5px]">사진이나 파일을 여기 끌어다 놓아도 됩니다.</span>
              </>
            )}
          </p>
        ) : (
          messages.map((message) => {
            const meta = SECTOR_META[message.authorSector];
            const isEditing = editing === message.id;
            const hasBody = message.body.trim().length > 0;

            return (
              <div
                key={message.id}
                className={'flex flex-col ' + (message.mine ? 'items-end' : 'items-start')}
              >
                {/*
                  ★ 이름은 **상대 글에만** 답니다 (사용자 요청 2026-08-13).
                    카톡이 그렇습니다 — 내가 한 말에 내 이름을 붙이지
                    않습니다. 자리(오른쪽)와 색이 이미 "나" 라고 말합니다.
                */}
                {!message.mine && (
                  <div className="mb-1 flex items-center gap-1.5 pl-1">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10.5px] font-bold"
                      style={{ background: meta.soft, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[12.5px] font-semibold text-[#4A5567]">
                      {message.authorName}
                    </span>
                  </div>
                )}

                {/* ---------- 붙은 파일 ---------- */}
                {(message.attachment || message.removedAttachment) && (
                  <div className={'flex max-w-[92%] items-end gap-1.5 ' + (message.mine ? 'flex-row' : 'flex-row-reverse')}>
                    {!hasBody && (
                      <span className="shrink-0 pb-0.5 text-[10.5px] tabular-nums text-[#C4CBD6]">
                        {stamp(message.createdAt)}
                      </span>
                    )}

                    {message.attachment ? (
                      <AttachmentCard a={message.attachment} onOpen={open} onSave={save} />
                    ) : (
                      <span className="rounded-2xl border border-dashed border-[#DDE2EA] px-3.5 py-2 text-[12.5px] text-[#98A2B3]">
                        지워진 파일입니다
                      </span>
                    )}
                  </div>
                )}

                {isEditing ? (
                  <div className="w-full">
                    <textarea
                      value={editDraft}
                      autoFocus
                      maxLength={MAX_LENGTH}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-[#1279E8] px-3 py-2 text-[14px] outline-none"
                    />
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded border border-[#DDE2EA] px-3 py-1 text-[13px] text-[#4A5567]"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={busy || !editDraft.trim()}
                        onClick={async () => {
                          const ok = await run(() =>
                            submitEditOrderMessage(message.id, editDraft),
                          );
                          if (ok) setEditing(null);
                        }}
                        className="rounded bg-[#1279E8] px-3 py-1 text-[13px] font-bold text-white disabled:bg-[#D5DAE2]"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  hasBody && (
                    /*
                      ★ 누가 한 말인지가 한눈에 보여야 합니다 (사용자 지적).
                        내 말은 **찬 파랑에 흰 글씨**, 남의 말은 테두리만 둔
                        흰 풍선. 꼬리(각진 모서리 하나)로 방향을 말합니다.
                    */
                    <div className={'mt-1 flex max-w-[92%] items-end gap-1.5 ' + (message.mine ? 'flex-row' : 'flex-row-reverse')}>
                      <span className="shrink-0 pb-0.5 text-[10.5px] tabular-nums text-[#C4CBD6]">
                        {stamp(message.createdAt)}
                        {message.editedAt && ' 수정'}
                      </span>

                      <div
                        className={
                          'min-w-0 whitespace-pre-wrap px-3.5 py-2.5 text-[14px] leading-relaxed ' +
                          (message.mine
                            ? 'rounded-2xl rounded-br-[4px] bg-[#1279E8] text-white'
                            : 'rounded-2xl rounded-tl-[4px] border border-[#E3E7ED] bg-white text-[#1A2130]')
                        }
                      >
                        {message.body}
                      </div>
                    </div>
                  )
                )}

                {message.canManage && !isEditing && (
                  <div className="mt-1 flex gap-2">
                    {/* ★ 파일만 보낸 글은 고칠 글이 없습니다 — 수정 단추를 안 냅니다 */}
                    {hasBody && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(message.id);
                          setEditDraft(message.body);
                          setError('');
                        }}
                        className="text-[12.5px] text-[#98A2B3] hover:text-[#1279E8]"
                      >
                        수정
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoving(message)}
                      className="text-[12.5px] text-[#98A2B3] hover:text-[#D8453F]"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 올리는 중 — 내 자리(오른쪽)에 임시 풍선 */}
        {uploading && (
          <div className="flex justify-end">
            <div className="w-[220px] rounded-2xl rounded-br-[4px] border border-[#E3E7ED] bg-white px-3.5 py-2.5">
              <p className="truncate text-[12.5px] font-semibold text-[#4A5567]">{uploading.name}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F5]">
                <div className="h-full bg-[#1279E8]" style={{ width: `${uploading.percent}%` }} />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-[#98A2B3]">올리는 중 {uploading.percent}%</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-[13px] text-[#D8453F]">{error}</p>}

      {/* ---------- 쓰기 ---------- */}
      <div className="border-t border-[#E8EBF0] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // 줄바꿈은 Shift+Enter. 그냥 Enter 는 보냅니다
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          maxLength={MAX_LENGTH}
          placeholder={attachable ? '메시지를 입력하거나 파일을 끌어다 놓으세요' : '메시지를 입력하세요'}
          className="w-full resize-none rounded-md border border-[#DDE2EA] px-3 py-2 text-[14px] outline-none focus:border-[#1279E8]"
        />

        <div className="mt-1.5 flex items-center gap-2">
          {/* ★ 끌어놓기가 어색한 사람을 위한 단추 — 같은 길로 갑니다 */}
          {attachable && (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void attach(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label="파일 붙이기"
                title="사진·파일 붙이기"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#DDE2EA] text-[#4A5567] hover:border-[#1279E8] hover:text-[#1279E8] disabled:opacity-40"
              >
                <ClipIcon />
              </button>
            </>
          )}

          {/*
            ★ 설명 문구를 뺐습니다 (사용자 요청 2026-09-06). 전에는 '치과 ·
              디자인센터 · 배정된 기공소가 함께 봅니다' 를 늘 깔아 뒀는데,
              매번 같은 자리에 같은 글이 있으면 배경이 되어 아무도 안 읽고
              칸만 좁아집니다. 누가 보는지는 위 말풍선의 딱지(치과·센터·기공소)가
              이미 말합니다. 빈 자리는 전송 단추를 오른쪽에 붙이는 데 씁니다.
          */}
          <span className="flex-1" />

          <span className="shrink-0 text-[11px] text-[#C4CBD6]">
            {draft.length}/{MAX_LENGTH}
          </span>

          <button
            type="button"
            onClick={send}
            disabled={busy || !draft.trim()}
            className="shrink-0 rounded-md bg-[#1279E8] px-5 py-2 text-[14px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
          >
            전송
          </button>
        </div>
      </div>

      {/* 지우기 확인 */}
      {removing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[360px] rounded-xl bg-white p-6">
            <h3 className="text-[15px] font-bold text-[#1A2130]">이 글을 지울까요?</h3>
            <p className="mt-2 line-clamp-3 rounded-md bg-[#F4F6F9] px-3 py-2 text-[13.5px] text-[#4A5567]">
              {removing.body.trim() ||
                (removing.attachment ? `📎 ${removing.attachment.fileName}` : '(파일)')}
            </p>
            {removing.attachment && (
              <p className="mt-2 text-[12.5px] text-[#98A2B3]">
                파일은 주문의 파일로 남습니다. 대화에서만 사라집니다.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="h-10 flex-1 rounded-md border border-[#DDE2EA] text-[14px] text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() => submitDeleteOrderMessage(removing.id));
                  if (ok) setRemoving(null);
                }}
                className="h-10 flex-1 rounded-md bg-[#D8453F] text-[14px] font-bold text-white hover:bg-[#C13B36] disabled:bg-[#D5DAE2]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 조각 ----------

/**
 * 붙은 파일 한 장.
 *
 * ★ 사진은 **그림이 곧 카드**입니다 — 누르면 새 탭에서 크게.
 * ★ 그 밖은 이름·크기 카드에 '열기'(새 탭) · '받기'. html·pdf 만 열기가 있고,
 *   stl·zip 은 받기만 — 브라우저가 그릴 수 없는 것을 열게 하지 않습니다.
 * ★ 기공소가 못 여는 것은 자물쇠로 보이고 단추가 없습니다. 주소는 서버가
 *   아예 안 만듭니다 — 단추만 숨긴 것이 아닙니다.
 */
function AttachmentCard({
  a,
  onOpen,
  onSave,
}: {
  a: MessageAttachment;
  onOpen: (a: MessageAttachment) => void;
  onSave: (a: MessageAttachment) => void;
}) {
  if (a.isImage && a.thumbUrl && !a.blocked) {
    return (
      <button
        type="button"
        onClick={() => onOpen(a)}
        title={a.fileName}
        className="block overflow-hidden rounded-2xl border border-[#E3E7ED] bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.thumbUrl}
          alt={a.fileName}
          loading="lazy"
          className="block max-h-[200px] max-w-[240px] object-cover"
        />
      </button>
    );
  }

  return (
    <div className="flex min-w-[200px] max-w-[260px] items-center gap-2.5 rounded-2xl border border-[#E3E7ED] bg-white px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-[#4A5567]">
        {a.blocked ? <LockIcon /> : <FileIcon />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#1A2130]" title={a.fileName}>
          {a.fileName}
        </p>
        <p className="text-[11.5px] text-[#98A2B3]">
          {a.blocked ? '기공소는 열 수 없습니다' : attachmentSize(a.fileSize)}
        </p>
      </div>

      {!a.blocked && (
        <div className="flex shrink-0 gap-1">
          {a.opens && (
            <button
              type="button"
              onClick={() => onOpen(a)}
              className="rounded-md bg-[#1279E8] px-2.5 py-1 text-[12px] font-bold text-white hover:bg-[#0F68C9]"
            >
              열기
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(a)}
            className="rounded-md border border-[#DDE2EA] px-2.5 py-1 text-[12px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            받기
          </button>
        </div>
      )}
    </div>
  );
}

function ClipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** '08-11 11:10' */
function stamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
