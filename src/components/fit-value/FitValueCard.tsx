// =========================================================
// 놓을 위치: src/components/fit-value/FitValueCard.tsx
//
// 주문상세에서 치과명을 누르면 열리는 내면값 카드.
// (사용자가 준 시안 — 주문상세의 치과 내면값 팝업)
//
// ★ 디자이너와 관리자 모두 봅니다. 값을 **쓰는** 자리라서요.
//   고치는 것은 관리자가 관리탭에서 합니다 — 카드 아래 길이 있습니다.
//
// ★ 값이 갓 바뀌었으면 치과명에 주황 점이 붙습니다 (7일).
//   이것이 "변경되면 웹페이지에서 알린다" 의 틀입니다 — 종을 울리면
//   지나가고 없어지지만, 디자이너는 주문을 열 때마다 치과명을 보므로
//   점은 볼 때까지 남습니다. 무엇이 바뀌었는지는 카드의 '최근 변경' 에
//   문장으로 나옵니다.
// =========================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FIT_NUMBER_FIELDS,
  formatFit,
  isRegistered,
} from '@/server/domain/fit-value';
import type { FitCard } from '@/server/repositories/fit-value';

export interface FitValueCardProps {
  clinicName: string;
  card: FitCard;
  /** 7일 안에 바뀌었는가 — 서버가 isRecentChange 로 판정해 내려줍니다 */
  recent: boolean;
  /** 관리자에게만 관리탭 가는 길을 보여 줍니다 */
  isManager: boolean;
}

export default function FitValueCard({
  clinicName,
  card,
  recent,
  isManager,
}: FitValueCardProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);

  // 바깥을 누르면 닫힙니다 — 카드를 열어 둔 채 화면을 쓰지 않게
  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const registered = isRegistered(card.values);
  const materials = FIT_NUMBER_FIELDS.filter((f) => f.group === 'material');
  const contacts = FIT_NUMBER_FIELDS.filter((f) => f.group === 'contact');

  return (
    <span ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={recent ? '내면값이 최근에 바뀌었습니다 — 눌러서 확인' : '내면값 보기'}
        className="inline-flex items-center gap-1.5 rounded px-1 text-[14px] text-[#4A5567] underline decoration-[#C4CBD6] decoration-dotted underline-offset-[3px] hover:bg-[#F4F6F9] hover:text-[#1A2130]"
      >
        {clinicName}
        {/* ★ 값이 갓 바뀐 치과의 표식 — 볼 때까지 남습니다 */}
        {recent && (
          <span
            aria-label="내면값 최근 변경"
            className="h-2 w-2 rounded-full bg-[#E8590C]"
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-[#E0E4EB] bg-white p-5 text-left shadow-[0_12px_36px_rgba(20,30,50,0.16)]">
          <h4 className="text-[14.5px] font-bold tracking-tight text-[#1A2130]">
            {clinicName} 내면값
          </h4>

          {!registered ? (
            <>
              <p className="mt-3 rounded-md bg-[#F8F9FB] px-3 py-2.5 text-[13px] leading-relaxed text-[#98A2B3]">
                아직 내면값이 등록되지 않았습니다. 기본 설정값으로 작업하고, 필요하면
                관리자에게 등록을 요청해 주세요.
              </p>
              {isManager && <ManageLink />}
            </>
          ) : (
            <>
              {/* ---------- 보철 재료 ---------- */}
              <Group label="보철 재료">
                <div className="grid grid-cols-5 gap-1.5">
                  {materials.map((f) => (
                    <ValueBox
                      key={f.key}
                      label={f.label}
                      value={card.values?.[f.key] ?? null}
                    />
                  ))}
                </div>
              </Group>

              {/* ---------- 컨택 ---------- */}
              <Group label="컨택">
                <div className="grid grid-cols-2 gap-1.5">
                  {contacts.map((f) => (
                    <ValueBox
                      key={f.key}
                      label={f.label}
                      value={card.values?.[f.key] ?? null}
                      wide
                    />
                  ))}
                </div>
              </Group>

              {/* ---------- Hook · 임플란트 ---------- */}
              <div className="mt-3 flex items-start gap-5">
                <div>
                  <GroupLabel>Hook</GroupLabel>
                  <span
                    className={
                      'inline-block rounded border px-2 py-0.5 text-[12.5px] font-bold ' +
                      (card.values?.hook
                        ? 'border-[#F3CD8B] bg-[#FEF7EA] text-[#C2721B]'
                        : 'border-[#E0E4EB] bg-[#F8F9FB] text-[#98A2B3]')
                    }
                  >
                    {card.values?.hook ? '있음' : '미사용'}
                  </span>
                </div>

                {card.values?.implantNote && (
                  <div className="min-w-0">
                    <GroupLabel>임플란트</GroupLabel>
                    <span className="block text-[13.5px] font-semibold text-[#1A2130]">
                      {card.values.implantNote}
                    </span>
                  </div>
                )}
              </div>

              {/* ---------- 비고 ---------- */}
              {card.values?.note && (
                <Group label="비고">
                  <p className="whitespace-pre-wrap rounded-md bg-[#F8F9FB] px-3 py-2 text-[13px] leading-relaxed text-[#4A5567]">
                    {card.values.note}
                  </p>
                </Group>
              )}

              {/* ---------- 최근 변경 — 알림의 몸통 ---------- */}
              {card.recentChanges.length > 0 && (
                <Group label="최근 변경">
                  <ul className="space-y-1.5">
                    {card.recentChanges.map((row, i) => (
                      <li key={i} className="text-[12.5px] leading-relaxed text-[#4A5567]">
                        <span className="tabular-nums text-[#98A2B3]">
                          {row.changedAt.slice(5, 10).replace('-', '/')}
                        </span>{' '}
                        {row.changes.map((c, j) => (
                          <span key={j}>
                            {j > 0 && ' · '}
                            {c.label}{' '}
                            <span className="text-[#98A2B3] line-through">{c.from}</span>
                            {' → '}
                            <b className="font-bold text-[#1A2130]">{c.to}</b>
                          </span>
                        ))}
                        {row.byName && (
                          <span className="text-[#C4CBD6]"> — {row.byName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Group>
              )}

              {isManager && <ManageLink />}
            </>
          )}
        </div>
      )}
    </span>
  );
}

// ---------- 조각들 ----------

function ManageLink() {
  return (
    <Link
      href="/design/fit-values"
      className="mt-3 block rounded-md border border-[#DDE2EA] py-1.5 text-center text-[13px] font-semibold text-[#4A5567] hover:border-[#5546C8] hover:text-[#5546C8]"
    >
      내면값 관리로
    </Link>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <GroupLabel>{label}</GroupLabel>
      {children}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#98A2B3]">{children}</span>
  );
}

function ValueBox({
  label,
  value,
  wide,
}: {
  label: string;
  value: number | null;
  wide?: boolean;
}) {
  return (
    <span
      className={
        'flex flex-col items-center rounded-md border border-[#E8EBF0] bg-[#FAFBFC] py-1.5 ' +
        (wide ? 'px-3' : 'px-1')
      }
    >
      <span className="text-[11px] text-[#98A2B3]">{label}</span>
      <b
        className={
          'text-[13px] font-bold tabular-nums ' +
          (value !== null && value < 0 ? 'text-[#D8453F]' : 'text-[#1A2130]')
        }
      >
        {formatFit(value)}
      </b>
    </span>
  );
}
