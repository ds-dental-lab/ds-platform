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
// =========================================================

'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitOrderMessage,
  submitEditOrderMessage,
  submitDeleteOrderMessage,
} from '@/server/actions/order-message';
import type { OrderMessage } from '@/server/repositories/order-message';
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
}

export default function OrderChat({ orderId, messages }: OrderChatProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [removing, setRemoving] = useState<OrderMessage | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const busy = saving || refreshing;

  // 새 글이 붙으면 아래로 따라갑니다
  useEffect(() => {
    const box = listRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length]);

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

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-lg border border-[#E8EBF0] bg-white">
      <div className="flex items-center border-b border-[#E8EBF0] px-4 py-3">
        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">대화</h2>
        {messages.length > 0 && (
          <span className="ml-2 text-[12px] text-[#98A2B3]">{messages.length}</span>
        )}
      </div>

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
          <p className="py-16 text-center text-[13px] text-[#98A2B3]">아직 대화가 없습니다.</p>
        ) : (
          messages.map((message) => {
            const meta = SECTOR_META[message.authorSector];
            const isEditing = editing === message.id;

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
                    <span className="text-[11.5px] font-semibold text-[#4A5567]">
                      {message.authorName}
                    </span>
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
                      className="w-full rounded-md border border-[#1279E8] px-3 py-2 text-[13px] outline-none"
                    />
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded border border-[#DDE2EA] px-3 py-1 text-[12px] text-[#4A5567]"
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
                        className="rounded bg-[#1279E8] px-3 py-1 text-[12px] font-bold text-white disabled:bg-[#D5DAE2]"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  /*
                    ★ 누가 한 말인지가 한눈에 보여야 합니다 (사용자 지적).
                      전에는 내 말이 #EDF3FE, 남의 말이 #F4F6F9 였습니다 —
                      둘 다 아주 옅은 회색빛이라 나란히 놓으면 구별이
                      안 됐습니다. 내 말은 **찬 파랑에 흰 글씨**로 채우고
                      남의 말은 테두리만 둔 흰 풍선으로 둡니다.

                    ★ 꼬리를 답니다.
                      말풍선 쪽 위 모서리 하나만 각지게 두면 그쪽에서
                      나온 말로 읽힙니다 — 카톡·아이메시지가 쓰는 방법입니다.
                  */
                  <div className={'flex max-w-[92%] items-end gap-1.5 ' + (message.mine ? 'flex-row' : 'flex-row-reverse')}>
                    <span className="shrink-0 pb-0.5 text-[10.5px] tabular-nums text-[#C4CBD6]">
                      {stamp(message.createdAt)}
                      {message.editedAt && ' 수정'}
                    </span>

                    <div
                      className={
                        'min-w-0 whitespace-pre-wrap px-3.5 py-2.5 text-[13px] leading-relaxed ' +
                        (message.mine
                          ? 'rounded-2xl rounded-br-[4px] bg-[#1279E8] text-white'
                          : 'rounded-2xl rounded-tl-[4px] border border-[#E3E7ED] bg-white text-[#1A2130]')
                      }
                    >
                      {message.body}
                    </div>
                  </div>
                )}

                {message.canManage && !isEditing && (
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(message.id);
                        setEditDraft(message.body);
                        setError('');
                      }}
                      className="text-[11.5px] text-[#98A2B3] hover:text-[#1279E8]"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(message)}
                      className="text-[11.5px] text-[#98A2B3] hover:text-[#D8453F]"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && <p className="px-4 pb-2 text-[12px] text-[#D8453F]">{error}</p>}

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
          placeholder="메시지를 입력하세요"
          className="w-full resize-none rounded-md border border-[#DDE2EA] px-3 py-2 text-[13px] outline-none focus:border-[#1279E8]"
        />

        <div className="mt-1.5 flex items-center gap-2">
          {/* 누가 함께 보는지는 알려 둡니다 — 기공소까지 읽는다는 걸 모르면 곤란합니다 */}
          <span className="min-w-0 flex-1 text-[11px] leading-tight text-[#98A2B3]">
            치과 · 디자인센터 · 배정된 기공소가 함께 봅니다.
          </span>

          <span className="shrink-0 text-[11px] text-[#C4CBD6]">
            {draft.length}/{MAX_LENGTH}
          </span>

          <button
            type="button"
            onClick={send}
            disabled={busy || !draft.trim()}
            className="shrink-0 rounded-md bg-[#1279E8] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
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
            <p className="mt-2 line-clamp-3 rounded-md bg-[#F4F6F9] px-3 py-2 text-[12.5px] text-[#4A5567]">
              {removing.body}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="h-10 flex-1 rounded-md border border-[#DDE2EA] text-[13px] text-[#4A5567] hover:bg-[#F4F6F9]"
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
                className="h-10 flex-1 rounded-md bg-[#D8453F] text-[13px] font-bold text-white hover:bg-[#C13B36] disabled:bg-[#D5DAE2]"
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

/** '08-11 11:10' */
function stamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
