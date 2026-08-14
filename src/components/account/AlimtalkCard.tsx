// =========================================================
// 놓을 위치: src/components/account/AlimtalkCard.tsx
//
// 계정정보의 '내 알림톡' 칸. (사용자 요청 2026-08-14)
//
// ★ **자기 것만** 고칩니다. 관리자든 사용자든 똑같습니다.
//   조직 정보와 달리 권한을 안 봅니다 — 자기 번호는 자기가 압니다.
//   그래서 이 카드는 로그인한 모든 사람에게 보입니다.
//
// ★ 대표번호와 헷갈리지 않게 **한 줄로 밝혀 둡니다.**
//   바로 위 칸에 '전화'(청구서에 찍히는 대표번호)가 있어서, 아무 말도
//   없으면 같은 것을 두 번 넣으라는 화면으로 읽힙니다.
//
// ★ 번호를 비우는 것과 끄는 것은 다릅니다.
//   비우면 받을 길이 없어지고, 끄는 것은 번호를 둔 채 잠시 멈추는
//   것입니다(휴가·야간). 번호를 지웠다 다시 넣게 하면 오타가 납니다.
//
// ★ 아직 **안 나갑니다.** 사업자등록·카카오 채널·템플릿 심사가
//   먼저입니다. 그 사실을 화면에 적어 둡니다 — 번호를 넣고 왜 안 오는지
//   찾게 만들면 안 됩니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitAlimtalk } from '@/server/actions/account';
import { formatPhone } from '@/server/domain/alimtalk';

export interface AlimtalkCardProps {
  /** 지금 담겨 있는 번호. 숫자만 (01012345678) */
  phone: string | null;
  on: boolean;
  /** 무슨 일에 오는지 보여 줄 목록 — 이 사람이 속한 자리 기준 */
  events: string[];
  /** 나에게 갈 뻔했던 최근 것들 */
  recent: { title: string; body: string | null; at: string }[];
}

export default function AlimtalkCard({ phone, on, events, recent }: AlimtalkCardProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const [typed, setTyped] = useState(formatPhone(phone));
  const [enabled, setEnabled] = useState(on);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const busy = saving || refreshing;
  const dirty = typed !== formatPhone(phone) || enabled !== on;

  async function save() {
    setError('');
    setSaved(false);
    setSaving(true);

    const result = await submitAlimtalk({ phone: typed, on: enabled });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <section className="mx-auto mt-3.5 max-w-[900px] rounded-lg border border-[#E8EBF0] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E8EBF0] px-6 py-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">내 알림톡</h2>
          <p className="mt-0.5 text-[13px] text-[#98A2B3]">
            내 휴대전화로 받습니다. 위의 <b className="font-semibold">전화</b> 는 청구서에 찍히는
            대표번호라 서로 다릅니다.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saved && !dirty && (
            <span className="text-[13.5px] font-semibold text-[#12855B]">저장했습니다</span>
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="h-10 rounded-md px-5 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#C4CBD6]"
            style={dirty && !busy ? { background: 'var(--brand)' } : undefined}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-5 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <label className="block">
          <span className="text-[13px] font-semibold text-[#4A5567]">알림톡 받을 번호</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="010-1234-5678"
            inputMode="numeric"
            autoComplete="tel"
            className="mt-1.5 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] tabular-nums outline-none focus:border-[#1279E8]"
          />
          <span className="mt-1 block text-[12.5px] text-[#98A2B3]">
            휴대전화만 됩니다. 비우면 안 받습니다.
          </span>
        </label>

        <div>
          <span className="text-[13px] font-semibold text-[#4A5567]">받기</span>

          {/* ★ 번호를 둔 채 잠시 끄는 길입니다 */}
          <label className="mt-1.5 flex h-10 cursor-pointer select-none items-center gap-2.5">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-[17px] w-[17px] cursor-pointer accent-[color:var(--brand)]"
            />
            <span className="text-[13.5px] text-[#1A2130]">
              {enabled ? '받는 중' : '잠시 꺼 둠'}
            </span>
          </label>

          <p className="mt-1 text-[12.5px] leading-relaxed text-[#98A2B3]">
            {events.length > 0 ? (
              <>
                이럴 때 옵니다 — <b className="font-semibold text-[#4A5567]">{events.join(' · ')}</b>
              </>
            ) : (
              '이 자리에는 아직 오는 알림톡이 없습니다.'
            )}
          </p>
        </div>
      </div>

      {error && <p className="px-6 pb-4 text-[13.5px] text-[#D8453F]">{error}</p>}

      {/*
        ★ 쌓인 줄을 보여 줍니다.
          아직 안 나가므로, **문구가 맞는지·나에게 오는 게 맞는지** 를
          눈으로 볼 방법이 이것뿐입니다. 나중에 실제로 나가기 시작하면
          이 목록이 그대로 '받은 내역' 이 됩니다.
      */}
      {recent.length > 0 && (
        <div className="border-t border-[#E8EBF0] px-6 py-4">
          <h3 className="text-[13px] font-bold text-[#4A5567]">
            나에게 갈 뻔한 것 <span className="font-semibold text-[#98A2B3]">최근 {recent.length}건</span>
          </h3>

          <ul className="mt-2 divide-y divide-[#F0F2F5]">
            {recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-2 text-[13px]">
                <b className="font-semibold text-[#1A2130]">{r.title}</b>
                <span className="text-[#4A5567]">{r.body}</span>
                <span className="ml-auto shrink-0 tabular-nums text-[12.5px] text-[#C4CBD6]">
                  {r.at.slice(5, 16).replace('T', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ★ 아직 안 나갑니다. 넣고 나서 왜 안 오는지 찾게 만들면 안 됩니다 */}
      <p className="border-t border-[#E8EBF0] bg-[#FDF7EC] px-6 py-3 text-[13px] leading-relaxed text-[#8A5A00]">
        아직 실제로 나가지 않습니다. 사업자등록과 카카오톡 채널이 준비되면 그때부터 이 번호로
        갑니다. 지금 넣어 두시면 됩니다.
      </p>
    </section>
  );
}
