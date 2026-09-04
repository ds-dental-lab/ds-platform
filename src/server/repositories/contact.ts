// =========================================================
// 놓을 위치: src/server/repositories/contact.ts
//
// 홈페이지로 들어온 문의. 디자인센터만 읽습니다 (RLS contact_select).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  ContactKind,
  ContactStatus,
  ContactScanner,
  PainPoint,
} from '@/server/domain/contact';

export interface ContactRow {
  id: string;
  clinicName: string;
  /** 옛 문의에만 있습니다 — 2026-09-04 부터 안 받습니다 */
  personName: string;
  tel: string;
  email: string;
  kind: ContactKind;
  message: string;
  status: ContactStatus;
  createdAt: string;
  handledAt: string | null;
  memo: string;
  /** 옛 문의는 null — 그때는 안 물었습니다 */
  scanner: ContactScanner | null;
  painPoints: PainPoint[];
}

interface Raw {
  id: string;
  clinic_name: string;
  person_name: string | null;
  tel: string;
  email: string;
  kind: ContactKind;
  message: string | null;
  status: ContactStatus;
  created_at: string;
  handled_at: string | null;
  memo: string | null;
  scanner: ContactScanner | null;
  pain_points: PainPoint[] | null;
}

/**
 * ★ 새 문의가 위, 처리한 것이 아래입니다.
 *   섞으면 지난 기록에 묻혀서 연락을 놓칩니다 — 그 치과는 답이 없으니
 *   다른 곳에 맡깁니다.
 */
export async function listContacts(): Promise<{ fresh: ContactRow[]; done: ContactRow[] }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('contact_requests')
    // ★ 한 줄 그대로 둡니다 — 이어 붙이면 supabase-js 가 열 이름을 못 읽어 타입이 깨집니다
    .select('id, clinic_name, person_name, tel, email, kind, message, status, created_at, handled_at, memo, scanner, pain_points')
    .order('created_at', { ascending: false });

  const rows = ((data ?? []) as Raw[]).map((r) => ({
    id: r.id,
    clinicName: r.clinic_name,
    personName: r.person_name ?? '',
    tel: r.tel,
    email: r.email,
    kind: r.kind,
    message: r.message ?? '',
    status: r.status,
    createdAt: r.created_at,
    handledAt: r.handled_at,
    memo: r.memo ?? '',
    scanner: r.scanner,
    painPoints: r.pain_points ?? [],
  }));

  return {
    fresh: rows.filter((r) => r.status === 'new'),
    done: rows.filter((r) => r.status === 'done'),
  };
}

export async function countNewContacts(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('contact_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');

  return count ?? 0;
}
