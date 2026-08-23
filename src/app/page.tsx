import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getSession } from "@/server/policies/session";
import { getMySignup } from "@/server/repositories/signup";
import { waitingView } from "@/server/domain/signup";
import LogoutButton from "@/components/logout-button";
import LandingPage from "@/components/site/LandingPage";
import SiteJsonLd from "@/components/site/SiteJsonLd";
import { isPhone } from "@/server/domain/device";

const HOME_BY_SECTOR = {
  clinic: "/clinic",
  design_center: "/design",
  lab: "/lab",
} as const;

/**
 * `/` 는 세 가지 얼굴을 합니다.
 *
 * ★ 로그인 안 했으면 **회사 홈페이지**입니다 (사용자 요청 2026-08-12).
 *   전에는 곧장 로그인 화면으로 보냈습니다. 그러면 처음 온 사람은
 *   우리가 무엇을 하는 곳인지 볼 기회가 없이 빈 칸 두 개를 마주합니다.
 *   홈페이지와 플랫폼을 다른 주소에 두지 않았습니다 — 주소가 둘이면
 *   거래처가 어디로 들어가야 하는지 헷갈립니다.
 *
 * ★ 소속이 있으면 제 섹터로 보냅니다. 로그인 뒤 여기로 돌아오므로
 *   이 갈림길이 곧 안내판입니다.
 *
 * ★ 소속이 없으면 **왜 없는지** 말해 줍니다.
 *   승인을 기다리는 중일 수 있습니다. 아무 말이 없으면 자기가 뭘
 *   잘못했는지 찾다가 전화를 겁니다.
 */
export default async function Home() {
  const session = await getSession();

  /*
    ★ 구조화 데이터는 **홈페이지에만** 답니다 (2026-08-18).
      "이 조직의 대표 페이지가 어디인가" 를 한 곳으로 못 박아야
      검색엔진이 로고와 상호를 그 한 곳에 묶습니다. 모든 화면에
      뿌리면 어느 것이 대표인지 흐려지고, 로그인한 사람에게는
      아무 쓸모도 없는 글자만 나갑니다.
  */
  if (!session) {
    return (
      <>
        <SiteJsonLd />
        <LandingPage loggedIn={false} />
      </>
    );
  }

  if (session.orgType) {
    /*
      ★★ **치과가 폰으로 들어오면 진료실 화면으로 보냅니다** (2026-08-23).

        사장님이 치과 계정으로 폰에서 들어왔다가 데스크톱 HOME 을
        만났습니다. 사이드바가 화면의 절반을 먹고 '재스캔' 이 글자
        하나씩 세로로 흘러내립니다 — 만들어 둔 /m 이 있는데도
        **거기로 가는 길이 없었습니다.** 주소를 외워서 치라고 할 수는
        없습니다.

      ★ 치과만입니다. 센터·기공소는 폰으로 할 일이 없습니다.
      ★ 태블릿은 안 보냅니다 — 데스크가 아이패드로 의뢰서를 씁니다.
      ★ 되돌아갈 길은 /m 안에 둡니다. 안 그러면 폰 쓰는 치과 관리자가
        정산·주문목록에 영영 못 들어갑니다 (새 덫을 놓는 셈입니다).
    */
    if (session.orgType === "clinic" && isPhone((await headers()).get("user-agent"))) {
      redirect("/m");
    }

    redirect(HOME_BY_SECTOR[session.orgType]);
  }

  const request = await getMySignup();
  const view = waitingView(
    request?.status ?? null,
    request?.orgName ?? "",
    request?.rejectReason ?? "",
  );

  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F6F9] p-6">
      <div className="w-full max-w-[420px] rounded-[10px] border border-[#E8EBF0] bg-white p-9 text-center">
        <h1 className="text-[17px] font-extrabold tracking-[-0.03em] text-[#1A2130]">
          {view.title}
        </h1>

        <p className="mt-3 text-[13.5px] leading-relaxed text-[#4A5567]">{view.body}</p>

        <p className="mt-4 text-[13.5px] text-[#98A2B3]">{session.email}</p>

        {/* ★ 반려된 사람에게만 다시 가입할 길을 엽니다.
            기다리는 중인 사람에게 이 버튼을 주면 신청이 둘로 늘어납니다 */}
        {view.canRetry && (
          <Link
            href="/signup"
            className="mt-5 grid h-11 place-items-center rounded-md bg-[#1279E8] text-[14px] font-bold text-white hover:bg-[#1554C8]"
          >
            다시 가입하기
          </Link>
        )}

        <LogoutButton />
      </div>
    </main>
  );
}
