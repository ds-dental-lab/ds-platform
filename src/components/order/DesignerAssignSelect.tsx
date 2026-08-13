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

  /*
    ★ 서버가 바꾼 담당을 따라갑니다 (사용자 신고 2026-08-13 —
      "디자인 누를때 새로고침 안해도 바로 담당자가 확인되게").

      '디자인' 버튼을 누르면 서버가 그 자리에서 나를 담당으로 박습니다
      (changeOrderStatus 의 claiming). 화면도 새로 그려져 current 에
      내 id 가 실려 오는데, useState 의 초기값은 **처음 한 번만** 쓰입니다.
      그래서 셀렉박스만 '미지정' 에 멈춰 있었습니다. 새로고침을 해야
      비로소 이 컴포넌트가 새로 만들어지면서 맞는 값이 들어왔습니다.

      useEffect 로 맞추면 한 번 틀린 화면을 그린 뒤 고칩니다.
      그리기 도중에 바로잡으면 사람은 잘못된 값을 아예 못 봅니다.
  */
  const [seen, setSeen] = useState(current ?? '');
  if (seen !== (current ?? '')) {
    setSeen(current ?? '');
    setValue(current ?? '');
  }

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
          className="h-8 rounded-md border border-[#DDE2EA] bg-white px-2 text-[13.5px] font-semibold text-[#1A2130] outline-none focus:border-[#5546C8] disabled:text-[#98A2B3]"
        >
          <option value="">미지정</option>
          {seats.map((seat) => (
            <option key={seat.userId} value={seat.userId}>
              {seat.name}
            </option>
          ))}
        </select>
      </label>

      {isMine && !saving && <span className="text-[12.5px] text-[#5546C8]">내가 맡은 주문</span>}
      {error && <span className="text-[12.5px] text-[#D8453F]">{error}</span>}
    </span>
  );
}
