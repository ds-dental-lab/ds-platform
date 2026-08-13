// =========================================================
// 놓을 위치: src/components/order/LabAssignSelect.tsx
//
// 주문상세 아래의 기공소 칸. 사용자탭에 등록된 거래 기공소가 나옵니다.
//
// ★ 기본값은 자사 기공(디자인센터 자신)입니다.
//   조직 구조가 통합 모델이라 대부분은 직접 만듭니다 (설계서 Q-2).
//   '미지정' 으로 두면 제작주문을 누를 때마다 고르라는 말을 듣습니다.
//
// ★ 여기서 고르면 바로 저장됩니다.
//   제작주문 버튼을 누를 때 함께 보내면, 눌러 놓고 왜 안 넘어가는지
//   모르는 상태가 생깁니다. 고른 것이 남아 있어야 다음 단계가 편합니다.
//
// ★ 넘긴 뒤에는 못 바꿉니다.
//   제작이 시작된 뒤 기공소를 바꾸면 이미 일을 시작한 곳이 생깁니다.
//   되돌리려면 상태를 되돌려야 합니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitAssignLab } from '@/server/actions/order-status';

export interface LabOption {
  id: string;
  name: string;
  inHouse: boolean;
}

export interface LabAssignSelectProps {
  orderId: string;
  labs: LabOption[];
  /** 지금 배정된 기공소. 없으면 자사 기공이 기본값으로 보입니다 */
  current: string | null;
  /** 고를 수 있는가. 디자인 단계까지만입니다 */
  editable: boolean;
  /** 배정된 기공소 이름 — 못 고칠 때 글자로만 보여 줍니다 */
  labName?: string;
}

export default function LabAssignSelect({
  orderId,
  labs,
  current,
  editable,
  labName,
}: LabAssignSelectProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 아직 안 정했으면 자사 기공을 미리 골라 둡니다
  const fallback = labs.find((l) => l.inHouse)?.id ?? labs[0]?.id ?? '';
  const [value, setValue] = useState(current ?? fallback);

  if (!editable) {
    return (
      <span className="ml-auto">
        기공소 <b className="font-bold text-[#1A2130]">{labName || '미지정'}</b>
      </span>
    );
  }

  async function change(next: string) {
    const before = value;

    setValue(next);
    setError('');
    setSaving(true);

    const result = await submitAssignLab(orderId, next);
    setSaving(false);

    if (!result.ok) {
      setValue(before); // 저장 못 했으면 화면도 되돌립니다
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <span className="ml-auto flex items-center gap-2">
      {error && <span className="text-[12.5px] text-[#D8453F]">{error}</span>}

      <label className="flex items-center gap-2">
        기공소
        <select
          value={value}
          disabled={saving || refreshing || labs.length === 0}
          onChange={(e) => change(e.target.value)}
          className="h-8 rounded-md border border-[#DDE2EA] bg-white px-2 text-[13.5px] font-semibold text-[#1A2130] outline-none focus:border-[#5546C8] disabled:text-[#98A2B3]"
        >
          {labs.length === 0 && <option value="">거래 기공소가 없습니다</option>}
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.inHouse ? `${lab.name} (자사 기공)` : lab.name}
            </option>
          ))}
        </select>
      </label>
    </span>
  );
}
