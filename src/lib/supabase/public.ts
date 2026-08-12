// =========================================================
// 놓을 위치: src/lib/supabase/public.ts
//
// 로그인과 상관없는 표를 읽을 때 쓰는 연결.
//
// ★ 쿠키를 안 봅니다. 그게 이 파일의 존재 이유입니다.
//   Next 의 캐시(unstable_cache) 안에서는 쿠키를 읽을 수 없습니다 —
//   캐시는 여러 요청이 함께 쓰는 것이라, 특정 사람의 쿠키를 보는 순간
//   그 사람 것이 남에게 갑니다. 그래서 아예 못 보게 막혀 있습니다.
//
// ★ 그러니 **누구에게나 같은 표**에만 씁니다.
//   RLS 가 `using (true)` 인 표 — 지금은 임플란트 목록뿐입니다.
//   조직마다 다르게 보이는 표(제품·휴일·주문)에는 절대 쓰지 마세요.
//   보이면 안 되는 것이 캐시에 얹혀 남에게 갑니다.
// =========================================================

import { createClient } from '@supabase/supabase-js';

export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
