// =========================================================
// 놓을 위치: src/components/order/DesignerAssignSelect.tsx
//
// 주문상세 아래의 담당 디자이너 칸.
// (사용자 결정 2026-08-12 — "두명의 디자이너가 한 주문을 하면 안되잖아")
//
// ★ 대개는 여기를 안 만집니다.
//   디자인을 잡는 순간 자동으로 배정됩니다. 이 칸은 **넘겨주는 길**이고,
//   평소에는 "지금 누가 맡고 있는가" 를 보여 주는 글자입니다.
//
// ★ 남의 주문을 열면 왜 못 만지는지가 여기에 적힙니다.
//   버튼을 눌러 보고 나서 빨간 글씨를 만나는 것보다, 열자마자
//   "박디자 님이 맡았습니다" 가 보이는 편이 낫습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitAssignDesigner } from '@/server/actions/order-status';
import type { SeatOption } from '@/server/repositories/member';

export interface DesignerAssignSelectProps {
  orderId: string;
  /** 지금 담당. 아무도 없으면 null */
  current: string | null;
  currentName: string;
  /** 고를 수 있는 사람들. 못 고치는 사람에게는 비어 옵니다 */
  seats?: SeatOption[];
  /** 담당을 바꿀 수 있는가 — 관리자, 빈자리, 또는 내가 잡은 것 */
  editable: boolean;
  /** 지금 보는 사람이 담당인가. '나' 라고 적어 줍니다 */
  isMine: boolean;
}

export default function DesignerAssignSelect({
  orderId,
  current,
  currentName,
  seats = [],
  editable,
  isMine,
}: DesignerAssignSelectProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [value, setValue] = useState(current ?? '');

  if (!editable) {
    return (
      <span>
        담당{' '}
        <b className="font-bold text-[#1A2130]">
          {currentName || (current ? '이름 없음' : '미지정')}
        </b>
        {current && !isMine && (
          <span className="ml-1.5 text-[#98A2B3]">— 이 주문은 그분이 맡았습니다</span>
        )}
      </span>
    );
  }

  async function change(next: string) {
    const before = value;

    setValue(next);
    setError('');
    setSaving(true);

    const result = await submitAssignDesigner(orderId, next || null);
    setSaving(false);

    if (!result.ok) {
      setValue(before); // 저장 못 했으면 화면도 되돌립니다
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <span className="flex items-center gap-2">
      <label className="flex items-center gap-2">
        담당
        <select
          value={value}
          disabled={saving || refreshing}
          onChange={(e) => change(e.target.value)}
          className="h-8 rounded-md border border-[#DDE2EA] bg-white px-2 text-[12.5px] font-semibold text-[#1A2130] outline-none focus:border-[#5546C8] disabled:text-[#98A2B3]"
        >
          <option value="">미지정</option>
          {seats.map((seat) => (
            <option key={seat.userId} value={seat.userId}>
              {seat.name}
            </option>
          ))}
        </select>
      </label>

      {isMine && !saving && <span className="text-[11.5px] text-[#5546C8]">내가 맡은 주문</span>}
      {error && <span className="text-[11.5px] text-[#D8453F]">{error}</span>}
    </span>
  );
}
