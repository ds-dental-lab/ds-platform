// =========================================================
// 놓을 위치: src/components/shade/ShadeQuickShot.tsx
//
// 2-B — 바로 촬영 · 나중에 분류. (명세서 SPEC_shade-photo)
//
// ★★ **이 길이 실제로 제일 많이 쓰입니다.** 환자가 입을 벌리고 있는데
//   목록에서 이름을 찾고 있을 수는 없습니다. 먼저 찍고 나중에 붙입니다.
//
// ★ 올리고 나서 매칭 화면으로 갑니다. 거기서도 건너뛸 수 있습니다 —
//   어느 단계에서도 막히지 않는 것이 이 기능의 전부입니다.
// =========================================================

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { uploadUnsortedPhotos } from '@/lib/upload-unsorted';
import { enqueuePhotos } from '@/lib/photo-queue';
import ShadeCamera from '@/components/shade/ShadeCamera';

export default function ShadeQuickShot({ clinicOrgId }: { clinicOrgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function attach(shots: File[]) {
    setBusy(true);
    setError('');

    const stamp = new Date();
    const two = (n: number) => String(n).padStart(2, '0');
    const when =
      `${stamp.getFullYear()}${two(stamp.getMonth() + 1)}${two(stamp.getDate())}` +
      `-${two(stamp.getHours())}${two(stamp.getMinutes())}`;

    // ★ 환자 이름을 아직 모릅니다 — 시각과 순번으로만 짓습니다
    const named = shots.map(
      (f, i) => new File([f], `미분류_${when}_${i + 1}.jpg`, { type: f.type || 'image/jpeg' }),
    );

    const result = await uploadUnsortedPhotos(clinicOrgId, named);
    setBusy(false);

    if (!result.ok) {
      /*
        ★★ 못 보낸 것은 폰에 담아 둡니다 (명세서 §5). 연결이 돌아오면
          저절로 다시 갑니다 — 미분류함으로 들어갑니다.
      */
      const stuck = named.filter((f) => result.failed.includes(f.name));
      await enqueuePhotos(stuck, { clinicOrgId }, result.reason ?? '');

      setOpen(false);

      if (result.uploaded === 0) {
        setError('사진을 아직 못 보냈습니다. 폰에 담아 뒀다가 연결되면 저절로 보냅니다.');
        return;
      }
    }

    setOpen(false);
    router.push(`/m/unsorted/${result.sessionId}`);
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] bg-gradient-to-t from-[#F4F7FA] via-[#F4F7FA] to-transparent px-5 pb-6 pt-5">
        {error && (
          <p className="mb-2.5 rounded-xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#B02A22]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] py-4 text-[16px] font-bold text-white active:bg-[#0F2439]"
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
          바로 촬영
          <span className="font-normal text-white/70">· 나중에 분류</span>
        </button>
      </div>

      {open && (
        <ShadeCamera
          patientLabel="미분류 촬영"
          workLabel="촬영 후 의뢰서를 선택합니다"
          onClose={() => setOpen(false)}
          onAttach={attach}
          busy={busy}
        />
      )}
    </>
  );
}
