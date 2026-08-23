// =========================================================
// 놓을 위치: src/components/shade/ShadeCamera.tsx
//
// S3 — 카메라. (명세서 SPEC_shade-photo S3)
//
// ★★ **이 화면이 기능의 심장입니다.** 여기서 찍은 것이 곧 그 의뢰서에
//   붙습니다. 분류하는 단계가 아예 없습니다.
//
// ★ 후면 카메라를 최대 해상도로 엽니다. 못 열면 **폰 기본 카메라**로
//   넘어갑니다(input capture) — 아이폰 사파리에서 막히는 일이 있고,
//   그때 "안 됩니다" 로 끝내면 진료실은 다시 카톡을 씁니다.
//
// ★★ **찍은 사진을 안 줄입니다** (사용자 결정 2026-08-21).
//   화질 1.0 으로 뽑고, 올릴 때도 compress:false 로 보냅니다.
//   카톡의 압축을 피하려고 만드는 기능이니까요.
//
// ★ 순서(①쉐이드탭 ②정면 ③자유컷)는 **권장이지 강제가 아닙니다.**
//   셔터는 언제나 눌립니다. 바쁜 진료실에서 절차가 걸림돌이 되면
//   그 순간 카톡으로 돌아갑니다.
// =========================================================

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SHADE_CUTS } from '@/server/domain/shade-photo';

export interface ShadeCameraProps {
  patientLabel: string;
  workLabel: string;
  onClose: () => void;
  /** 찍은 사진들을 넘깁니다. 올리는 것은 부모가 합니다 */
  onAttach: (shots: File[]) => void;
  busy?: boolean;
  /**
   * 앞니가 섞인 케이스인가. 가이드를 **코까지** 넓힙니다
   * (사용자 요청 2026-08-23).
   */
  anterior?: boolean;
}

export default function ShadeCamera({
  patientLabel,
  workLabel,
  onClose,
  onAttach,
  busy,
  anterior = false,
}: ShadeCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [shots, setShots] = useState<File[]>([]);
  const [flash, setFlash] = useState(false);
  const [fallback, setFallback] = useState(false);

  /*
    ★★ 의뢰서의 치식으로 켜 둡니다 — 사람에게 "앞니인가요" 를 또 묻지
      않습니다. 다만 **손으로 바꿀 수 있어야** 합니다: 미분류 촬영은
      아직 어느 의뢰서인지 모르고, 그때는 찍는 사람만 압니다.
  */
  const [wide, setWide] = useState(anterior);

  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          /*
            ★ 후면 카메라를 최대 해상도로 '바라기만' 합니다.
              exact 로 걸면 못 맞추는 기기에서 아예 안 열립니다.
          */
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
          audio: false,
        });

        if (dead) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        // 권한 거부·미지원 — 폰 기본 카메라로 넘어갑니다
        if (!dead) setFallback(true);
      }
    })();

    return () => {
      dead = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /*
    마지막 장 미리보기.

    ★ 그리는 중에 만들고, 효과는 **거두기만** 합니다.
      효과 안에서 setState 를 하면 그릴 때마다 한 번 더 그리게 됩니다
      (eslint 가 잡아 줬습니다). 주소는 값이지 상태가 아닙니다.

    ★ 거두는 것을 빠뜨리면 찍을 때마다 사진 한 장이 메모리에 그대로
      남습니다. 원본이라 한 장이 수 MB 입니다.
  */
  const lastShot = shots[shots.length - 1];
  const preview = useMemo(() => (lastShot ? URL.createObjectURL(lastShot) : ''), [lastShot]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // ★ 화질 1.0 — 안 줄입니다
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShots((prev) => [
          ...prev,
          new File([blob], 'shot-' + Date.now() + '.jpg', { type: 'image/jpeg' }),
        ]);
      },
      'image/jpeg',
      1.0,
    );

    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  }

  const cutDone = Math.min(shots.length, SHADE_CUTS.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0F1B27]">
      <div className="flex items-start justify-between px-5 pb-3 pt-5">
        <div className="min-w-0">
          <b className="block truncate text-[17px] font-bold text-white">{patientLabel}</b>
          <span className="mt-0.5 block truncate text-[12.5px] text-[#8FA6BC]">{workLabel}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[17px] text-white"
        >
          &#10005;
        </button>
      </div>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl bg-black">
        {!fallback && (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        )}

        {fallback && (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="text-[14px] leading-[1.6] text-[#8FA6BC]">
                이 폰에서는 화면 안 카메라를 열 수 없습니다.
                <br />
                아래 버튼을 누르면 폰 카메라가 열립니다.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-5 rounded-xl bg-[var(--teal)] px-6 py-3 text-[15px] font-bold text-white"
              >
                폰 카메라로 촬영
              </button>
            </div>
          </div>
        )}

        {/* 안내와 가이드선 — 오버레이라 찍힌 사진에는 안 담깁니다 */}
        {!fallback && (
          <>
            <p className="absolute inset-x-3 top-3 rounded-xl bg-black/55 px-3.5 py-2.5 text-[12.5px] font-bold leading-[1.5] text-[#2DD4BF]">
              {wide
                ? '코 끝부터 턱까지 들어가게 찍으세요. 쉐이드탭은 치아 절단연과 나란히'
                : '쉐이드탭을 치아 절단연과 나란히 놓고, 가이드 라인 안에 맞춰 촬영하세요'}
            </p>

            {/*
              ★★ 전치부는 **얼굴이 함께** 들어가야 합니다. 앞니는 색만
                맞아서는 안 되고 얼굴 안에서 맞아야 합니다 —
                입술선·피부톤이 같이 보여야 어울리는지가 보입니다.
                치아만 크게 찍은 사진은 색은 보이지만 어울리는지는
                안 보입니다.
            */}
            {wide && (
              <>
                <span className="pointer-events-none absolute inset-x-8 top-[10%] bottom-[8%] rounded-[999px] border border-dashed border-[#2DD4BF]/55" />
                <span className="pointer-events-none absolute inset-x-[38%] top-[19%] border-t border-dashed border-[#2DD4BF]/80" />
                <span className="pointer-events-none absolute left-1/2 top-[19%] -translate-x-1/2 -translate-y-full pb-1 text-[10.5px] font-bold text-[#2DD4BF]">
                  코 끝
                </span>
              </>
            )}

            {/* 치아 띠 — 넓게 찍을 때는 아래로 내려옵니다 */}
            <span
              className={
                'pointer-events-none absolute inset-x-6 border-t border-dashed border-[#2DD4BF]/70 ' +
                (wide ? 'top-[56%]' : 'top-[42%]')
              }
            />
            <span
              className={
                'pointer-events-none absolute inset-x-6 border-t border-dashed border-[#2DD4BF]/70 ' +
                (wide ? 'top-[70%]' : 'top-[58%]')
              }
            />

            {/*
              ★ 손으로도 바꿉니다. 미분류 촬영은 어느 의뢰서인지 모르고,
                의뢰서가 있어도 치식이 실제와 다를 수 있습니다.
                찍는 사람이 환자를 보고 있습니다 — 그 사람 말이 맞습니다.
            */}
            <button
              type="button"
              onClick={() => setWide((v) => !v)}
              aria-pressed={wide}
              className={
                'absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-2 text-[12px] font-bold ' +
                (wide ? 'bg-[var(--teal)] text-white' : 'bg-black/55 text-[#8FA6BC]')
              }
            >
              전치부 · 코까지
            </button>
          </>
        )}

        {flash && <span className="absolute inset-0 bg-white" />}
      </div>

      <div className="flex gap-2 px-4 pt-3">
        {SHADE_CUTS.map((label, i) => (
          <span
            key={label}
            className={
              'flex-1 rounded-lg px-2 py-2 text-center text-[11.5px] font-bold ' +
              (i < cutDone
                ? 'bg-[var(--teal)] text-white'
                : i === cutDone
                  ? 'border border-[var(--teal)] text-[#2DD4BF]'
                  : 'bg-white/10 text-[#6B8299]')
            }
          >
            {label}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between px-6 pb-7 pt-4">
        <span className="h-12 w-12 overflow-hidden rounded-lg bg-white/10">
          {preview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="" className="h-full w-full object-cover" />
          )}
        </span>

        <button
          type="button"
          onClick={fallback ? () => fileRef.current?.click() : shoot}
          disabled={busy}
          aria-label="촬영"
          className="grid h-[74px] w-[74px] place-items-center rounded-full border-[5px] border-white bg-white/25 active:bg-white/40 disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => shots.length > 0 && onAttach(shots)}
          disabled={shots.length === 0 || busy}
          className="h-12 min-w-[74px] rounded-xl bg-[var(--teal)] px-4 text-[14px] font-bold text-white disabled:bg-white/10 disabled:text-[#6B8299]"
        >
          {busy ? '올리는 중' : '첨부 ' + shots.length}
        </button>
      </div>

      {/* ★ 폴백 — 폰 기본 카메라. 여러 장 한 번에도 받습니다 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          const list = e.target.files;
          if (list && list.length > 0) setShots((prev) => [...prev, ...Array.from(list)]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
