// =========================================================
// 놓을 위치: src/components/agent/DownloadGate.tsx
//
// /agent 의 「내려받기」 — 여섯 자리 번호를 넣어야 살아납니다 (2026-10-19).
// 번호가 맞으면 바로 내려받기가 시작됩니다(주소는 1분만 삽니다).
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { requestAgentDownload } from '@/server/actions/agent-download';

export default function DownloadGate() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await requestAgentDownload(pin);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(true);
      window.location.assign(r.url);
    });
  };

  return (
    <div className="mt-4">
      <label className="block text-[12.5px] font-semibold text-[#4A5567]" htmlFor="agent-pin">
        내려받기 번호 (여섯 자리)
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="agent-pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin.length === 6 && !pending) submit();
          }}
          className="h-[40px] w-[140px] rounded-lg border border-[#D5DAE3] px-3 text-center text-[16px] font-bold tracking-[0.3em] text-[#1A2130] outline-none focus:border-[#1279E8]"
          placeholder="······"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pin.length !== 6 || pending}
          className="rounded-lg bg-[#1279E8] px-5 text-[13.5px] font-bold text-white disabled:opacity-40"
        >
          {pending ? '확인 중…' : '내려받기'}
        </button>
      </div>
      {error ? <p className="mt-2 text-[12.5px] font-semibold text-[#A32F2F]">{error}</p> : null}
      {done ? (
        <p className="mt-2 text-[12.5px] text-[#12855B]">내려받기가 시작됐습니다. 안 되면 번호를 다시 넣어 주세요.</p>
      ) : null}
      <p className="mt-2 text-[11.5px] text-[#98A2B3]">번호는 덴플로우가 설치해 드릴 때 알려 드립니다.</p>
    </div>
  );
}
