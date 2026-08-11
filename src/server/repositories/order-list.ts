// =========================================================
// 놓을 위치: src/server/repositories/order-list.ts
//
// 주문목록 조회. (기능명세서 §4.3)
//
// ★ 왜 order.ts 와 나눴는가.
//   목록은 필터·정렬·페이지네이션·아이콘 카운트가 한 덩어리로 움직입니다.
//   상세 조회와 섞으면 둘 다 읽기 어려워집니다.
//
// ★ 기공소명과 환자 실명은 치과에게 내려보내지 않습니다 (설계서 §8.5).
//   화면에서 숨기는 게 아니라 select 에 넣지 않습니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { recordAccess } from '@/server/audit';
import { getSession } from '@/server/policies/session';
import type { OrderStatus } from '@/server/domain/order-status';
import {
  type IssueType,
  type SortColumn,
  type ToothCell,
} from '@/server/domain/order-list';

export interface OrderRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  due_date: string;
  received_at: string | null;
  clinic_name: string;
  /** 치과 계정에서는 항상 빈 값입니다 (§8.5) */
  lab_name: string;
  patient_label: string;
  teeth: ToothCell[];
  issue: IssueType | null;
  remake_count: number;
  remake_seq: number;
  is_remake: boolean;
  is_repair: boolean;
}

export interface OrderListQuery {
  /** 접수일 기준 기간 */
  from?: string | null;
  to?: string | null;
  clinic?: string;
  patient?: string;
  status?: OrderStatus | null;
  issue?: IssueType | null;
  sort?: SortColumn;
  dir?: 1 | -1;
  page?: number;
  perPage?: number;
}

export interface OrderListResult {
  rows: OrderRow[];
  total: number;
  page: number;
  pages: number;
  /** 아이콘 배지 숫자. 상태·이슈 선택은 빼고 셉니다 */
  statusCounts: Record<string, number>;
  issueCounts: Record<string, number>;
  /** 더 있는데 잘렸는가 */
  truncated: boolean;
}

/**
 * 한 번에 읽어올 최대 건수.
 *
 * 필터·정렬·집계를 여기(서버 메모리)에서 합니다. 치과명 검색이 조인한
 * 표의 컬럼을 봐야 하고, 아이콘 카운트가 "상태를 뺀 나머지 조건" 기준이라
 * 질의 하나로 정리되지 않기 때문입니다.
 *
 * 구현계획서의 성능 기준이 1,000건이라 그 두 배를 상한으로 둡니다.
 * 넘어가면 truncated 로 알리고, 그때는 DB 쪽으로 옮깁니다.
 */
const FETCH_CAP = 2000;

interface RawRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  due_date: string;
  received_at: string | null;
  created_at: string;
  patient_label: string;
  remake_count: number;
  remake_seq: number;
  is_remake: boolean;
  is_repair: boolean;
  clinic: { name: string } | null;
  lab: { name: string } | null;
  order_items: { tooth_number: number; is_pontic: boolean }[] | null;
  order_issues: { issue_type: IssueType; opened_at: string; resolved_at: string | null }[] | null;
}

export async function listOrderPage(query: OrderListQuery = {}): Promise<OrderListResult> {
  const session = await getSession();
  const isClinic = session?.orgType === 'clinic';

  const supabase = await createClient();

  // ★ 기공소도 실명을 봅니다 — 배송할 케이스를 이름으로 구분합니다.
  //   대신 RLS 가 배정받은 주문만 열어 주어, 남의 건까지 긁을 수는 없습니다.
  const patientColumn = 'patient_label';

  // 치과에게는 기공소명을 아예 읽지 않습니다 (§8.5)
  const labSelect = isClinic ? '' : 'lab:organizations!orders_lab_org_id_fkey(name), ';

  let q = supabase
    .from('orders')
    .select(
      `id, order_no, status, due_date, received_at, created_at, ` +
        `patient_label:${patientColumn}, remake_count, remake_seq, is_remake, is_repair, ` +
        'clinic:organizations!orders_clinic_org_id_fkey(name), ' +
        labSelect +
        'order_items(tooth_number, is_pontic), ' +
        'order_issues(issue_type, opened_at, resolved_at)',
    )
    .is('deleted_at', null)
    .limit(FETCH_CAP);

  // 기간은 접수일 기준입니다. 접수일이 비어 있으면 등록일로 봅니다.
  if (query.from) q = q.gte('created_at', `${query.from}T00:00:00`);
  if (query.to) q = q.lte('created_at', `${query.to}T23:59:59`);

  if (query.patient?.trim()) {
    q = q.ilike(patientColumn, `%${query.patient.trim()}%`);
  }

  const { data, error } = await q;

  if (error || !data) {
    return emptyResult();
  }

  const raw = data as unknown as RawRow[];
  const truncated = raw.length >= FETCH_CAP;

  // ---------- 행 만들기 ----------
  let rows: OrderRow[] = raw.map((row) => ({
    id: row.id,
    order_no: row.order_no,
    status: row.status,
    due_date: row.due_date,
    received_at: row.received_at ?? row.created_at,
    clinic_name: row.clinic?.name ?? '',
    lab_name: row.lab?.name ?? '',
    patient_label: row.patient_label,
    teeth: (row.order_items ?? []).map((item) => ({
      tooth: item.tooth_number,
      isPontic: item.is_pontic,
    })),
    issue: pickIssue(row.order_issues),
    remake_count: row.remake_count ?? 0,
    remake_seq: row.remake_seq ?? 0,
    is_remake: row.is_remake ?? false,
    is_repair: row.is_repair ?? false,
  }));

  // 치과명 검색 — 조인한 표의 값이라 여기서 거릅니다
  if (query.clinic?.trim()) {
    const needle = query.clinic.trim().toLowerCase();
    rows = rows.filter((r) => r.clinic_name.toLowerCase().includes(needle));
  }

  // ---------- 아이콘 카운트 ----------
  // ★ 상태·이슈 선택은 빼고 셉니다.
  //   고른 상태만 남기고 세면 다른 아이콘이 전부 0이 되어 옮겨 갈 수가 없습니다.
  const statusCounts: Record<string, number> = {};
  const issueCounts: Record<string, number> = {};

  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    if (row.issue) issueCounts[row.issue] = (issueCounts[row.issue] ?? 0) + 1;
  }

  // ---------- 상태 · 이슈 좁히기 ----------
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.issue) rows = rows.filter((r) => r.issue === query.issue);

  // ---------- 정렬 ----------
  const sort = query.sort ?? 'received_at';
  const dir = query.dir ?? -1;
  rows.sort((a, b) => compareBy(a, b, sort) * dir);

  // ---------- 페이지 ----------
  const perPage = query.perPage ?? 10;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);

  const shown = rows.slice((page - 1) * perPage, page * perPage);

  /*
    ★ 목록에도 환자 실명이 실립니다 — 한 쪽에 수십 명입니다.
      상세만 남기면 "목록만 훑었다" 는 대량 열람이 기록에서 빠집니다.
      실제로 화면에 나간 쪽(shown)만 셉니다.
  */
  await recordAccess({
    action: 'order.list',
    subjectCount: shown.length,
    detail: query.patient?.trim() || query.clinic?.trim() ? '검색' : null,
  });

  return {
    rows: shown,
    total,
    page,
    pages,
    statusCounts,
    issueCounts,
    truncated,
  };
}

/**
 * 목록의 '이슈' 열에 무엇을 찍을지.
 * 아직 안 닫힌 것을 먼저 보고, 없으면 가장 최근 것을 보여줍니다.
 */
function pickIssue(
  issues: { issue_type: IssueType; opened_at: string; resolved_at: string | null }[] | null,
): IssueType | null {
  if (!issues || issues.length === 0) return null;

  const sorted = [...issues].sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  return (sorted.find((i) => !i.resolved_at) ?? sorted[0]).issue_type;
}

/** 상태는 이름이 아니라 진행 순서로 세웁니다 */
const STATUS_RANK: Record<OrderStatus, number> = {
  rescan: 0,
  received: 1,
  designing: 2,
  production_wait: 3,
  production: 4,
  shipping: 5,
  completed: 6,
  cancelled: 7,
};

function compareBy(a: OrderRow, b: OrderRow, sort: SortColumn): number {
  switch (sort) {
    case 'status':
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case 'remake_count':
      return a.remake_count - b.remake_count;
    case 'due_date':
      return a.due_date.localeCompare(b.due_date);
    case 'received_at':
      return (a.received_at ?? '').localeCompare(b.received_at ?? '');
    case 'clinic_name':
      return a.clinic_name.localeCompare(b.clinic_name, 'ko');
    case 'patient_label':
      return a.patient_label.localeCompare(b.patient_label, 'ko');
    case 'lab_name':
      return a.lab_name.localeCompare(b.lab_name, 'ko');
  }
}

function emptyResult(): OrderListResult {
  return {
    rows: [],
    total: 0,
    page: 1,
    pages: 1,
    statusCounts: {},
    issueCounts: {},
    truncated: false,
  };
}
