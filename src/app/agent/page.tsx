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
// ★★ 대신 **여섯 자리 번호**가 있어야 받습니다 (사용자 결정 2026-10-19 — "다운받기를
//   오픈하는 게 걸린다", 다른 회사가 치과로 가입해 받아 갈 수 있으니 로그인으론 못 막음).
//   번호는 센터만 알고, 설치는 사장님이 직접·원격으로 해 줍니다. 버킷은 비공개,
//   맞으면 1분짜리 서명 주소 (actions/agent-download).
//
// ★ 검색에는 안 올립니다 (noindex) — 치과에 드리는 주소지 공개 글이
//   아닙니다. 기공소 이야기는 쓰지 않습니다.
// =========================================================

import type { Metadata } from 'next';
import { AGENT_VERSION } from '@/server/domain/agent';
import DownloadGate from '@/components/agent/DownloadGate';

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

/*
  ★★ **받기만 남겼습니다** (사용자 2026-10-23 "설명이 주저리주저리 너무 길어, 받기만 보이게").
    바꾸는 순서·윈도우 창 안내는 뺐습니다 — 설치는 덴플로우가 직접·원격으로 해 주고
    (번호도 그때 알려 줌), 1.3.8 부터는 새 폴더에 풀어 켜기만 하면 옛 판이 스스로 물러납니다.
    창 안내가 다시 필요해지면 git 기록(2026-10-19 판)에 그대로 있습니다.
*/
export default function AgentDownloadPage() {
  return (
    <main className="mx-auto max-w-[480px] px-5 py-14">
      <p className="text-[12.5px] font-extrabold tracking-[0.02em] text-[#1279E8]">DenFlow</p>
      <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.035em] text-[#1A2130]">
        덴플로우 에이전트 받기
      </h1>

      <div className="mt-6 rounded-xl border border-[#E8EBF0] p-5">
        <span className="text-[15px] font-extrabold text-[#1A2130]">{AGENT_VERSION}</span>
        {/* ★ 누구나 받던 단추를 번호 뒤로 넣었습니다 (사용자 2026-10-19 — "다운받기를 오픈하는 게 걸린다") */}
        <DownloadGate />
      </div>
    </main>
  );
}
