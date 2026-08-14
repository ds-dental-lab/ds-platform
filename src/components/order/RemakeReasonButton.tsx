// =========================================================
// 놓을 위치: src/components/order/RemakeReasonButton.tsx
//
// 리메이크 사유 고르개. (사용자 요청 2026-08-14 — 시안 스크린샷 그대로)
//
//   ┌ 왼쪽 갈래 목록 ┬ 사유 카드 (2열) ┬ 선택된 사유 ┐
//   └────────────────┴─────────────────┴─────────────┘
//                                        취소   확인
//
// ★ **선택 사항입니다.** 안 적어도 아무 일도 안 일어납니다.
//   의무로 만들면 빨리 넘기려고 아무거나 고릅니다 — 그렇게 모인
//   숫자는 없느니만 못합니다.
//
// ★ 중복으로 고릅니다. 리메이크 하나에 원인이 둘 이상인 일이 흔합니다.
//
// ★ 이름 옆의 단추가 **적혔는지 아닌지를 겸합니다.**
//   따로 표시를 하나 더 달면 둘이 어긋날 자리가 생깁니다.
//   비어 있으면 흐리게, 적혀 있으면 파랗게 + 개수.
//
// ★ 고르는 중에는 아무것도 저장 안 합니다. '확인' 을 눌러야 갑니다.
//   취소로 나가면 원래대로입니다 — 잘못 눌렀을 때 되돌릴 길입니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  REMAKE_REASON_GROUPS,
  OTHER_CODE,
  NOTE_MAX,
  findReason,
} from '@/server/domain/remake-reason';
import { submitRemakeReasons } from '@/server/actions/remake-reason';

export interface RemakeReasonButtonProps {
  orderId: string;
  /** 지금 적혀 있는 것 */
  codes: string[];
  note: string | null;
  /** 디자인센터 사람만 고칠 수 있습니다. 아니면 단추가 안 나옵니다 */
  canEdit: boolean;
}

export default function RemakeReasonButton({
  orderId,
  codes,
  note,
  canEdit,
}: RemakeReasonButtonProps) {
  const [open, setOpen] = useState(false);

  if (!canEdit) return null;

  const filled = codes.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={filled ? codes.join(' · ') : '리메이크 사유를 적어 두면 통계에 쌓입니다'}
        className={
          'rounded-md border px-2 py-[3px] text-[12.5px] font-bold transition ' +
          (filled
            ? 'border-[#BFD5F5] bg-[#F2F7FE] text-[#1279E8] hover:bg-[#E7EEFA]'
            : 'border-[#DDE2EA] text-[#98A2B3] hover:bg-[#F4F6F9] hover:text-[#4A5567]')
        }
      >
        리메이크 사유{filled ? ` ${codes.length}` : ''}
      </button>

      {open && (
        <ReasonDialog
          orderId={orderId}
          codes={codes}
          note={note}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------- 고르는 창 ----------

function ReasonDialog({
  orderId,
  codes,
  note,
  onClose,
}: {
  orderId: string;
  codes: string[];
  note: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const [group, setGroup] = useState(REMAKE_REASON_GROUPS[0].key);
  const [picked, setPicked] = useState<string[]>(codes);
  const [typed, setTyped] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const busy = saving || refreshing;
  const current = REMAKE_REASON_GROUPS.find((g) => g.key === group) ?? REMAKE_REASON_GROUPS[0];

  function toggle(code: string) {
    setPicked((was) => (was.includes(code) ? was.filter((c) => c !== code) : [...was, code]));
  }

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitRemakeReasons({ orderId, codes: picked, note: typed });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="리메이크 사유"
    >
      <div className="flex max-h-[86vh] w-full max-w-[1080px] flex-col rounded-xl bg-white shadow-2xl">
        <h2 className="px-7 pb-4 pt-6 text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">
          리메이크 사유
        </h2>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 border-t border-[#E8EBF0] sm:grid-cols-[164px_minmax(0,1fr)_260px]">
          {/* ---------- 갈래 ---------- */}
          <nav className="flex gap-1 overflow-x-auto border-b border-[#E8EBF0] p-3.5 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
            {REMAKE_REASON_GROUPS.map((g) => {
              const on = g.key === current.key;
              const n = picked.filter((c) => c.startsWith(g.key + '-')).length;

              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroup(g.key)}
                  className={
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-left text-[13.5px] font-bold transition ' +
                    (on
                      ? 'bg-[#1279E8] text-white'
                      : 'text-[#1279E8] hover:bg-[#F2F7FE]')
                  }
                >
                  {g.name}
                  {/* ★ 다른 갈래에 고른 게 있다는 것을 알려 줍니다.
                        안 그러면 옮겨 다니다 자기가 뭘 골랐는지 잊습니다 */}
                  {n > 0 && (
                    <span
                      className={
                        'rounded px-1 text-[11px] font-extrabold ' +
                        (on ? 'bg-white/25 text-white' : 'bg-[#E7EEFA] text-[#1279E8]')
                      }
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* ---------- 사유 카드 ---------- */}
          <div className="min-h-0 overflow-y-auto p-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              {current.reasons.map((r) => {
                const on = picked.includes(r.code);
                const other = r.code === OTHER_CODE;

                return (
                  <div
                    key={r.code}
                    className={
                      'rounded-lg border p-3.5 transition ' +
                      (on ? 'border-[#1279E8] bg-[#F5F9FF]' : 'border-[#E8EBF0] bg-white')
                    }
                  >
                    <div className="flex items-center gap-2">
                      <b className="text-[13.5px] font-extrabold text-[#1279E8]">{r.code}</b>
                      <span className="rounded bg-[#F0F2F5] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#4A5567]">
                        {r.tag}
                      </span>
                    </div>

                    {other ? (
                      /* ★ 기타는 글을 적어야 고른 것이 됩니다.
                            빈 채로 두면 저장할 때 조용히 빠집니다 */
                      <input
                        value={typed}
                        maxLength={NOTE_MAX}
                        onChange={(e) => {
                          setTyped(e.target.value);
                          const has = picked.includes(OTHER_CODE);
                          if (e.target.value.trim() && !has) toggle(OTHER_CODE);
                          if (!e.target.value.trim() && has) toggle(OTHER_CODE);
                        }}
                        placeholder="기타 사유를 입력해주세요"
                        className="mt-2.5 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle(r.code)}
                        className="mt-2 block w-full text-left text-[13.5px] leading-relaxed text-[#1A2130]"
                      >
                        {r.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------- 고른 것 ---------- */}
          <div className="min-h-0 overflow-y-auto border-t border-[#E8EBF0] p-3.5 sm:border-l sm:border-t-0">
            <h3 className="border-b-2 border-[#1279E8] pb-2 text-[14px] font-bold text-[#1A2130]">
              선택된 사유 ({picked.length})
            </h3>

            {picked.length === 0 ? (
              <p className="mt-6 text-center text-[13px] text-[#98A2B3]">선택된 사유가 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {picked.map((code) => {
                  const r = findReason(code);
                  return (
                    <li
                      key={code}
                      className="rounded-lg border border-[#BFD5F5] bg-[#F2F7FE] p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <b className="text-[12.5px] font-extrabold text-[#1279E8]">{code}</b>
                        <span className="text-[11.5px] font-semibold text-[#4A5567]">{r?.tag}</span>

                        <button
                          type="button"
                          aria-label={`${code} 빼기`}
                          onClick={() => {
                            if (code === OTHER_CODE) setTyped('');
                            toggle(code);
                          }}
                          className="ml-auto text-[15px] leading-none text-[#C4383A]"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-[#1A2130]">
                        {code === OTHER_CODE ? typed : r?.label}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {error && <p className="px-7 pt-3 text-[13.5px] text-[#D8453F]">{error}</p>}

        {/* ---------- 바닥 ---------- */}
        <div className="flex items-center gap-2 border-t border-[#E8EBF0] px-7 py-4">
          {/* ★ 다 빼고 확인하면 지워진다는 것을 알려 줍니다.
                선택 사항이라 '빼기' 도 정상적인 일입니다 */}
          {picked.length === 0 && codes.length > 0 && (
            <span className="text-[13px] text-[#98A2B3]">확인을 누르면 적어 둔 사유가 지워집니다.</span>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="ml-auto h-10 rounded-md border border-[#DDE2EA] px-5 text-[13.5px] font-bold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-10 rounded-md bg-[#1279E8] px-6 text-[13.5px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
          >
            {saving ? '저장 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
