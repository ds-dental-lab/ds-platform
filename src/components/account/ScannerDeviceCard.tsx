'use client';

// =========================================================
// 놓을 위치: src/components/account/ScannerDeviceCard.tsx
//
// 계정정보의 '스캐너 PC 연결' 칸 (사용자 요청 2026-10-02).
//
// ★ 연결 코드는 **여섯 자리·10분·한 번**입니다. 화면에 크게 띄워 PC 프로그램에 적게 합니다.
// ★ 비밀번호는 PC 에 저장되지 않습니다. 그 말을 화면에 적어 둡니다 — 원장님이 묻습니다.
// ★ 해제하면 그 PC 는 그 자리에서 못 올립니다.
// =========================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitDeviceCode, submitRevokeDevice } from '@/server/actions/device-link';

export interface ScannerDevice {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface ScannerDeviceCardProps {
  devices: ScannerDevice[];
  /** 관리자만 연결·해제합니다 */
  canManage: boolean;
}

function when(value: string | null): string {
  if (!value) return '아직 없음';
  return new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ScannerDeviceCard({ devices, canManage }: ScannerDeviceCardProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function makeCode() {
    setError('');
    setBusy(true);
    const result = await submitDeviceCode();
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode(result.code);
  }

  async function revoke(id: string) {
    setError('');
    setBusy(true);
    const result = await submitRevokeDevice(id);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? '해제하지 못했습니다');
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <section className="mx-auto mt-4 max-w-[720px] rounded-lg border border-[#E8EBF0] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E8EBF0] px-6 py-4">
        <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">스캐너 PC 연결</h2>
        <p className="text-[13px] text-[#7C8595]">
          구강스캐너에서 내보내면 스캔이 저절로 올라옵니다.
        </p>

        {canManage && (
          <button
            type="button"
            onClick={makeCode}
            disabled={busy || refreshing}
            className="ml-auto h-9 rounded-md bg-[#1279E8] px-3.5 text-[13.5px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
          >
            {busy ? '만드는 중…' : '연결 코드 만들기'}
          </button>
        )}
      </div>

      {code && (
        <div className="border-b border-[#E8EBF0] bg-[#F2F7FE] px-6 py-4">
          <p className="text-[13px] text-[#4A5567]">PC 프로그램에 이 코드를 넣어 주세요. 10분 동안만 됩니다.</p>
          <p className="mt-1 text-[34px] font-extrabold tracking-[0.18em] text-[#1279E8]">{code}</p>
        </div>
      )}

      {error && <p className="px-6 pt-3 text-[13.5px] text-[#D8453F]">{error}</p>}

      {devices.length === 0 ? (
        <p className="px-6 py-7 text-center text-[14px] text-[#98A2B3]">연결된 PC 가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[#F0F2F5]">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 text-[13.5px]">
              <b className="font-semibold text-[#1A2130]">{device.name}</b>
              <span className="text-[#98A2B3]">마지막 올린 때 {when(device.lastSeenAt)}</span>

              {canManage && (
                <button
                  type="button"
                  onClick={() => revoke(device.id)}
                  disabled={busy || refreshing}
                  className="ml-auto rounded-md border border-[#DDE2EA] px-2.5 py-1 text-[12.5px] font-semibold text-[#4A5567] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:text-[#C4CBD6]"
                >
                  연결 해제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-[#E8EBF0] px-6 py-3 text-[12.5px] leading-relaxed text-[#98A2B3]">
        비밀번호는 PC 에 저장되지 않습니다. 연결을 해제하면 그 PC 는 더 이상 올리지 못합니다.
      </p>
    </section>
  );
}
