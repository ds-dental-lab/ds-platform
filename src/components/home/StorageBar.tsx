// =========================================================
// 놓을 위치: src/components/home/StorageBar.tsx
//
// 저장소 눈금. (사용자 요청 2026-08-25)
//
// ★★ **왜 있는가.** Supabase 의 Spend Cap 이 켜져 있습니다. 그건
//   요금을 막는 스위치가 아니라 **서비스를 막는** 스위치라서,
//   100GB 에 닿으면 요금이 붙는 대신 업로드가 실패합니다. 그리고
//   왜 안 되는지 화면에 안 나옵니다 — 진료실은 "덴플로우 또 안
//   되네" 로 읽습니다. 닿기 전에 알아야 합니다.
//
// ★ 센터 관리자만 봅니다. 요금제를 쥔 사람이 그 사람뿐입니다.
//
// ★ 70% 넘기 전에는 **아무것도 안 그립니다.** 늘 켜져 있는 눈금은
//   배경이 되고, 배경이 되면 정작 빨개졌을 때 아무도 못 봅니다.
// =========================================================

import { storageLevel, storageNotice, percentFull } from '@/server/domain/storage';

export default function StorageBar({ used }: { used: number }) {
  const level = storageLevel(used);
  if (level === 'ok') return null;

  const urgent = level === 'urgent';
  const percent = percentFull(used);

  return (
    <div
      className={
        'mb-3.5 rounded-[10px] border px-4 py-3 ' +
        (urgent ? 'border-[#F3C7C4] bg-[#FDF3F2]' : 'border-[#F0DCB4] bg-[#FFFAF0]')
      }
    >
      <div className="flex items-center gap-2.5">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke={urgent ? '#B02A22' : '#B45309'}
          strokeWidth={1.7}
          strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect x="3" y="4" width="18" height="7" rx="1.6" />
          <rect x="3" y="13" width="18" height="7" rx="1.6" />
          <path d="M6.5 7.5h.01M6.5 16.5h.01" />
        </svg>

        <span
          className={
            'min-w-0 flex-1 text-[13px] ' + (urgent ? 'text-[#8A312B]' : 'text-[#7A5A22]')
          }
        >
          <b className={'font-bold ' + (urgent ? 'text-[#B02A22]' : 'text-[#8A5A0B]')}>
            {storageNotice(used)}
          </b>
          {/*
            ★★ **무엇이 멈추는지**를 적습니다. 숫자만으로는 그게 나쁜
              일인지 모릅니다 — 78% 가 위험한지 아닌지는 요금제를 아는
              사람만 압니다.
          */}
          <span className="ml-1.5">
            {urgent
              ? '지금 정리하지 않으면 스캔·사진 업로드가 실패합니다.'
              : '가득 차면 업로드가 멈춥니다. 보관기간이 지난 파일을 파기해 주세요.'}
          </span>
        </span>
      </div>

      {/* 눈금 — 글자보다 이게 먼저 읽힙니다 */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={'h-full rounded-full ' + (urgent ? 'bg-[#D8453F]' : 'bg-[#E0A33C]')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
