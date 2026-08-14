// =========================================================
// 놓을 위치: src/server/repositories/account.ts
//
// 우리 조직 정보. 계정정보 화면과 청구서가 씁니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { ALIMTALK_RULES } from '@/server/domain/alimtalk';
import type { InvoiceMethod } from '@/server/domain/invoice-method';

export interface MyOrg {
  id: string;
  name: string;
  code: string | null;
  orgType: 'clinic' | 'design_center' | 'lab';
  ceoName: string | null;
  bizNo: string | null;
  tel: string | null;
  fax: string | null;
  address: string | null;
  invoiceEmail: string | null;
  taxEmail: string | null;
  /** 정산서를 어디로 받는가 */
  invoiceMethod: InvoiceMethod;
  closingDay: number;
  /** 고칠 수 있는 사람인가 (owner · admin) */
  editable: boolean;
}

export async function getMyOrg(): Promise<MyOrg | null> {
  const session = await getSession();
  if (!session?.orgId) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from('organizations')
    .select(
      'id, name, code, org_type, ceo_name, biz_no, tel, fax, address, ' +
        'invoice_email, tax_email, invoice_method, closing_day',
    )
    .eq('id', session.orgId)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    id: string;
    name: string;
    code: string | null;
    org_type: MyOrg['orgType'];
    ceo_name: string | null;
    biz_no: string | null;
    tel: string | null;
    fax: string | null;
    address: string | null;
    invoice_email: string | null;
    tax_email: string | null;
    invoice_method: InvoiceMethod;
    closing_day: number;
  };

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    orgType: row.org_type,
    ceoName: row.ceo_name,
    bizNo: row.biz_no,
    tel: row.tel,
    fax: row.fax,
    address: row.address,
    invoiceEmail: row.invoice_email,
    taxEmail: row.tax_email,
    invoiceMethod: row.invoice_method,
    closingDay: row.closing_day,
    // ★ RLS 의 org_update 와 같은 조건입니다. 다르면 눌러 놓고 0행을 받습니다
    editable: session.role === 'owner' || session.role === 'admin',
  };
}

// ---------- 내 알림톡 (2026-08-14) ----------

export interface MyAlimtalk {
  /** 숫자만 담긴 번호. 안 넣었으면 null */
  phone: string | null;
  on: boolean;
  /** 이 사람 자리에 오는 알림톡 이름들 */
  events: string[];
  /** 나에게 갈 뻔했던 최근 것들. 아직 안 보냅니다 */
  recent: { title: string; body: string | null; at: string }[];
}

/**
 * 내 알림톡 설정.
 *
 * ★ **내 줄만** 읽습니다. 남의 번호를 볼 이유가 없습니다 —
 *   같은 조직 사람이면 RLS 로는 보이지만(`is_same_org_user`), 화면이
 *   안 물어봅니다. 물어보면 언젠가 목록으로 보여 주게 됩니다.
 *
 * ★ 오는 알림톡 목록은 **자리로** 정합니다.
 *   치과에는 재스캔, 디자인센터에는 새 주문, 기공소에는 제작 의뢰.
 *   자기에게 안 오는 것까지 늘어놓으면 "왜 안 오지" 가 생깁니다.
 */
export async function getMyAlimtalk(): Promise<MyAlimtalk | null> {
  const session = await getSession();
  if (!session?.user.id) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from('user_profiles')
    .select('phone, alimtalk_on')
    .eq('id', session.user.id)
    .maybeSingle();

  const row = data as { phone: string | null; alimtalk_on: boolean } | null;

  const events = Object.values(ALIMTALK_RULES)
    .filter((rule) => rule.audience === session.orgType)
    .map((rule) => rule.label);

  /*
    ★ 쌓인 줄을 몇 개 보여 줍니다 (2026-08-14).
      아직 발송이 없으니, **문구가 맞는지·나에게 오는 게 맞는지**를
      눈으로 볼 방법이 이것뿐입니다. 사업자등록이 끝나고 실제로 나가기
      시작하면 이 목록이 '받은 내역' 이 됩니다.

    ★ 남의 줄은 안 옵니다 — RLS 가 `to_user_id = auth.uid()` 로 막습니다.
  */
  const { data: queued } = await supabase
    .from('alimtalk_queue')
    .select('title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const recent = ((queued ?? []) as { title: string; body: string | null; created_at: string }[])
    .map((q) => ({ title: q.title, body: q.body, at: q.created_at }));

  return {
    phone: row?.phone ?? null,
    on: row?.alimtalk_on ?? true,
    events,
    recent,
  };
}
