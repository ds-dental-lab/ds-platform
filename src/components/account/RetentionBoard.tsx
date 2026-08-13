// =========================================================
// 놓을 위치: src/components/account/RetentionBoard.tsx
//
// 보관기간과 파기. 관리자만 봅니다.
//
// ★ 기간을 제가 정해 두지 않았습니다.
//   얼마나 보관할지는 법과 그 조직의 판단입니다. 화면은 **제안**과
//   **정하기 전에 알아야 할 것**을 함께 보여 주고, 안 정하면
//   아무것도 안 지웁니다.
//
// ★ 누르기 전에 몇 건인지 보여 줍니다.
//   "몇 건 지워집니다" 없이 버튼만 두면 아무도 안 누르거나 아무 생각
//   없이 누릅니다. 둘 다 나쁩니다.
//
// ★ 되돌릴 수 없다고 크게 적습니다.
//   여기서 지운 것은 저장소에서도 사라집니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitKeepDays, submitPurge } from '@/server/actions/retention';
import {
  RETENTION_META,
  canPurge,
  formatDays,
  type RetentionPlan,
} from '@/server/domain/retention';
import type { RetentionBoard as Board } from '@/server/repositories/retention';

export default function RetentionBoard({ board }: { board: Board }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState<RetentionPlan | null>(null);

  const working = busy || refreshing;

  async function purge(plan: RetentionPlan) {
    setAsking(null);
    setError('');
    setNote('');
    setBusy(true);

    const result = await submitPurge(plan.target);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote(
      `${RETENTION_META[plan.target].label} ${result.removed}건을 파기했습니다.` +
        (result.left > 0 ? ` 아직 ${result.left}건 남았습니다 — 다시 눌러 주세요.` : ''),
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <header className="border-b border-[#E8EBF0] px-5 py-3.5">
          <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">보관기간과 파기</h1>
        </header>

        {/* ★ 왜 이 화면이 있는지 먼저 말합니다 */}
        <p className="border-b border-[#E8EBF0] bg-[#FBFCFD] px-5 py-3 text-[13px] leading-relaxed text-[#98A2B3]">
          여태 <b className="font-semibold text-[#4A5567]">아무것도 진짜로 지워지지 않았습니다</b> —
          지웠다고 표시만 하고 저장소의 덩어리와 열람 기록은 그대로 쌓입니다. 여기서 기간을
          정하고 직접 누르면 그때 지워집니다. <b className="font-semibold text-[#B3312C]">저절로
          돌지 않습니다.</b>
        </p>

        {error && (
          <p className="border-b border-[#F3C6C6] bg-[#FDECEA] px-5 py-2.5 text-[13.5px] font-semibold text-[#B3312C]">
            {error}
          </p>
        )}
        {note && (
          <p className="border-b border-[#E8EBF0] bg-[#E7EEFA] px-5 py-2.5 text-[13.5px] font-semibold text-[#1279E8]">
            {note}
          </p>
        )}

        <ul className="divide-y divide-[#F0F2F5]">
          {board.plans.map((plan) => (
            <Row
              key={plan.target}
              plan={plan}
              disabled={working}
              onSaved={() => startTransition(() => router.refresh())}
              onError={setError}
              onPurge={() => setAsking(plan)}
            />
          ))}
        </ul>
      </section>

      {/* ---------- 파기 기록 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <header className="flex items-baseline gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">파기 기록</h2>
          <span className="text-[12.5px] text-[#98A2B3]">
            고치거나 지울 수 없습니다
          </span>
        </header>

        {board.runs.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#98A2B3]">아직 파기한 적이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-[#F0F2F5]">
            {board.runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-baseline gap-2 px-5 py-2.5 text-[13.5px]">
                <span className="tabular-nums text-[#98A2B3]">{run.ranAt.slice(0, 16).replace('T', ' ')}</span>
                <span className="font-semibold text-[#1A2130]">
                  {RETENTION_META[run.target].label}
                </span>
                <span className="text-[#4A5567]">
                  {run.removed}건 · {formatDays(run.keepDays)} 지난 것
                </span>
                <span className="ml-auto text-[12.5px] text-[#98A2B3]">{run.ranByName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ★ 되돌릴 수 없습니다. 몇 건인지 다시 적고 묻습니다 */}
      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[380px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
            <div className="px-7 pb-6 pt-7">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FDECEA]">
                <b className="text-[22px] font-extrabold leading-none text-[#D8453F]">!</b>
              </span>

              <h3 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A2130]">
                {RETENTION_META[asking.target].label} {asking.due}건을 지울까요?
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#4A5567]">
                {formatDays(asking.keepDays)}이 지난 것입니다.
                <br />
                저장소에서도 사라지고 <b className="font-bold text-[#D8453F]">되돌릴 수 없습니다.</b>
              </p>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                그만두기
              </button>
              <button
                type="button"
                onClick={() => purge(asking)}
                className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C13B36]"
              >
                파기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 한 항목 ----------

function Row({
  plan,
  disabled,
  onSaved,
  onError,
  onPurge,
}: {
  plan: RetentionPlan;
  disabled: boolean;
  onSaved: () => void;
  onError: (e: string) => void;
  onPurge: () => void;
}) {
  const meta = RETENTION_META[plan.target];
  const [value, setValue] = useState(plan.keepDays === null ? '' : String(plan.keepDays));
  const [saving, setSaving] = useState(false);

  const dirty = value.trim() !== (plan.keepDays === null ? '' : String(plan.keepDays));

  async function save() {
    setSaving(true);

    const trimmed = value.trim();
    const days = trimmed === '' ? null : Number(trimmed);

    const result = await submitKeepDays(plan.target, days);
    setSaving(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-[13.5px] font-bold text-[#1A2130]">{meta.label}</h3>
        <span className="text-[13px] text-[#98A2B3]">{meta.what}</span>
      </div>

      <p className="mt-1 text-[12.5px] text-[#98A2B3]">
        <b className="font-semibold text-[#4A5567]">{meta.from}</b>부터 셉니다
      </p>

      {/* ★ 정하기 전에 알아야 할 것. 안 적으면 아무 숫자나 넣습니다 */}
      <p className="mt-2 rounded-md bg-[#FEF8EC] px-3 py-2 text-[12.5px] leading-relaxed text-[#8A6320]">
        {meta.caution}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          placeholder="비우면 안 지움"
          className="h-9 w-[130px] rounded-md border border-[#DDE2EA] px-2.5 text-[14px] tabular-nums outline-none focus:border-[#1279E8]"
        />
        <span className="text-[13.5px] text-[#4A5567]">일 지나면 파기</span>

        <button
          type="button"
          onClick={() => setValue(String(meta.suggestedDays))}
          disabled={disabled || saving}
          title={meta.suggestedWhy}
          className="h-9 rounded-md border border-[#DDE2EA] px-2.5 text-[13px] font-semibold text-[#98A2B3] hover:bg-[#F4F6F9] disabled:opacity-50"
        >
          제안 {formatDays(meta.suggestedDays)}
        </button>

        {/*
          ★ 안 눌렀을 때도 **보여 둡니다.**
            전에는 값이 바뀌어야 버튼이 나타났습니다. 그러니 '제안' 을 눌러
            칸이 채워진 것을 보고 저장된 줄 알고 나가 버립니다 —
            실제로 그렇게 됐고, 표에는 아무것도 안 들어와 있었습니다.
            누를 것이 늘 같은 자리에 있어야 합니다.
        */}
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving || !dirty}
          className="h-9 rounded-md bg-[#1279E8] px-3.5 text-[13.5px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
        >
          {saving ? '저장 중…' : '저장'}
        </button>

        {/* ★ 안 눌렀다는 것을 글자로도 말합니다. 회색 버튼만으로는 약합니다 */}
        {dirty && !saving && (
          <span className="text-[13px] font-bold text-[#C77700]">← 아직 저장 안 됐습니다</span>
        )}
      </div>

      {/*
        ★ 지금 저장된 값을 그대로 적습니다.
          칸 안의 숫자는 '내가 친 것' 이고 이건 '표에 든 것' 입니다.
          둘을 같이 보여 줘야 저장이 됐는지 눈으로 확인됩니다.
      */}
      <p className="mt-2 text-[13px] text-[#7C8595]">
        지금 설정{' '}
        <b
          className={
            'font-bold ' + (plan.keepDays === null ? 'text-[#C77700]' : 'text-[#1A2130]')
          }
        >
          {formatDays(plan.keepDays)}
        </b>
        {plan.keepDays === null && ' — 이 항목은 지워지지 않습니다'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F0F2F5] pt-3">
        {plan.keepDays === null ? (
          <span className="text-[13px] text-[#98A2B3]">보관기간을 정해야 파기할 수 있습니다.</span>
        ) : (
          <span className="text-[13.5px] text-[#4A5567]">
            지금 지울 것{' '}
            <b className={plan.due > 0 ? 'font-bold text-[#B3312C]' : 'font-bold text-[#98A2B3]'}>
              {plan.due}건
            </b>
            {plan.cutoff && (
              <span className="ml-1 text-[12.5px] text-[#98A2B3]">
                ({plan.cutoff.slice(0, 10)} 이전)
              </span>
            )}
          </span>
        )}

        <button
          type="button"
          onClick={onPurge}
          disabled={disabled || !canPurge(plan)}
          className="ml-auto h-9 rounded-md border border-[#F3C6C6] px-3.5 text-[13.5px] font-bold text-[#D8453F] hover:bg-[#FDECEA] disabled:border-[#DDE2EA] disabled:text-[#C4CBD6]"
        >
          지금 파기
        </button>
      </div>
    </li>
  );
}
