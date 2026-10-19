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
import { AGENT_NOTE, AGENT_VERSION } from '@/server/domain/agent';
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
  ★★ 1.3.8 부터 "끝내기" 단계가 없습니다 (2026-10-19). 돌고 있는 폴더는 덮어쓸 수 없어
    (DLL 잠김) 치과가 풀다 막혔던 일 — 이제 zip 안 폴더 이름에 판 번호가 있어 어디에
    풀어도 옛 폴더와 안 부딪히고, 켜면 새 판이 옛 판을 스스로 내리고 옛 폴더도 치웁니다.
*/
const STEPS = [
  {
    /*
      ★★ 2026-10-19 재현 — 브라우저로 받은 zip 은 "인터넷에서 받음" 표시가 붙고,
        탐색기로 풀면 안의 모든 파일에 옮겨 붙습니다. 그러면 서명 없는 .cmd 를
        누를 때 "게시자를 확인할 수 없습니다" 창이 뜹니다. 풀기 **전에** zip 하나만
        차단 해제하면 안의 파일 전부가 깨끗해져 아무 창도 안 뜹니다.
    */
    title: '받은 압축 파일을 오른쪽 클릭 → 속성 → 「차단 해제」 에 체크 → 확인',
    body: '맨 아래 보안 줄에 있습니다. 안 보이면 이미 괜찮은 것이니 그냥 넘어가세요. 이걸 하면 실행할 때 윈도우가 묻지 않습니다.',
  },
  {
    title: '압축을 풉니다 — 바탕화면 같은 아무 자리에',
    body: `「덴플로우 에이전트 ${AGENT_VERSION}」 처럼 판 번호가 붙은 폴더가 나옵니다. 쓰던 폴더에 덮어쓸 필요 없습니다. 켜져 있던 옛 판을 끝낼 필요도 없습니다.`,
  },
  {
    title: '그 폴더 안의 「덴플로우 에이전트」 를 두 번 누릅니다',
    /*
      ★ 실행 파일이 없습니다 — 백신에 걸리지 않으려고 없앴습니다 (2026-10-07).
        누를 것은 `덴플로우 에이전트.cmd` 인데, 윈도우가 확장자를 숨겨
        「덴플로우 에이전트」 로만 보이고 아이콘이 톱니바퀴입니다.
        "exe 가 없는데요" 를 듣고 적습니다.
      ★ 처음 켜면 바탕화면에 아이콘이 생깁니다 — 다음부터는 그걸 씁니다.
    */
    body: '톱니바퀴 모양 아이콘입니다. 켜져 있던 옛 판은 스스로 물러나고 옛 폴더도 치워집니다. 바탕화면 아이콘과 자동 시작이 새 폴더로 바뀌니 다음부터는 그것을 쓰시면 됩니다. 연결과 폴더 설정은 그대로 남아 있습니다.',
  },
];

/*
  ★ 윈도우가 띄울 수 있는 창을 **생긴 모양대로** 적습니다 (2026-10-19 이 PC 에서 재현).
    치과 직원이 전화 없이 혼자 따라갈 수 있게 **누르는 것만** 적습니다.
  ★ 압축 안에 우리가 만든 실행 파일이 없고(파이썬 재단 서명본 + 글자 파일), Defender
    검사도 깨끗합니다. 그래서 남는 것은 "처음 보는 파일이라 묻는" 창들뿐입니다.
    첫째가 거의 전부이고, 둘째·셋째는 드뭅니다. 10/07 제일치과는 그때 쓰던 exe 가
    셋째 경우였습니다 — exe 를 없애서 지금은 안 납니다.
*/
const DIALOGS = [
  {
    title: '노란 방패 — "게시자를 확인할 수 없습니다. 실행하시겠습니까?"',
    body: '「실행」 을 누르면 됩니다. 2번(차단 해제)을 건너뛰었을 때 뜨고, 한 번 켜지면 에이전트가 표시를 지워 다음부터는 안 묻습니다.',
  },
  {
    title: '파란 화면 — "Windows의 PC 보호"',
    body: '「추가 정보」 를 누르면 아래에 「실행」 단추가 나옵니다. 그걸 누릅니다.',
  },
  {
    title: '"위협이 검출되었습니다" (오른쪽 아래 알림)',
    body: '방패 모양(Windows 보안) → 「바이러스 및 위협 방지」 → 「보호 기록」 → 덴플로우 줄 → 「작업」 → 「디바이스에서 허용」. 그 다음 압축을 다시 풀어 덮어씁니다.',
  },
  {
    title: '"Windows Defender 방화벽에서 이 앱의 일부 기능을 차단했습니다"',
    body: '자동 출력을 켠 치과에서만 뜹니다. 「액세스 허용」 을 꼭 누르세요 — 취소하면 프린터를 못 찾습니다. 관리자 암호를 물으면 PC 관리자 계정으로 허용해 주세요.',
  },
];

export default function AgentDownloadPage() {
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

        {/* ★ 누구나 받던 단추를 번호 뒤로 넣었습니다 (사용자 2026-10-19 — "다운받기를 오픈하는 게 걸린다") */}
        <DownloadGate />

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

      {/*
        ★ 실제 치과에서 Windows 보안이 막았습니다 (2026-10-07). 한 줄 안내로는
          부족해서 따로 절을 둡니다 — 치과 직원이 이 화면만 보고 풀 수 있어야
          합니다. 전화로 불러 주기 어려운 경로라 단계로 적습니다.
        ★ 왜 막는지를 먼저 말합니다. "바이러스라는 뜻이 아니다" 를 먼저 읽히지
          않으면 그 다음 설명을 안 봅니다.
      */}
      <h2 className="mt-9 text-[14px] font-extrabold tracking-[-0.02em] text-[#1A2130]">
        윈도우가 무언가 물어보면
      </h2>

      <p className="mt-2 text-[12.5px] leading-relaxed text-[#4A5567]">
        바이러스라는 뜻이 아닙니다. <b className="text-[#1A2130]">처음 보는 파일</b>이라
        윈도우가 한 번 물어보는 것입니다. 뜬 창의 모양을 찾아 그대로 누르시면 됩니다.
      </p>

      <ul className="mt-3 space-y-2.5">
        {DIALOGS.map((d) => (
          <li key={d.title} className="rounded-lg border border-[#E8EBF0] p-3">
            <p className="text-[12.5px] font-bold text-[#1A2130]">{d.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#4A5567]">{d.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-xl border border-[#CFE3FB] bg-[#F2F7FE] p-4">
        <p className="text-[12.5px] leading-relaxed text-[#4A5567]">
          <b className="text-[#1A2130]">잘 안 되시면 그냥 두세요.</b> 덴플로우 화면의 대화로
          남겨 주시면 저희가 원격으로 봐 드립니다. 직접 백신 설정을 바꾸려다
          다른 것이 꺼지는 편이 더 나쁩니다.
        </p>
      </div>
    </main>
  );
}
