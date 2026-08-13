// =========================================================
// 놓을 위치: src/components/signup/SignupBoard.tsx
//
// 가입승인 화면. 디자인센터 관리자만 봅니다.
//
// ★ 기다리는 것이 위, 끝난 것이 아래입니다.
//   한 표에 섞으면 새 신청이 지난 기록에 묻힙니다 — 그동안 그 치과는
//   아무것도 못 하고 기다립니다.
//
// ★ 승인은 되돌릴 수 없습니다.
//   누르는 순간 조직이 서고 거래관계가 생기고 그 사람이 관리자가 됩니다.
//   그래서 한 번 묻습니다. 반려도 사유를 받느라 어차피 한 번 멈춥니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitApproveSignup, submitRejectSignup } from '@/server/actions/signup';
import { SECTOR_LABEL, STATUS_LABEL } from '@/server/domain/signup';
import type { SignupRow } from '@/server/repositories/signup';

export interface SignupBoardProps {
  pending: SignupRow[];
  handled: SignupRow[];
}

type Asking = { row: SignupRow; mode: 'approve' | 'reject' } | null;

export default function SignupBoard({ pending, handled }: SignupBoardProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    if (!asking) return;

    setError('');
    setBusy(true);

    const result =
      asking.mode === 'approve'
        ? await submitApproveSignup(asking.row.id)
        : await submitRejectSignup(asking.row.id, reason);

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAsking(null);
    setReason('');
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[10px] border border-[#E8EBF0] bg-white">
        <header className="flex items-center gap-2 border-b border-[#E8EBF0] px-[18px] py-3.5">
          <h2 className="text-[14px] font-bold text-[#1A2130]">승인 대기</h2>
          {pending.length > 0 && (
            <span className="grid h-[19px] min-w-[19px] place-items-center rounded-full bg-[#D8453F] px-1.5 text-[11px] font-extrabold text-white">
              {pending.length}
            </span>
          )}
          {refreshing && <span className="text-[13px] text-[#98A2B3]">새로고침 중…</span>}
        </header>

        {pending.length === 0 ? (
          <p className="px-[18px] py-8 text-center text-[14px] text-[#98A2B3]">
            기다리는 신청이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-[14px]">
              <thead>
                <tr className="border-b border-[#E8EBF0] text-left text-[13px] font-semibold text-[#7C8595]">
                  <Th>신청일</Th>
                  <Th>구분</Th>
                  <Th>기관 이름</Th>
                  <Th>담당자</Th>
                  <Th>이메일</Th>
                  <Th className="text-right">처리</Th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => (
                  <tr key={row.id} className="border-b border-[#F1F3F7] last:border-0">
                    <Td className="tabular-nums text-[#4A5567]">{day(row.createdAt)}</Td>
                    <Td>
                      <span
                        className={
                          'rounded px-1.5 py-0.5 text-[12.5px] font-bold ' +
                          (row.orgType === 'clinic'
                            ? 'bg-[#EAF2FE] text-[#1279E8]'
                            : 'bg-[#FDF1E7] text-[#C67717]')
                        }
                      >
                        {SECTOR_LABEL[row.orgType]}
                      </span>
                    </Td>
                    <Td className="font-bold text-[#1A2130]">{row.orgName}</Td>
                    <Td className="text-[#4A5567]">{row.name}</Td>
                    <Td className="text-[#4A5567]">{row.email}</Td>
                    <Td className="text-right">
                      <span className="flex justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setError('');
                            setReason('');
                            setAsking({ row, mode: 'reject' });
                          }}
                          className="rounded-md border border-[#DDE2EA] px-3 py-1.5 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#D8453F] hover:text-[#D8453F]"
                        >
                          반려
                        </button>
                        <button
                          onClick={() => {
                            setError('');
                            setAsking({ row, mode: 'approve' });
                          }}
                          className="rounded-md bg-[#1279E8] px-3.5 py-1.5 text-[13.5px] font-bold text-white hover:bg-[#1554C8]"
                        >
                          승인
                        </button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[#E8EBF0] bg-white">
        <header className="border-b border-[#E8EBF0] px-[18px] py-3.5">
          <h2 className="text-[14px] font-bold text-[#1A2130]">처리한 신청</h2>
        </header>

        {handled.length === 0 ? (
          <p className="px-[18px] py-8 text-center text-[14px] text-[#98A2B3]">
            아직 처리한 신청이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-[14px]">
              <thead>
                <tr className="border-b border-[#E8EBF0] text-left text-[13px] font-semibold text-[#7C8595]">
                  <Th>처리일</Th>
                  <Th>구분</Th>
                  <Th>기관 이름</Th>
                  <Th>담당자</Th>
                  <Th>결과</Th>
                  <Th>사유 · 처리자</Th>
                </tr>
              </thead>
              <tbody>
                {handled.map((row) => (
                  <tr key={row.id} className="border-b border-[#F1F3F7] last:border-0">
                    <Td className="tabular-nums text-[#4A5567]">{day(row.reviewedAt)}</Td>
                    <Td className="text-[#4A5567]">{SECTOR_LABEL[row.orgType]}</Td>
                    <Td className="font-semibold text-[#1A2130]">{row.orgName}</Td>
                    <Td className="text-[#4A5567]">{row.name}</Td>
                    <Td>
                      <span
                        className={
                          'font-bold ' +
                          (row.status === 'approved' ? 'text-[#12855B]' : 'text-[#D8453F]')
                        }
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </Td>
                    <Td className="text-[#7C8595]">
                      {row.rejectReason && <span>{row.rejectReason} · </span>}
                      {row.reviewedBy || '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-base font-bold text-[#1A2130]">
              {asking.mode === 'approve' ? '가입을 승인합니다' : '가입을 반려합니다'}
            </h3>

            <p className="mt-1.5 text-[14px] leading-relaxed text-[#4A5567]">
              <b className="font-bold text-[#1A2130]">{asking.row.orgName}</b> (
              {SECTOR_LABEL[asking.row.orgType]}) · {asking.row.name}
            </p>

            {asking.mode === 'approve' ? (
              /* ★ 무슨 일이 벌어지는지 미리 적습니다. 되돌릴 수 없습니다 */
              <p className="mt-4 rounded border border-[#DDE7F7] bg-[#F5F9FF] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#31517E]">
                승인하면 <b>{asking.row.orgName}</b> 이(가) 거래처로 등록되고, {asking.row.name}{' '}
                님이 그 기관의 <b>관리자</b>가 됩니다. 되돌릴 수 없습니다.
              </p>
            ) : (
              <>
                <label className="mb-1.5 mt-4 block text-[14px] font-semibold text-[#4A5567]">
                  반려 사유
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="신청한 분에게 그대로 보입니다."
                  className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-sm outline-none focus:border-[#1279E8]"
                />
              </>
            )}

            {error && <p className="mt-2 text-[14px] text-[#D8453F]">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setAsking(null);
                  setError('');
                }}
                disabled={busy}
                className="rounded border border-[#DDE2EA] px-4 py-2 text-sm text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                onClick={run}
                disabled={busy || (asking.mode === 'reject' && !reason.trim())}
                className={
                  'rounded px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D5DAE2] ' +
                  (asking.mode === 'approve'
                    ? 'bg-[#1279E8] hover:bg-[#1554C8]'
                    : 'bg-[#D8453F] hover:bg-[#B7332E]')
                }
              >
                {busy ? '처리 중…' : asking.mode === 'approve' ? '승인' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-[18px] py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-[18px] py-3 ${className}`}>{children}</td>;
}

/** '2026-08-12' 로 보여 줍니다. 시각까지는 필요 없습니다 */
function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}
