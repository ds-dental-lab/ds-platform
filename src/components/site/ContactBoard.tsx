// =========================================================
// 놓을 위치: src/components/site/ContactBoard.tsx
//
// 홈페이지 문의 목록 (디자인센터 관리자).
//
// ★ 연락처를 눌러서 바로 걸 수 있게 합니다.
//   목록을 보는 이유는 전화를 걸기 위해서입니다. 번호를 손으로
//   옮겨 적게 하면 그만큼 늦어집니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitContactDone } from '@/server/actions/contact-review';
import { KIND_LABEL, SCANNER_LABEL, PAIN_LABEL } from '@/server/domain/contact';
import type { ContactRow } from '@/server/repositories/contact';

export default function ContactBoard({ fresh, done }: { fresh: ContactRow[]; done: ContactRow[] }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [asking, setAsking] = useState<ContactRow | null>(null);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    if (!asking) return;

    setError('');
    setBusy(true);

    const result = await submitContactDone(asking.id, memo);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAsking(null);
    setMemo('');
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[10px] border border-[#E8EBF0] bg-white">
        <header className="flex items-center gap-2 border-b border-[#E8EBF0] px-[18px] py-3.5">
          <h2 className="text-[14px] font-bold text-[#1A2130]">새 문의</h2>
          {fresh.length > 0 && (
            <span className="grid h-[19px] min-w-[19px] place-items-center rounded-full bg-[#D8453F] px-1.5 text-[11px] font-extrabold text-white">
              {fresh.length}
            </span>
          )}
          {refreshing && <span className="text-[13px] text-[#98A2B3]">새로고침 중…</span>}
        </header>

        {fresh.length === 0 ? (
          <p className="px-[18px] py-10 text-center text-[14px] text-[#98A2B3]">
            아직 들어온 문의가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[#F0F2F5]">
            {fresh.map((row) => (
              <li key={row.id} className="px-[18px] py-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <b className="text-[14.5px] font-extrabold text-[#1A2130]">{row.clinicName}</b>
                  {/* ★ 옛 문의에만 있습니다 — 없으면 자리도 안 잡습니다 */}
                  {row.personName && (
                    <span className="text-[14px] text-[#4A5567]">{row.personName}</span>
                  )}
                  {/*
                    ★ 새 문의는 전부 수가표 요청이라 딱지를 안 답니다 —
                      다 같은 딱지면 정보가 아닙니다. 옛 '방문 상담' 만 남깁니다.
                  */}
                  {row.kind === 'visit' && (
                    <span className="rounded bg-[#FDF1E7] px-1.5 py-0.5 text-[12.5px] font-bold text-[#C67717]">
                      {KIND_LABEL[row.kind]}
                    </span>
                  )}
                  <span className="ml-auto text-[13px] tabular-nums text-[#98A2B3]">
                    {row.createdAt.slice(0, 10)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
                  {/* ★ 눌러서 바로 걸립니다 */}
                  <a
                    href={`tel:${row.tel.replace(/\D/g, '')}`}
                    className="font-bold tabular-nums text-[#1279E8] hover:underline"
                  >
                    {row.tel}
                  </a>
                  <a href={`mailto:${row.email}`} className="text-[#4A5567] hover:underline">
                    {row.email}
                  </a>
                </div>

                {/*
                  ★ 전화 걸기 전에 눈에 들어와야 하는 둘 — 스캐너가 있는지,
                    무엇이 불만인지. 이걸 알고 거는 통화와 모르고 거는 통화는
                    첫마디부터 다릅니다. 옛 문의(안 물었던 때)는 안 그립니다.
                */}
                {(row.scanner || row.painPoints.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.scanner && (
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[12.5px] font-semibold text-[#334155]">
                        스캐너 {SCANNER_LABEL[row.scanner]}
                      </span>
                    )}
                    {row.painPoints.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-[#FDF1E7] px-1.5 py-0.5 text-[12.5px] font-semibold text-[#C67717]"
                      >
                        {PAIN_LABEL[p]}
                      </span>
                    ))}
                  </div>
                )}

                {row.message && (
                  <p className="mt-2.5 whitespace-pre-wrap rounded-md bg-[#F8F9FB] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#4A5567]">
                    {row.message}
                  </p>
                )}

                <button
                  onClick={() => {
                    setError('');
                    setMemo('');
                    setAsking(row);
                  }}
                  className="mt-3 h-8 rounded-md border border-[#DDE2EA] px-3 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#12855B] hover:text-[#12855B]"
                >
                  연락 완료로 표시
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[10px] border border-[#E8EBF0] bg-white">
        <header className="border-b border-[#E8EBF0] px-[18px] py-3.5">
          <h2 className="text-[14px] font-bold text-[#1A2130]">처리한 문의</h2>
        </header>

        {done.length === 0 ? (
          <p className="px-[18px] py-10 text-center text-[14px] text-[#98A2B3]">
            아직 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[#F0F2F5]">
            {done.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-[18px] py-3 text-[14px]">
                <b className="font-semibold text-[#1A2130]">{row.clinicName}</b>
                {row.personName && <span className="text-[#7C8595]">{row.personName}</span>}
                <span className="tabular-nums text-[#98A2B3]">{row.tel}</span>
                {row.memo && <span className="text-[#7C8595]">— {row.memo}</span>}
                <span className="ml-auto text-[13px] tabular-nums text-[#98A2B3]">
                  {(row.handledAt ?? row.createdAt).slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-base font-bold text-[#1A2130]">연락 완료로 표시</h3>
            <p className="mt-1.5 text-[14px] text-[#4A5567]">
              {asking.clinicName}
              {asking.personName && ` · ${asking.personName}`}
            </p>

            <label className="mb-1.5 mt-4 block text-[14px] font-semibold text-[#4A5567]">
              메모 (선택)
            </label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              autoFocus
              placeholder="예: 수가표 발송, 다음 주 방문 약속"
              className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-sm outline-none focus:border-[#1279E8]"
            />

            {error && <p className="mt-2 text-[14px] text-[#D8453F]">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setAsking(null)}
                disabled={busy}
                className="rounded border border-[#DDE2EA] px-4 py-2 text-sm text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                onClick={finish}
                disabled={busy}
                className="rounded bg-[#12855B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0E6B49] disabled:bg-[#D5DAE2]"
              >
                {busy ? '처리 중…' : '완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
