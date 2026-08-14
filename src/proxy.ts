import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  KEEP_KEY,
  ALIVE_KEY,
  shouldDropSession,
} from "@/server/domain/login";


export async function proxy(request: NextRequest) {

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });


  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) =>
              request.cookies.set(name, value)
          );

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(
            ({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                options
              )
          );
        },
      },
    }
  );


  /*
    ★ 여기가 **모든 탭 클릭 앞에** 서 있습니다.
      미들웨어는 /clinic /design /lab 로 가는 모든 요청에서 돕니다.
      전에는 auth.getUser() 를 불렀는데, 그건 화면이 시작되기도 전에
      Supabase 인증 서버까지 왕복한다는 뜻입니다 — 링크를 미리 읽는
      요청까지 포함해서요. "탭 누를 때 느리다" 의 정체였습니다.

    ★ 먼저 로컬 검증을 해 봅니다 (getClaims).
      토큰이 ES256(비대칭)이라 서명을 여기서 바로 확인합니다.
      성하면 네트워크를 한 번도 안 씁니다.

    ★ 안 풀리면 그때만 getUser 로 갑니다.
      토큰이 만료됐을 때 **새로 받아 쿠키에 다시 심는 일**이 여기서
      일어납니다. 이 갈래를 없애면 한 시간마다 로그아웃됩니다.
  */
  let signedIn = false;

  const { data: claims } = await supabase.auth.getClaims();

  if (claims?.claims?.sub) {
    signedIn = true;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    signedIn = Boolean(user);
  }


  /*
    ★ '로그인 상태 유지' 를 껐는데 창이 닫혔다 다시 열렸으면 끊습니다.
      (사용자 요청 2026-08-14 — 규칙은 domain/login 의 shouldDropSession)

      표시 두 장으로 압니다. `alive` 는 세션 쿠키라 창을 닫으면 사라지고,
      `keep` 은 400일이라 남습니다. 남았는데 alive 만 없다 = 창이 닫혔다.

    ★ 인증 쿠키에는 손대지 않았습니다. `@supabase/ssr` 이 우리가 준
      maxAge 를 자기 기본값으로 덮어써서, 그 자리를 쓰려면 쿠키를 손으로
      만들어야 합니다 — 거기서 틀리면 아무도 로그인을 못 합니다.

    ★ 표시가 아예 없으면 안 끊습니다. 이 기능 전에 로그인해 둔 사람들이
      한 번씩 튕기면 안 됩니다.
  */
  if (
    signedIn &&
    shouldDropSession(
      request.cookies.get(KEEP_KEY)?.value,
      request.cookies.get(ALIVE_KEY)?.value,
    )
  ) {
    await supabase.auth.signOut();
    signedIn = false;

    // 표시도 같이 걷습니다. 안 지우면 다음 요청에서 또 끊으려 듭니다
    response.cookies.delete(KEEP_KEY);
    response.cookies.delete(ALIVE_KEY);
  }


  const pathname = request.nextUrl.pathname;


  if (
    !signedIn &&
    (
      pathname.startsWith("/clinic") ||
      pathname.startsWith("/design") ||
      pathname.startsWith("/lab")
    )
  ) {
    const away = NextResponse.redirect(
      new URL("/login", request.url)
    );

    /*
      ★ 여기서 쿠키를 옮겨 실어야 합니다.
        redirect 는 **새 응답**이라, 위에서 response 에 걸어 둔 것이
        통째로 사라집니다. 끊어 낸 인증 쿠키가 그 안에 있습니다 —
        안 옮기면 로그인 화면으로 보내 놓고 쿠키는 그대로 남아서,
        주소를 다시 치면 들어가집니다.
    */
    response.cookies.getAll().forEach((c) => away.cookies.set(c));

    return away;
  }


  return response;
}


export const config = {
  /*
    ★ `/` 가 들어 있습니다 (2026-08-14).
      토큰을 새로 받아 **쿠키에 다시 심는 일은 여기서만** 일어납니다.
      화면을 그리는 중에는 쿠키를 못 씁니다(server.ts 의 빈 catch).

      `/` 는 화면 안에서 세션을 봅니다. 미들웨어가 안 돌면, 토큰이
      만료된 상태로 `/` 에 들어왔을 때 새 토큰을 받고도 **못 심습니다.**
      Supabase 는 새 것을 내주면서 옛 것을 무효로 만들기 때문에,
      그 순간 세션이 통째로 날아갑니다.

      전에는 `/` 로 들어올 일이 드물어 안 드러났습니다. 도메인을 붙인
      뒤로는 `denflow.kr` 이 곧 `/` 라, 여기가 정문이 됐습니다.
  */
  matcher: [
    "/",
    "/clinic/:path*",
    "/design/:path*",
    "/lab/:path*",
  ],
};