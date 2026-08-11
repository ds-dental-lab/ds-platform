// =========================================================
// 놓을 위치: src/components/order/PatientPicker.tsx
//
// 환자 이름 칸. (기능명세서 §4.2.1, 시안 #o_name)
//
// ★ 치면 그걸로 끝입니다. 무언가를 눌러야 넘어가지 않습니다.
//   예전에는 아래로 떨어지는 후보 목록에서 하나를 고르거나
//   '새 환자로 등록' 을 눌러야 진행됐습니다. 대부분은 그냥
//   이름을 적고 지나가고 싶어 하므로 그 관문을 없앴습니다.
//
// 후보는 브라우저 기본 자동완성(datalist)으로만 띄웁니다.
// 화면을 덮지 않고, 안 골라도 그만입니다.
// 적어 넣은 값이 후보와 정확히 같으면 그 환자로 이어 붙습니다 —
// 눌러서 고른 것과 같은 결과가 되도록.
// =========================================================

'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Patient {
  id: string;
  chart_no: string;
  name: string;
}

export interface PatientPickerProps {
  /** 칸에 적힌 글자 그대로 */
  text: string;
  /** 적힌 글자가 실제 환자와 맞아떨어졌을 때만 값이 있습니다 */
  patient: Patient | null;
  onChange: (text: string, patient: Patient | null) => void;
}

/** 후보 한 줄의 표시값. 이 문자열이 그대로 칸에 들어갑니다 */
function labelOf(patient: Patient): string {
  return `${patient.name} (${patient.chart_no})`;
}

export default function PatientPicker({ text, patient, onChange }: PatientPickerProps) {
  const listId = useId();
  const [results, setResults] = useState<Patient[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleInput(next: string) {
    // 적힌 글자가 후보와 딱 맞으면 그 환자로 잇습니다
    const matched =
      results.find((p) => labelOf(p) === next) ??
      results.find((p) => p.name === next || p.chart_no === next) ??
      null;

    onChange(next, matched);

    if (timer.current) clearTimeout(timer.current);

    const trimmed = next.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    timer.current = setTimeout(async () => {
      const supabase = createClient();

      const { data } = await supabase
        .from('patients')
        .select('id, chart_no, name')
        .is('deleted_at', null)
        .or(`chart_no.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
        .order('chart_no')
        .limit(8);

      setResults(data ?? []);
    }, 250);
  }

  return (
    <div className="relative">
      <input
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        list={listId}
        placeholder="이름 / 차트번호"
        autoComplete="off"
        className="h-11 w-full rounded border border-[#DDE2EA] px-3 text-[13px] outline-none focus:border-[#1B63E8]"
      />

      <datalist id={listId}>
        {results.map((p) => (
          <option key={p.id} value={labelOf(p)} />
        ))}
      </datalist>

      {/* 이어 붙었는지만 조용히 알려 줍니다 — 안 붙어도 주문은 나갑니다 */}
      {patient && (
        <p className="mt-1 text-[11.5px] text-[#12855B]">등록된 환자와 연결되었습니다</p>
      )}
    </div>
  );
}
