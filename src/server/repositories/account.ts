// =========================================================
// 놓을 위치: src/server/repositories/account.ts
//
// 우리 조직 정보. 계정정보 화면과 청구서가 씁니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

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
        'invoice_email, tax_email, closing_day',
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
    closingDay: row.closing_day,
    // ★ RLS 의 org_update 와 같은 조건입니다. 다르면 눌러 놓고 0행을 받습니다
    editable: session.role === 'owner' || session.role === 'admin',
  };
}
