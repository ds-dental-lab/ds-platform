import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";


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


  const pathname = request.nextUrl.pathname;


  if (
    !signedIn &&
    (
      pathname.startsWith("/clinic") ||
      pathname.startsWith("/design") ||
      pathname.startsWith("/lab")
    )
  ) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }


  return response;
}


export const config = {
  matcher: [
    "/clinic/:path*",
    "/design/:path*",
    "/lab/:path*",
  ],
};