// =========================================================
// 놓을 위치: src/lib/supabase/admin.ts
// 용도: 회원가입 처리처럼 "권한 검사를 통과해야 하는" 서버 작업 전용
//
// ★★ 경고 ★★
// 이 키는 모든 데이터를 열 수 있는 만능 열쇠입니다.
// 'use client' 가 붙은 파일에서는 절대 import 하지 마세요.
// 브라우저로 새어 나가면 전체 데이터가 열립니다.
// =========================================================

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다. ' +
        'Supabase → Settings → API → service_role 값을 넣어 주세요.',
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
