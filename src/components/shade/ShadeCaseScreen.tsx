// =========================================================
// 놓을 위치: src/components/shade/ShadeCaseScreen.tsx
//
// S2 케이스 상세 · S4 첨부 완료. (명세서 SPEC_shade-photo)
//
// ★ 카메라는 이 화면을 **덮습니다.** 페이지를 옮기면 카메라 권한이
//   다시 뜨고, 뒤로가기가 카메라를 지나 홈까지 가 버립니다.
//
// ★ 올리는 것은 여기서 합니다 — 카메라는 찍기만 합니다.
//   그래야 카메라를 닫아도 올리던 것이 안 죽습니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { uploadOrderFiles } from '@/lib/upload';
import { shadePhotoName, SHADE_STATUS_LABEL } from '@/server/domain/shade-photo';
import ShadeCamera from '@/components/shade/ShadeCamera';
import type { ShadeCaseDetail } from '@/server/repositories/shade-photo';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const half = h < 12 ? '오전' : '오후';
  const hour = h % 12 === 0 ? 12 : h % 12;

  return `${half} ${hour}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ShadeCaseScreen({ data }: { data: ShadeCaseDetail }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  async function attach(shots: File[]) {
    setBusy(true);
    setError('');

    const taken = new Date();

    /*
      ★ 이름을 여기서 답니다. 카메라가 붙인 임시 이름(shot-…)이 그대로
        저장소에 남으면 나중에 아무도 무엇인지 모릅니다.
      ★ 환자 이름은 안 씁니다 — 경로와 파일명으로 새어 나갑니다.
    */
    const named = shots.map(
      (f, i) => new File([f], shadePhotoName(data.orderNo, data.photoCount + i, taken), { type: f.type }),
    );

    /*
      ★★ compress: false — 안 줄입니다 (사용자 결정 2026-08-21).
        카톡의 압축을 피하려고 만드는 기능인데 우리가 또 줄이면
        만드는 이유가 없어집니다.
    */
    const result = await uploadOrderFiles(data.id, named, undefined, 'scan', { compress: false });

    setBusy(false);

    if (!result.ok) {
      setError(
        `사진 ${result.failed.length}장을 올리지 못했습니다. ` +
          (result.failures[0]?.reason ?? '') +
          ' 잠시 뒤 다시 눌러 주세요.',
      );
      return;
    }

    setCamera(false);
    setDone(named.length);
    startTransition(() => router.refresh());
  }

  // ---------- S4 첨부 완료 ----------
  if (done > 0) {
    return (
      <main className="mx-auto grid min-h-screen max-w-[480px] place-items-center px-8">
        <div className="text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--mist)]">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12.5 9.5 18 20 6.5"
                stroke="var(--teal)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <h1 className="mt-5 text-[24px] font-extrabold text-[var(--ink)]">첨부 완료</h1>

          <p className="mt-3 text-[14.5px] leading-[1.65] text-[var(--muted)]">
            <b className="text-[var(--ink)]">
              {data.patientLabel} · {data.workLabel}
            </b>
            <br />
            의뢰서에 사진 {done}장이 <b className="text-[var(--ink)]">원본 화질로</b> 첨부됐어요.
            <br />
            {data.labName || '기공소'}에 알림을 보냈습니다.
          </p>

          <div className="mt-8 space-y-2.5">
            <Link
              href="/m"
              className="block rounded-xl bg-[var(--ink)] py-3.5 text-[15px] font-bold text-white"
            >
              오늘 의뢰로 돌아가기
            </Link>
            <button
              type="button"
              onClick={() => {
                setDone(0);
                setCamera(true);
              }}
              className="block w-full rounded-xl border border-[var(--line)] bg-white py-3.5 text-[15px] font-bold text-[var(--muted)]"
            >
              추가 촬영
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-28 pt-5">
        <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
          <span aria-hidden="true">&#8249;</span> 오늘 의뢰
        </Link>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(22,50,79,0.06)]">
          <h1 className="text-[27px] font-extrabold tracking-[-0.5px] text-[var(--ink)]">
            {data.patientLabel}
          </h1>

          <dl className="mt-4 space-y-2.5 text-[13.5px]">
            <div className="flex gap-3">
              <dt className="w-11 shrink-0 text-[var(--muted)]">의뢰</dt>
              <dd className="font-semibold text-[var(--ink)]">{data.workLabel}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-11 shrink-0 text-[var(--muted)]">작성</dt>
              <dd className="text-[var(--ink)]">
                {timeLabel(data.createdAt)} · {data.orderNo}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-11 shrink-0 text-[var(--muted)]">기공소</dt>
              <dd className="text-[var(--ink)]">{data.labName || '배정 전'}</dd>
            </div>
          </dl>
        </section>

        <h2 className="mt-6 flex items-center gap-2 text-[14px] font-bold text-[var(--ink)]">
          쉐이드 사진
          <span
            className={
              'rounded-full px-2 py-0.5 text-[11.5px] font-bold ' +
              (data.shade === 'done'
                ? 'bg-[var(--mist)] text-[#0E9384]'
                : 'bg-[#FEF3E2] text-[#B45309]')
            }
          >
            {SHADE_STATUS_LABEL[data.shade]}
          </span>
        </h2>

        {data.photos.length === 0 ? (
          <div className="mt-3 grid h-28 place-items-center rounded-xl border border-dashed border-[var(--line)] text-[13px] text-[#9FB0C0]">
            아직 없음
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {data.photos.map((p) => (
              <li
                key={p.id}
                className="grid aspect-square place-items-center rounded-xl bg-white px-2 text-center text-[10.5px] leading-[1.35] text-[var(--muted)] shadow-[0_1px_2px_rgba(22,50,79,0.06)]"
              >
                {/*
                  ★ 섬네일을 아직 안 만듭니다. 원본을 그대로 걸면
                    진료실에서 수십 MB 를 내려받게 됩니다.
                    지금은 '몇 장 있는지' 만 보여 줍니다.
                */}
                <span>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mx-auto mb-1"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#94A3B8" strokeWidth="1.6" />
                    <circle cx="8.5" cy="10" r="1.6" stroke="#94A3B8" strokeWidth="1.6" />
                    <path d="M4.5 17l4.5-4.5 3.5 3 3-2.5 4 4" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {timeLabel(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-[#FDECEA] px-4 py-3 text-[13px] leading-[1.55] text-[#B02A22]">
            {error}
          </p>
        )}
      </main>

      {/* 아래 고정 — 시안의 티일 버튼 */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] bg-gradient-to-t from-[#F4F7FA] via-[#F4F7FA] to-transparent px-5 pb-6 pt-4">
        <button
          type="button"
          onClick={() => setCamera(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] py-4 text-[16px] font-bold text-white active:bg-[#0F9E8E]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4z"
              stroke="white"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13" r="3.2" stroke="white" strokeWidth="1.8" />
          </svg>
          쉐이드 촬영
        </button>
      </div>

      {camera && (
        <ShadeCamera
          patientLabel={data.patientLabel}
          workLabel={data.workLabel}
          onClose={() => setCamera(false)}
          onAttach={attach}
          busy={busy}
        />
      )}
    </>
  );
}
