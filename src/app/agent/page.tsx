// =========================================================
// 놓을 위치: src/app/agent/page.tsx
//
// 덴플로우 에이전트 받는 곳 (사용자 요청 2026-10-06).
//
// ★ 에이전트의 "새 판이 있습니다" 띠가 여기로 보냅니다.
//
// ★★ **zip 을 바로 가리키지 않는 이유** — 켜져 있는 폴더는 덮어쓸 수
//   없습니다. 그냥 받으면 치과가 압축을 풀다 "사용 중인 파일" 로 막힙니다.
//   끝내고 · 덮고 · 켜는 세 걸음을 **읽고 나서** 받게 합니다.
//
// ★ 로그인 없이 열립니다. 치과 직원이 전화 받으며 여는 화면이라
//   로그인을 요구하면 거기서 끊깁니다. 받는 것은 프로그램 묶음뿐이고
//   환자 정보가 없습니다.
//
// ★ 검색에는 안 올립니다 (noindex) — 치과에 드리는 주소지 공개 글이
//   아닙니다. 기공소 이야기는 쓰지 않습니다.
// =========================================================

import type { Metadata } from 'next';
import {
  AGENT_NOTE,
  AGENT_VERSION,
  agentZipUrl,
} from '@/server/domain/agent';

export const metadata: Metadata = {
  /*
    ★★ `absolute` 입니다. 그냥 두면 뿌리 layout 의 틀이 붙어
      "… · 덴플로우 디지털 기공소" 로 나갑니다 — **치과가 보는 화면에
      기공소를 적지 않습니다** (2026-09-11). 탭 제목도 글입니다.
  */
  title: { absolute: '덴플로우 에이전트 받기' },
  /*
    ★ 설명과 공유 미리보기도 덮어씁니다. 뿌리 layout 의 것을 그냥 두면
      og:title·og:site_name·description 에 기공소가 그대로 실려 나갑니다 —
      치과에 이 주소를 카톡으로 보내는 순간 거기에 뜹니다.
  */
  description: '구강스캐너에서 내보내면 스캔이 저절로 올라가게 해 주는 프로그램입니다.',
  openGraph: {
    title: '덴플로우 에이전트 받기',
    description: '구강스캐너에서 내보내면 스캔이 저절로 올라갑니다.',
    siteName: 'DenFlow',
    url: 'https://denflow.kr/agent',
    locale: 'ko_KR',
    images: [],
  },
  twitter: { title: '덴플로우 에이전트 받기', images: [] },
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    title: '지금 켜져 있는 것을 끝냅니다',
    body: '화면 오른쪽 아래(시계 옆) 덴플로우 아이콘을 오른쪽 클릭 → 끝내기. 이걸 안 하면 덮어쓰기가 막힙니다.',
  },
  {
    title: '받은 압축을 풀어 폴더째 덮어씁니다',
    body: '안에 든 「덴플로우 에이전트」 폴더를 지금 쓰던 자리에 그대로 덮으세요. 파일 하나만 바꾸면 안 됩니다.',
  },
  {
    title: '다시 켭니다',
    body: '바탕화면의 덴플로우 에이전트를 두 번 누르면 끝입니다. 연결과 폴더 설정은 그대로 남아 있습니다.',
  },
];

export default function AgentDownloadPage() {
  const zip = agentZipUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');

  return (
    <main className="mx-auto max-w-[640px] px-5 py-14">
      <p className="text-[12.5px] font-extrabold tracking-[0.02em] text-[#1279E8]">DenFlow</p>
      <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.035em] text-[#1A2130]">
        덴플로우 에이전트 받기
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[#4A5567]">
        스캐너에서 내보내면 스캔이 저절로 올라가게 해 주는 프로그램입니다.
        이미 쓰고 계시다면 <b>아래 순서대로</b> 바꿔 주세요.
      </p>

      <div className="mt-7 rounded-xl border border-[#E8EBF0] p-5">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-extrabold text-[#1A2130]">{AGENT_VERSION}</span>
          <span className="text-[12.5px] text-[#7C8595]">{AGENT_NOTE}</span>
        </div>

        <a
          href={zip}
          className="mt-4 inline-block rounded-lg bg-[#1279E8] px-5 py-2.5 text-[13.5px] font-bold text-white"
        >
          내려받기
        </a>

        <p className="mt-2.5 text-[11.5px] text-[#98A2B3]">
          윈도우용 · 압축 파일입니다. 설치 과정은 없습니다.
        </p>
      </div>

      <h2 className="mt-9 text-[14px] font-extrabold tracking-[-0.02em] text-[#1A2130]">
        바꾸는 순서
      </h2>

      <ol className="mt-3 space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="mt-[2px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full bg-[#1279E8] text-[11.5px] font-extrabold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-[13px] font-bold text-[#1A2130]">{step.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#4A5567]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border border-[#CFE3FB] bg-[#F2F7FE] p-4">
        <p className="text-[12.5px] leading-relaxed text-[#4A5567]">
          <b className="text-[#1A2130]">백신이 막으면</b> 폴더째 허용해 주세요.
          설치 프로그램이 아니라 압축을 푼 폴더라 처음 한 번 물어볼 수 있습니다.
          궁금한 점은 덴플로우 화면의 대화로 남겨 주시면 됩니다.
        </p>
      </div>
    </main>
  );
}
