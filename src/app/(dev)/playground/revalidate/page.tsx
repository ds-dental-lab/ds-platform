// =========================================================
// 놓을 위치: src/app/(dev)/playground/revalidate/page.tsx
//
// 서버 액션이 **지금 보고 있는 화면**을 무르면, 그 뒤에 이어서
// 도는 일이 살아남는가. (2026-08-21 — 주문수정 파일 업로드가
// pending 으로 남는 이유를 가리려고 만들었습니다)
//
// 실패로도 안 남고 pending 으로 남았다는 것은 '실패했다' 가 아니라
// '중간에 죽었다' 는 뜻입니다. 무엇이 죽였는지 봅니다.
// =========================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { touchLayout, touchNothing } from './actions';

let mountCount = 0;

export default function RevalidatePlayground() {
  const [log, setLog] = useState<string[]>([]);
  const mine = useRef(0);
  const alive = useRef(true);

  const say = (s: string) => setLog((prev) => [...prev, s]);

  useEffect(() => {
    mountCount += 1;
    mine.current = mountCount;
    alive.current = true;
    setLog((prev) => [...prev, `— ${mine.current}번째로 태어났습니다 —`]);

    return () => {
      alive.current = false;
    };
  }, []);

  async function run(which: 'layout' | 'nothing') {
    const me = mine.current;
    say(`[${me}] 저장 부름 (${which === 'layout' ? 'revalidatePath 있음' : '없음'})`);

    await (which === 'layout' ? touchLayout() : touchNothing());
    say(`[${me}] 저장 끝. 이제 5초짜리 올리기 흉내를 냅니다`);

    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      // ★ 죽었으면 이 줄이 화면에 안 붙습니다
      say(`[${me}] ${i}/5 ${alive.current ? '' : '(이 컴포넌트는 이미 죽었습니다)'}`);
    }

    say(`[${me}] ★ 끝까지 갔습니다`);
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">서버 액션이 화면을 무르면 뒷일이 사는가</h1>
      <p className="mt-2 text-[13.5px] text-[#4A5567]">
        누르고 5초를 기다리세요. 1/5~5/5 가 다 찍히고 「끝까지 갔습니다」가 나오면 살아남은 것입니다.
      </p>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => run('layout')}
          className="rounded-md border border-[#D8453F] px-4 py-2 text-[13.5px] font-semibold text-[#D8453F]"
        >
          revalidatePath 있는 저장
        </button>
        <button
          onClick={() => run('nothing')}
          className="rounded-md border border-[#1279E8] px-4 py-2 text-[13.5px] font-semibold text-[#1279E8]"
        >
          없는 저장 (견주기)
        </button>
      </div>

      <pre className="mt-5 whitespace-pre-wrap rounded-lg border border-[#E8EBF0] bg-white p-4 text-[12.5px] leading-6">
        {log.join('\n') || '(아직 없음)'}
      </pre>
    </main>
  );
}
