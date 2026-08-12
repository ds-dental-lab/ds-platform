// =========================================================
// 놓을 위치: src/lib/supabase/client.ts
// 용도: 브라우저(화면)에서 쓰는 Supabase 연결
// =========================================================

import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * 비밀번호 찾기 전용 연결.
 *
 * ★ 여기만 `@supabase/ssr` 이 아니라 순정 supabase-js 를 씁니다.
 *   `createBrowserClient` 는 **flowType 을 'pkce' 로 못박아 둡니다.**
 *   옵션으로 'implicit' 을 넘겨도 조용히 무시당합니다 —
 *   그래서 메일 링크를 눌러 돌아와도 주소에 실려 온 값을 아무도 안 읽고,
 *   화면은 멀쩡한데 첫 칸에 그대로 서 있었습니다. (실제로 한 번 막혔습니다.)
 *
 * ★ PKCE 를 쓰면 안 되는 이유.
 *   PKCE 는 링크를 **요청한 그 브라우저**에 남겨 둔 쪽지(code verifier)가
 *   있어야 열립니다. 병원 컴퓨터에서 눌렀는데 메일은 휴대폰에 오는,
 *   바로 그 경우가 막힙니다. implicit 은 링크만 있으면 어디서든 열립니다.
 *
 * ★ 세션을 저장하지 않습니다 (`persistSession: false`).
 *   이 연결은 비밀번호를 바꾸는 그 순간에만 삽니다. 쿠키에 남기면
 *   앱 세션과 같은 자리를 놓고 다투고, 바꾸다 만 사람이 로그인된 채
 *   남습니다. 메모리에만 들고 있다가 그대로 끝냅니다.
 */
export function createRecoveryClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
