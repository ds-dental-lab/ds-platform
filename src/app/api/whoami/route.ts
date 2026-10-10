// =========================================================
// 놓을 위치: src/app/api/whoami/route.ts
//
// ★★ **임시입니다. 고치고 나면 지웁니다** (2026-10-10).
//   "로그인은 되는데 소속된 조직이 없습니다" 를 쫓는 중입니다.
//   운영 DB 에는 그 사람의 소속이 **멀쩡히 있는데**(service role 로 확인)
//   화면은 없다고 합니다. 그 사이 어디서 끊기는지 밖에서는 안 보입니다.
//
// ★ 자기 것만 돌려줍니다. 남의 자료는 한 줄도 안 읽습니다.
// ★ service role 을 안 씁니다 — 로그인한 그 사람의 권한 그대로 물어야
//   RLS 가 막는지 아닌지가 드러납니다.
// =========================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();

  const names = (await import('next/headers'))
    .cookies()
    .then((c) => c.getAll().map((x) => x.name));

  const { data: claims, error: claimError } = await supabase.auth.getClaims();

  // 토큰이 어떤 열쇠로 서명됐는가 — 머리 부분만 읽습니다 (내용은 안 봅니다)
  let head: unknown = null;
  const token = (claims as { token?: string } | null)?.token;
  if (typeof token === 'string' && token.split('.').length === 3) {
    try {
      head = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    } catch {
      head = '못 읽음';
    }
  }

  const sub = claims?.claims?.sub ?? null;

  const member = await supabase
    .from('memberships')
    .select('role, org_id, organizations(name, org_type)')
    .eq('user_id', sub ?? '')
    .eq('is_active', true);

  const mine = await supabase.rpc('my_org_id');
  const kind = await supabase.rpc('my_org_type');

  return NextResponse.json({
    로그인: {
      sub,
      email: claims?.claims?.email ?? null,
      exp: claims?.claims?.exp ?? null,
      지금: Math.floor(Date.now() / 1000),
      토큰머리: head,
      오류: claimError?.message ?? null,
    },
    소속조회: {
      줄수: member.data?.length ?? null,
      값: member.data ?? null,
      오류: member.error ? { code: member.error.code, message: member.error.message } : null,
    },
    my_org_id: { 값: mine.data ?? null, 오류: mine.error?.message ?? null },
    my_org_type: { 값: kind.data ?? null, 오류: kind.error?.message ?? null },
    쿠키이름: await names,
  });
}
