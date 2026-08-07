// =========================================================
// 놓을 위치: src/components/order/PatientPicker.tsx
//
// 환자 선택. (기능명세서 §4.2.1)
//   차트번호나 이름으로 찾고, 없으면 새로 등록합니다.
// =========================================================

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Patient {
  id: string;
  chart_no: string;
  name: string;
}

export interface PatientPickerProps {
  value?: Patient | null;
  onChange?: (patient: Patient | null) => void;
}

export default function PatientPicker({ value = null, onChange }: PatientPickerProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [newChartNo, setNewChartNo] = useState('');
  const [newName, setNewName] = useState('');

  // 타이핑이 멈추면 찾습니다
  useEffect(() => {
    if (value) return;

    const trimmed = keyword.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();

      const { data } = await supabase
        .from('patients')
        .select('id, chart_no, name')
        .is('deleted_at', null)
        .or(`chart_no.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
        .order('chart_no')
        .limit(8);

      setResults(data ?? []);
      setSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [keyword, value]);

  function select(patient: Patient) {
    onChange?.(patient);
    setKeyword('');
    setResults([]);
    setCreating(false);
    setError('');
  }

  async function handleCreate() {
    setError('');

    if (!newChartNo.trim() || !newName.trim()) {
      setError('차트번호와 이름을 모두 입력해 주세요');
      return;
    }

    const supabase = createClient();

    // 내 치과 찾기
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setError('로그인이 필요합니다');

    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) return setError('소속 조직을 찾을 수 없습니다');

    const { data, error: insertError } = await supabase
      .from('patients')
      .insert({
        clinic_org_id: membership.org_id,
        chart_no: newChartNo.trim(),
        name: newName.trim(),
      })
      .select('id, chart_no, name')
      .single();

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? '이미 있는 차트번호입니다'
          : `등록에 실패했습니다: ${insertError.message}`,
      );
      return;
    }

    if (data) select(data);
  }

  // ---------- 선택 완료 ----------
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex-1">
          <span className="font-semibold text-gray-900">{value.name}</span>
          <span className="ml-2 font-mono text-[13px] text-gray-500">{value.chart_no}</span>
        </div>
        <button
          onClick={() => onChange?.(null)}
          className="text-[13px] text-gray-500 underline hover:text-gray-800"
        >
          변경
        </button>
      </div>
    );
  }

  // ---------- 신규 등록 ----------
  if (creating) {
    return (
      <div className="rounded-md border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={newChartNo}
            onChange={(e) => setNewChartNo(e.target.value)}
            placeholder="차트번호"
            className="w-32 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="환자 이름"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-40 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCreate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            등록
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setError('');
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600"
          >
            취소
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
      </div>
    );
  }

  // ---------- 찾기 ----------
  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="차트번호 또는 환자 이름"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          onClick={() => setCreating(true)}
          className="whitespace-nowrap rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          신규 등록
        </button>
      </div>

      {keyword.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {searching ? (
            <p className="px-4 py-3 text-[13px] text-gray-400">찾는 중…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-gray-400">
              결과가 없습니다. 신규 등록을 눌러 주세요.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((patient) => (
                <li key={patient.id}>
                  <button
                    onClick={() => select(patient)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-blue-50"
                  >
                    <span className="font-semibold">{patient.name}</span>
                    <span className="font-mono text-[13px] text-gray-500">
                      {patient.chart_no}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
