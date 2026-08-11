// =========================================================
// 놓을 위치: src/components/notice/NoticeBoard.tsx
//
// 공지사항 게시판. 세 섹터가 같은 화면을 나눠 씁니다.
//
// ★ 쓰기·고치기·지우기는 디자인센터만 (canWrite).
//   버튼을 숨기는 것은 UX 일 뿐이고, 실제로 막는 것은 서버와 DB 정책입니다.
//
// ★ 상세 화면을 따로 두지 않습니다.
//   공지는 대개 서너 줄입니다. 목록에서 펼쳐 읽으면 뒤로가기를 안 해도
//   되고, 여러 건을 잇달아 읽을 때 화면이 안 튑니다.
//
// ★ 임시저장은 글쓴이에게만 보입니다 (RLS 가 가릅니다).
//   목록에서 '임시저장' 딱지를 달아, 나간 글과 헷갈리지 않게 합니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeNotice } from '@/server/actions/notice';
import { AUDIENCE_LABEL } from '@/server/domain/notice';
import type { NoticeRow } from '@/server/repositories/notice';
import NoticeDialog from '@/components/notice/NoticeDialog';

export interface NoticeBoardProps {
  rows: NoticeRow[];
  /** 디자인센터인가 */
  canWrite: boolean;
}

export default function NoticeBoard({ rows, canWrite }: NoticeBoardProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const [open, setOpen] = useState<NoticeRow | 'new' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(rows[0]?.id ?? null);
  const [asking, setAsking] = useState<NoticeRow | null>(null);
  const [error, setError] = useState('');

  async function remove(notice: NoticeRow) {
    setAsking(null);
    setError('');

    const result = await removeNotice(notice.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-lg border border-[#E8EBF0] bg-white">
      <header className="flex items-center gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
        <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">공지사항</h1>
        <span className="text-[12.5px] text-[#98A2B3]">{rows.length}건</span>

        {canWrite && (
          <button
            type="button"
            onClick={() => setOpen('new')}
            disabled={refreshing}
            className="ml-auto h-8 rounded-md bg-[#1279E8] px-3.5 text-[12.5px] font-bold text-white hover:bg-[#0F68C9] disabled:opacity-60"
          >
            공지 쓰기
          </button>
        )}
      </header>

      {error && <p className="px-5 pt-3 text-[12.5px] text-[#D8453F]">{error}</p>}

      {rows.length === 0 ? (
        <p className="py-24 text-center text-[13px] text-[#98A2B3]">
          {canWrite ? '아직 쓴 공지가 없습니다. 오른쪽 위에서 첫 공지를 써 보세요.' : '등록된 공지가 없습니다.'}
        </p>
      ) : (
        <ul className="divide-y divide-[#F0F2F5]">
          {rows.map((notice) => {
            const isOpen = expanded === notice.id;
            const draft = notice.publishedAt === null;

            return (
              <li key={notice.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : notice.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-5 py-3 text-left hover:bg-[#F8F9FB]"
                >
                  {notice.isPinned && (
                    <span
                      title="위에 고정"
                      className="shrink-0 rounded bg-[#FDECEA] px-1.5 py-0.5 text-[11px] font-bold text-[#D8453F]"
                    >
                      고정
                    </span>
                  )}

                  {draft && (
                    <span className="shrink-0 rounded bg-[#F0F3F7] px-1.5 py-0.5 text-[11px] font-bold text-[#4A5567]">
                      임시저장
                    </span>
                  )}

                  {/* 받는 쪽이 '전체' 가 아닐 때만 보여 줍니다 — 대부분은 전체입니다 */}
                  {notice.audience !== 'all' && (
                    <span className="shrink-0 rounded bg-[#E7EEFA] px-1.5 py-0.5 text-[11px] font-semibold text-[#1279E8]">
                      {AUDIENCE_LABEL[notice.audience]}
                    </span>
                  )}

                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#1A2130]">
                    {notice.title}
                  </span>

                  <span className="shrink-0 text-[12px] tabular-nums text-[#98A2B3]">
                    {shortDate(notice.publishedAt ?? notice.createdAt)}
                  </span>
                </button>

                {isOpen && (
                  <div className="bg-[#FBFCFD] px-5 pb-4 pt-1">
                    {/* 줄바꿈을 그대로 살립니다 — 쓴 사람이 나눠 놓은 대로 읽힙니다 */}
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#4A5567]">
                      {notice.body}
                    </p>

                    <p className="mt-3 text-[11.5px] text-[#98A2B3]">
                      {notice.authorName}
                      {draft && ' · 아직 안 나갔습니다'}
                    </p>

                    {canWrite && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOpen(notice)}
                          disabled={refreshing}
                          className="h-8 rounded-md border border-[#DDE2EA] px-3 text-[12px] font-semibold text-[#4A5567] hover:bg-white disabled:opacity-60"
                        >
                          고치기
                        </button>
                        <button
                          type="button"
                          onClick={() => setAsking(notice)}
                          disabled={refreshing}
                          className="h-8 rounded-md border border-[#F3C6C6] px-3 text-[12px] font-semibold text-[#D8453F] hover:bg-[#FDECEA] disabled:opacity-60"
                        >
                          지우기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <NoticeDialog
          notice={open === 'new' ? null : open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* ★ 지우면 치과·기공소 화면에서도 사라집니다. 한 번 묻습니다 */}
      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
            <div className="px-7 pb-6 pt-7">
              <h3 className="text-[15px] font-bold tracking-tight text-[#1A2130]">
                이 공지를 지울까요?
              </h3>
              <p className="mt-2 break-words text-[12.5px] text-[#4A5567]">{asking.title}</p>
              <p className="mt-1.5 text-[12px] text-[#98A2B3]">
                치과·기공소 화면에서도 사라집니다.
              </p>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => remove(asking)}
                className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C13B36]"
              >
                지우기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** '2026-08-12T…' → '2026-08-12' */
function shortDate(iso: string): string {
  return iso.slice(0, 10);
}
