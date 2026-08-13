// =========================================================
// 놓을 위치: src/components/notice/NoticeDialog.tsx
//
// 공지 쓰기 · 고치기.
//
// ★ 저장 버튼이 둘입니다 — '임시저장' 과 '게시'.
//   공지는 여러 번 고쳐 씁니다. 하나뿐이면 쓰다 만 글이 그대로 치과
//   화면에 뜨고, 그것이 곧 사고입니다. 나가는 순간을 사람이 정합니다.
//
// ★ 이미 나간 글을 고칠 때는 '게시' 가 아니라 '저장' 입니다.
//   똑같이 published_at 을 지키므로 목록 차례가 안 바뀝니다 —
//   오타 하나 고쳤다고 지난달 공지가 맨 위로 올라오면 안 됩니다.
//   내리려면 '내리기' 를 눌러 임시저장으로 되돌립니다.
// =========================================================

'use client';

import { useState } from 'react';
import { submitNotice } from '@/server/actions/notice';
import {
  AUDIENCE_LABEL,
  AUDIENCE_OPTIONS,
  MAX_TITLE,
  MAX_BODY,
  checkNotice,
  type NoticeAudience,
} from '@/server/domain/notice';
import type { NoticeRow } from '@/server/repositories/notice';

export interface NoticeDialogProps {
  /** null 이면 새 글 */
  notice: NoticeRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function NoticeDialog({ notice, onClose, onSaved }: NoticeDialogProps) {
  const [title, setTitle] = useState(notice?.title ?? '');
  const [body, setBody] = useState(notice?.body ?? '');
  const [audience, setAudience] = useState<NoticeAudience>(notice?.audience ?? 'all');
  const [isPinned, setIsPinned] = useState(notice?.isPinned ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const wasPublished = Boolean(notice?.publishedAt);

  async function save(publish: boolean) {
    setError('');

    // 서버가 다시 봅니다. 여기서 먼저 보는 것은 헛걸음을 줄이려는 것뿐입니다
    const verdict = checkNotice(title, body);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setSaving(true);

    const result = await submitNotice({
      id: notice?.id,
      title,
      body,
      audience,
      isPinned,
      publish,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-center border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold tracking-tight text-[#1A2130]">
            {notice ? '공지 고치기' : '공지 쓰기'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto grid h-7 w-7 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9]"
          >
            ✕
          </button>
        </header>

        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="text-[13.5px] font-semibold text-[#4A5567]">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="예) 8월 15일 광복절 배송 안내"
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
          </label>

          <label className="block">
            <div className="flex items-baseline">
              <span className="text-[13.5px] font-semibold text-[#4A5567]">내용</span>
              <span className="ml-auto text-[12.5px] tabular-nums text-[#98A2B3]">
                {body.length} / {MAX_BODY}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              rows={8}
              placeholder="줄바꿈은 그대로 보입니다."
              className="mt-1 w-full resize-y rounded-md border border-[#DDE2EA] px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-[#1279E8]"
            />
          </label>

          {/* ★ 받는 쪽을 고릅니다. 모두에게 보내는 버릇이 들면 아무도 안 읽습니다 */}
          <div>
            <span className="text-[13.5px] font-semibold text-[#4A5567]">받는 곳</span>
            <div className="mt-1.5 flex gap-1.5">
              {AUDIENCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAudience(option)}
                  aria-pressed={audience === option}
                  className={
                    'h-9 flex-1 rounded-md border text-[13.5px] font-semibold ' +
                    (audience === option
                      ? 'border-[#1279E8] bg-[#E7EEFA] text-[#1279E8]'
                      : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
                  }
                >
                  {AUDIENCE_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 accent-[#1279E8]"
            />
            <span className="text-[13.5px] text-[#4A5567]">
              목록 맨 위에 고정합니다
            </span>
          </label>

          {error && <p className="text-[13.5px] font-semibold text-[#D8453F]">{error}</p>}
        </div>

        <footer className="flex gap-2 border-t border-[#E8EBF0] px-5 py-3.5">
          {/* 이미 나간 글은 '내리기' 가 임시저장으로 되돌립니다 */}
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving}
            className="h-10 rounded-md border border-[#DDE2EA] px-4 text-[14px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:opacity-60"
          >
            {wasPublished ? '내리기' : '임시저장'}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto h-10 rounded-md px-4 text-[14px] font-semibold text-[#98A2B3] hover:text-[#4A5567] disabled:opacity-60"
          >
            취소
          </button>

          <button
            type="button"
            onClick={() => save(true)}
            disabled={saving}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[14px] font-bold text-white hover:bg-[#0F68C9] disabled:opacity-60"
          >
            {saving ? '저장 중…' : wasPublished ? '저장' : '게시'}
          </button>
        </footer>
      </div>
    </div>
  );
}
