// =========================================================
// 놓을 위치: src/lib/supabase/server.ts
// 용도: 서버(화면을 만들어 보내주는 쪽)에서 쓰는 Supabase 연결
//       로그인 여부를 여기서 확인합니다.
// =========================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 화면을 그리는 중에는 쿠키를 쓸 수 없습니다.
            // proxy.ts 가 대신 갱신해 주므로 무시해도 됩니다.
          }
        },
      },
    },
  );
}
