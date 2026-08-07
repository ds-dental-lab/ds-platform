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


  const {
    data: { user },
  } = await supabase.auth.getUser();


  const pathname = request.nextUrl.pathname;


  if (
    !user &&
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