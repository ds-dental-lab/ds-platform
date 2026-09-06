// =========================================================
// 놓을 위치: src/components/order/ShadePhotoButton.tsx
//
// 치과 주문목록 줄의 📷 — 쉐이드 사진을 이 주문에 붙입니다.
// (사용자 요청 2026-09-06 — "웹에서 치과 주문목록에 쉐이드포토 추가하기")
//
// ★★ 우클릭이 아니라 **보이는 단추**입니다. 웹에서 우클릭은 브라우저
//   메뉴라는 십몇 년 된 습관이라 아무도 목록 위에서 우클릭해 보지 않고,
//   태블릿엔 우클릭이 없습니다. 💬 뱃지 옆에 같은 결로 섭니다.
//
// ★★ 핵심은 **QR** 입니다. 웹에서 이 단추를 누르는 사람은 보통 사진이
//   폰에 있습니다. PC 로 옮겨 올리는 건 카톡보다 번거롭습니다. QR 을
//   폰으로 비추면 그 주문의 촬영 화면(/m/[orderId])이 바로 열립니다 —
//   환자 고를 것도 없이 찍으면 이 의뢰서에 붙습니다. 이미 만든 두 조각
//   (PC 목록 · 폰 촬영)을 잇는 것이라 새로 만들 게 거의 없습니다.
//
// ★ 창은 body 에 띄웁니다(portal). 줄(tr) 전체가 링크라, 줄 안에 두면
//   창을 누를 때마다 주문상세로 넘어갑니다.
//
// ★ 파일로 올리는 길도 둡니다 — 이미 PC 에 있는 사진(카메라·스캐너)용.
//   쉐이드라 **안 줄입니다** (compress: false). 이름은 폰 촬영과 같은
//   규칙(shadePhotoName) — 어느 길로 왔든 목록에서 같은 모양이어야 합니다.
// =========================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { uploadOrderFiles } from '@/lib/upload';
import { submitShadePhotoAdded } from '@/server/actions/shade-photo';
import { shadePhotoName } from '@/server/domain/shade-photo';

export interface ShadePhotoButtonProps {
  orderId: string;
  orderNo: string;
  patientLabel: string;
}

export default function ShadePhotoButton({ orderId, orderNo, patientLabel }: ShadePhotoButtonProps) {
  const [open, setOpen] = useState(false);

  // ★ 줄이 링크라 여기서 멈춥니다 — 안 그러면 누르는 순간 상세로 갑니다
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen(true);
        }}
        onKeyDown={stop}
        title={`${patientLabel} 쉐이드 사진 붙이기`}
        aria-label={`${patientLabel} 쉐이드 사진 붙이기`}
        /*
          ★ 28px, 아이콘 17px (사용자 요청 2026-09-06 — "좀 더 키워줬으면").
            22px 는 💬 뱃지와 같은 높이였는데 그림 하나뿐이라 작아 보였습니다.
            늘 옅은 초록 바탕을 깔아 '누르는 것' 으로 읽히게 합니다.
        */
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF6F4] text-[#0E9384] hover:bg-[#D2EFEA]"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      </button>

      {open && (
        <ShadePhotoDialog
          orderId={orderId}
          orderNo={orderNo}
          patientLabel={patientLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------- 창 ----------

function ShadePhotoDialog({
  orderId,
  orderNo,
  patientLabel,
  onClose,
}: ShadePhotoButtonProps & { onClose: () => void }) {
  const router = useRouter();
  const [qr, setQr] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  /*
    ★ 주소는 지금 열려 있는 곳의 것입니다 — 운영이면 denflow.kr,
      시험이면 그 주소. 어디서 열든 그 서버의 촬영 화면으로 갑니다.
    ★ 로그인이 안 된 폰이면 로그인 뒤 여기로 돌아옵니다 (safeNext 가 /m 을 허용).
  */
  useEffect(() => {
    const url = `${window.location.origin}/m/${orderId}`;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#16324F', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [orderId]);

  async function attach(files: File[]) {
    if (files.length === 0) return;
    setError('');
    setBusy(true);
    setPercent(0);

    const taken = new Date();
    const named = files.map(
      (f, i) => new File([f], shadePhotoName(orderNo, done + i, taken), { type: f.type }),
    );

    const result = await uploadOrderFiles(
      orderId,
      named,
      (p) => setPercent(p.overallPercent),
      'scan',
      { compress: false },
    );

    const sent = named.length - result.failed.length;
    if (sent > 0) await submitShadePhotoAdded(orderId, sent);

    setBusy(false);
    setDone((n) => n + sent);

    if (!result.ok) {
      setError(`${result.failed.length}장을 못 올렸습니다: ${result.failures[0]?.reason ?? ''}`);
    }

    router.refresh();
  }

  const dialog = (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-semibold text-[#98A2B3]">{orderNo}</p>
            <h2 className="text-[18px] font-extrabold tracking-tight text-[#1A2130]">
              {patientLabel} · 쉐이드 사진
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-full text-[#98A2B3] hover:bg-[#F4F6F9]"
          >
            &#10005;
          </button>
        </div>

        {/* ---------- 폰으로 찍기 ---------- */}
        {/* ★ 좁은 화면(폰 웹)에서는 QR 아래에 글이 옵니다 — 옆에 두면 글이 세로로 흘러내립니다 */}
        <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-[#DDE7F7] bg-[#F7FAFF] p-4 text-center sm:flex-row sm:text-left">
          <span className="grid h-[120px] w-[120px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
            {qr ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qr} alt="폰 촬영 화면으로 가는 QR" width={120} height={120} />
            ) : (
              <span className="text-[12px] text-[#98A2B3]">QR 준비 중</span>
            )}
          </span>
          <div className="min-w-0">
            <b className="block text-[15px] font-bold text-[#1A2130]">폰으로 찍기</b>
            <p className="mt-1 text-[13px] leading-relaxed text-[#4A5567]">
              폰 카메라로 비추면 <b className="font-bold">이 의뢰서의 촬영 화면</b>이 바로 열립니다.
              찍으면 여기에 붙습니다.
            </p>
          </div>
        </div>

        {/* ---------- 파일 올리기 ---------- */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void attach(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')));
          }}
          className={
            'mt-3 rounded-xl border-2 border-dashed p-4 text-center transition-colors ' +
            (dragging ? 'border-[#0E9384] bg-[#EAF6F4]' : 'border-[#DDE2EA]')
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void attach(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <b className="block text-[14px] font-bold text-[#1A2130]">파일 올리기</b>
          <p className="mt-1 text-[12.5px] text-[#98A2B3]">
            PC 에 있는 사진을 여기 끌어다 놓거나{' '}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="font-semibold text-[#0E9384] underline underline-offset-2"
            >
              골라서 올리기
            </button>
            . 원본 화질 그대로 붙습니다.
          </p>

          {busy && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF1F5]">
                <div className="h-full bg-[#0E9384]" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-[11.5px] tabular-nums text-[#98A2B3]">올리는 중 {percent}%</p>
            </div>
          )}
          {!busy && done > 0 && (
            <p className="mt-3 text-[13px] font-bold text-[#0E9384]">사진 {done}장이 붙었습니다</p>
          )}
          {error && <p className="mt-2 text-[12.5px] text-[#D8453F]">{error}</p>}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
