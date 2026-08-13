// =========================================================
// 놓을 위치: src/components/order/PickupCard.tsx
//
// 주문상세의 수거 줄. (설계서 §4.6, Q-4)
//
// ★ 세 섹터가 같은 줄을 봅니다 (사용자 결정 2026-08-13).
//   치과는 **상태만**, 물건을 받는 기공소(자사 제작이면 디자인센터)에게만
//   버튼이 붙습니다. 누가 누를 수 있는지는 domain/pickup 이 정하고
//   화면은 받아 쓰기만 합니다.
//
// ★ '수거완료' 는 물건을 실제로 받아봤다는 뜻입니다.
//   그래서 누르면 수거만 닫는 게 아니라 제작 단계까지 넘어갑니다.
//
// ★ 상자 안에 상자를 두지 않습니다 (사용자 지적 2026-08-13 — "보기 불편").
//   전에는 노란 상자 안에 흰 상자가 또 있고 안내문이 세 줄이었습니다.
//   한 줄에 **무엇을 · 어디서 · 어떤 상태로**, 오른쪽 끝에 버튼 하나.
//   안내는 아직 안 받은 건이 있을 때만 한 줄로 답니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitPickupComplete } from '@/server/actions/pickup';
import { PICKUP_KIND_LABEL, type PickupRequestRow } from '@/lib/format/pickup';

export interface PickupCardProps {
  pickups: PickupRequestRow[];
  /**
   * 이 사람이 물건을 받는 쪽인가.
   *
   * ★ 화면에서 감추는 것은 안내일 뿐입니다. 실제로 막는 곳은
   *   services/pickup 과 pickup_update 정책입니다.
   */
  canComplete: boolean;
}

export default function PickupCard({ pickups, canComplete }: PickupCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (pickups.length === 0) return null;

  const waiting = pickups.filter((p) => p.status === 'open' || p.status === 'assigned');
  const busy = savingId !== null || pending;

  async function handleComplete(pickupId: string) {
    setError('');
    setSavingId(pickupId);

    const result = await submitPickupComplete(pickupId);
    setSavingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <section
      className={
        'rounded-[9px] border ' +
        (waiting.length > 0 ? 'border-[#EFD9A6] bg-[#FDF8EC]' : 'border-[#E8EBF0] bg-white')
      }
    >
      {/* ---------- 줄들 ---------- */}
      <ul className="divide-y divide-[#00000010]">
        {pickups.map((pickup) => {
          const open = pickup.status === 'open' || pickup.status === 'assigned';
          const kind = PICKUP_KIND_LABEL[pickup.kind] ?? pickup.kind;

          return (
            <li
              key={pickup.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
            >
              {/* 무엇을 가져가는가 — 제일 먼저 읽혀야 합니다 */}
              <b
                className={
                  'text-[13.5px] font-bold ' + (open ? 'text-[#8A6212]' : 'text-[#4A5567]')
                }
              >
                {kind} 수거
              </b>

              <span
                className={
                  'rounded-full px-2.5 py-[3px] text-[11.5px] font-bold ' +
                  (open ? 'bg-white text-[#C77700]' : 'bg-[#F0F2F5] text-[#98A2B3]')
                }
              >
                {open ? '아직 안 받음' : '받았습니다'}
              </span>

              {/* 왜인지 — 요청사항. 좁아지면 줄임표로 접힙니다 */}
              {pickup.memo && (
                <span
                  title={pickup.memo}
                  className="min-w-0 flex-1 truncate text-[12.5px] text-[#4A5567]"
                >
                  {pickup.memo}
                </span>
              )}

              {!pickup.memo && <span className="min-w-0 flex-1" />}

              {open && canComplete && (
                <button
                  onClick={() => handleComplete(pickup.id)}
                  disabled={busy}
                  className="shrink-0 rounded-md bg-[#C77700] px-4 py-[7px] text-[12.5px] font-bold text-white hover:bg-[#A96400] disabled:cursor-not-allowed disabled:bg-[#D5DAE2]"
                >
                  {savingId === pickup.id ? '처리 중…' : '수거완료'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* ---------- 안내 한 줄 ---------- */}
      {waiting.length > 0 && (
        <p className="border-t border-[#00000010] px-4 py-2 text-[11.5px] leading-relaxed text-[#8A6212]">
          {canComplete ? (
            <>
              택배사에 수거를 접수해 주세요 — 공휴일·일요일을 뺀 다음날 오전이 기준입니다.
              물건을 받으신 뒤 <b>수거완료</b>를 누르면 제작이 시작됩니다.
            </>
          ) : (
            /*
              ★ 치과에는 '기다리는 중' 이라고만 적습니다.
                누를 것이 없는 사람에게 "누르면 제작이 시작됩니다" 를
                읽히면, 자기가 눌러야 하는 줄 알고 버튼을 찾습니다.
            */
            <>보철물·인상체를 기공소가 가져가면 제작이 시작됩니다.</>
          )}
        </p>
      )}

      {error && (
        <p className="border-t border-[#00000010] px-4 py-2 text-[12px] font-semibold text-[#D8453F]">
          {error}
        </p>
      )}
    </section>
  );
}
