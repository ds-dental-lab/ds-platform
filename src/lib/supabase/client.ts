// =========================================================
// 놓을 위치: src/lib/supabase/client.ts
// 용도: 브라우저(화면)에서 쓰는 Supabase 연결
// =========================================================

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
