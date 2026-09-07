// =========================================================
// 놓을 위치: src/components/order/MissingFileBar.tsx
//
// 안 올라간 스캔 파일을 그 자리에서 다시 올립니다.
//
// ★ 주문을 지우고 새로 넣지 않습니다 (사용자 결정 2026-08-12).
//   전에는 (2/3) 이 뜨면 디자인센터가 치과에 전화해 새 주문을 받고
//   원래 주문을 지웠습니다. 그러면 —
//     치식·쉐이드·제작옵션을 처음부터 다시 입력하고
//     요청시한이 오늘 기준으로 다시 계산돼 하루가 밀리고
//     주문번호가 바뀌어 그 주문의 대화와 이력이 끊깁니다
//   빠진 파일 하나 때문에 치를 값이 아닙니다.
//
// ★ 이름으로 짝을 맞춥니다.
//   사람은 아까 고르려던 그 파일을 다시 고릅니다. 이름이 같으면 빈 줄을
//   채우고, 다르면 새 줄이 됩니다.
// =========================================================

'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryOrderFiles, type MissingFile } from '@/lib/upload';
import UploadToast, { type UploadState } from '@/components/order/UploadToast';
import { isPhoto } from '@/server/domain/shade-photo';

export interface MissingFileBarProps {
  orderId: string;
  missing: MissingFile[];
  /** 올릴 수 있는 자리인가. 넘긴 뒤에는 못 올립니다 */
  editable: boolean;
}

export default function MissingFileBar({ orderId, missing, editable }: MissingFileBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshing, startTransition] = useTransition();

  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  if (missing.length === 0) return null;

  const busy = uploading || refreshing;

  /*
    ★ 폰에서 찍은 사진은 PC 에서 다시 고를 수 없습니다 — 파일이 폰에
      있습니다. 폰의 덴플로우가 못 보낸 사진을 들고 있다가 열면 이어서
      보내므로(PhotoQueueBar), 여기서는 그렇게 말해 줍니다.
  */
  const phonePhotos = missing.filter((f) => isPhoto(f.fileName)).length;
  const onlyPhotos = phonePhotos === missing.length;

  async function handlePick(list: FileList | null) {
    if (!list || list.length === 0) return;

    const files = Array.from(list);
    if (inputRef.current) inputRef.current.value = '';

    setError('');
    setUploading(true);

    const result = await retryOrderFiles(orderId, missing, files, (progress) =>
      setUpload({ phase: 'uploading', progress }),
    );

    setUploading(false);
    setUpload(
      result.ok
        ? { phase: 'done', total: files.length }
        : { phase: 'failed', total: files.length, failed: result.failed, failures: result.failures },
    );

    if (!result.ok) {
      setError(`파일 ${result.failed.length}개를 또 올리지 못했습니다.`);
    }

    startTransition(() => router.refresh());
  }

  /*
    ★ 겁주지 않습니다 (사용자 지적 2026-09-07 — "유저 입장에서 공포스럽지
      않니"). 전에는 빨간 상자에 ⚠ 와 "올라오지 못했습니다" 였습니다.
      파일 하나가 중간에 멈춘 건 흔한 일이고 주문은 멀쩡합니다 — 그 톤으로
      말합니다. 회색 바탕, 느낌표 없음, 첫 문장이 "주문은 그대로".
  */
  return (
    <div className="mb-2 rounded-md border border-[#E8EBF0] bg-[#F8F9FB] px-[11px] py-[9px]">
      <UploadToast state={upload} onClose={() => setUpload(null)} />

      <p className="text-[12.5px] leading-relaxed text-[#4A5567]">
        <b className="font-bold text-[#1A2130]">파일 {missing.length}개가 아직 안 올라왔습니다.</b>{' '}
        주문은 그대로 있고, 파일만 이어서 올리면 됩니다.
      </p>

      {phonePhotos > 0 && (
        <p className="mt-1 text-[12px] leading-relaxed text-[#4A5567]">
          폰에서 찍은 사진{onlyPhotos ? '입니다' : `이 ${phonePhotos}장 있습니다`}. 폰의 덴플로우를 다시 열면
          이어서 올라갑니다.
        </p>
      )}

      {editable && !onlyPhotos ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => handlePick(e.target.files)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-2 h-8 rounded-md border border-[#1279E8] bg-white px-3.5 text-[13px] font-bold text-[#1279E8] hover:bg-[#EDF3FE] disabled:opacity-60"
          >
            {busy ? '올리는 중…' : '이어서 올리기'}
          </button>

          <p className="mt-1 text-[11px] text-[#98A2B3]">같은 파일을 다시 고르면 그 자리에 들어갑니다.</p>
        </>
      ) : (
        !editable && (
          <p className="mt-1.5 text-[11px] text-[#98A2B3]">
            {onlyPhotos ? '치과 폰에서 이어서 올라옵니다.' : '치과가 이어서 올리면 채워집니다.'}
          </p>
        )
      )}

      {error && <p className="mt-1.5 text-[12.5px] font-semibold text-[#B3312C]">{error}</p>}
    </div>
  );
}
