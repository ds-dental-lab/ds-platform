// =========================================================
// 놓을 위치: src/components/order/ClinicSelect.tsx
//
// 주문등록 '치과' 칸. 디자인센터 화면에서만 고를 수 있습니다.
// 치과 계정에는 자기 이름이 글자로 박혀 있습니다 (고를 것이 없습니다).
//
// ★ 고르면 주소가 바뀌고 폼이 새로 태어납니다.
//   임플란트·제작옵션 즐겨찾기가 치과마다 다릅니다. 서버에서 다시
//   읽어야 그 치과 원장이 만든 즐겨찾기가 나옵니다.
//
// ★ 적던 것이 있으면 먼저 묻습니다.
//   치과를 바꾸면 치식도 환자도 지워집니다. 말없이 날아가면
//   같은 것을 두 번 적게 됩니다.
// =========================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ClinicOption {
  id: string;
  name: string;
}

export interface ClinicSelectProps {
  clinics: ClinicOption[];
  value: string;
  /** 적어 둔 것이 있는가. 있으면 바꾸기 전에 묻습니다 */
  dirty: boolean;
  problem?: boolean;
}

export default function ClinicSelect({ clinics, value, dirty, problem }: ClinicSelectProps) {
  const router = useRouter();
  const [asking, setAsking] = useState<string | null>(null);

  function go(clinicId: string) {
    router.push(clinicId ? `?clinic=${clinicId}` : '?');
  }

  function handleChange(next: string) {
    if (next === value) return;

    if (dirty) {
      setAsking(next);
      return;
    }

    go(next);
  }

  return (
    <>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className={
          'h-11 w-full rounded border px-3 text-[13px] outline-none focus:border-[#1279E8] ' +
          (problem ? 'border-[#D8453F] bg-[#FDF2F2]' : 'border-[#DDE2EA]')
        }
      >
        <option value="">치과를 골라 주세요</option>
        {clinics.map((clinic) => (
          <option key={clinic.id} value={clinic.id}>
            {clinic.name}
          </option>
        ))}
      </select>

      {asking !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
            <div className="px-7 pb-6 pt-7">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FDF0E0]">
                <b className="text-[22px] font-extrabold leading-none text-[#E09A1B]">!</b>
              </span>

              <h3 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A2130]">
                치과를 바꿀까요?
              </h3>
              <p className="mt-2 text-[12.5px] text-[#98A2B3]">
                지금까지 적은 내용은 사라집니다.
              </p>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = asking;
                  setAsking(null);
                  go(next);
                }}
                className="h-11 flex-1 rounded-md bg-[#1279E8] text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
              >
                바꾸기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
