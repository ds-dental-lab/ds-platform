// =========================================================
// 놓을 위치: src/server/repositories/signup.ts
//
// 가입 신청. 디자인센터는 전부, 본인은 자기 것만 봅니다 (RLS signup_select).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import type { SignupSector, SignupStatus } from '@/server/domain/signup';

export interface SignupRow {
  id: string;
  email: string;
  name: string;
  orgType: SignupSector;
  orgName: string;
  tel: string;
  status: SignupStatus;
  rejectReason: string;
  createdAt: string;
  reviewedAt: string | null;
  /** 처리한 사람 이름. 못 찾으면 빈 값 */
  reviewedBy: string;
}

interface RawRow {
  id: string;
  email: string;
  name: string;
  org_type: SignupSector;
  org_name: string;
  tel: string | null;
  status: SignupStatus;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer: { name: string | null } | null;
}

const COLUMNS =
  'id, email, name, org_type, org_name, tel, status, reject_reason, created_at, reviewed_at, ' +
  'reviewer:user_profiles!signup_requests_reviewed_by_fkey(name)';

function toRow(raw: RawRow): SignupRow {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    orgType: raw.org_type,
    orgName: raw.org_name,
    tel: raw.tel ?? '',
    status: raw.status,
    rejectReason: raw.reject_reason ?? '',
    createdAt: raw.created_at,
    reviewedAt: raw.reviewed_at,
    reviewedBy: raw.reviewer?.name ?? '',
  };
}

export interface SignupBoard {
  pending: SignupRow[];
  handled: SignupRow[];
}

/**
 * 승인 화면이 쓰는 목록.
 *
 * ★ 기다리는 것과 끝난 것을 갈라 둡니다.
 *   한 표에 섞으면 오래된 것에 밀려 새 신청이 아래로 내려갑니다 —
 *   그동안 그 치과는 아무것도 못 합니다.
 *
 * ★ 기다리는 것은 **오래된 것부터**입니다.
 *   먼저 두드린 사람이 먼저 열립니다. 끝난 것은 최근 순 — 방금 무엇을
 *   했는지 확인하러 보는 목록이라 차례가 반대입니다.
 */
export async function getSignupBoard(): Promise<SignupBoard> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('signup_requests')
    .select(COLUMNS)
    .order('created_at', { ascending: false });

  const rows = ((data ?? []) as unknown as RawRow[]).map(toRow);

  return {
    pending: rows.filter((r) => r.status === 'pending').reverse(),
    handled: rows.filter((r) => r.status !== 'pending'),
  };
}

/** 아직 아무도 안 본 신청이 몇 건인가 */
export async function countPendingSignups(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('signup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return count ?? 0;
}

/**
 * 지금 로그인한 사람의 신청서.
 *
 * ★ 소속이 없는 사람에게 **왜** 없는지 말해 주려고 읽습니다.
 *   "소속된 조직이 없습니다" 만 띄우면 자기가 뭘 잘못했는지 찾다가
 *   전화를 겁니다.
 */
export async function getMySignup(): Promise<SignupRow | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from('signup_requests')
    .select(COLUMNS)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? toRow(data as unknown as RawRow) : null;
}
