// =========================================================
// 놓을 위치: src/app/(dev)/playground/order-filters/page.tsx
//
// 주문목록 아이콘 필터를 로그인 없이 띄워 봅니다. **개발 중에만 열립니다.**
//
// ★ 만든 이유: 고르고 끄는 규칙은 테스트로 잠갔지만, **아이콘이 만드는
//   주소**는 화면에서만 확인됩니다. 켠 채로 다른 것을 누르면 앞의 것이
//   지워지는지 아닌지가 여기서 바로 보입니다.
//   눌러 보면 주소가 바뀌고, 아래에 지금 만들어진 주소가 그대로 찍힙니다.
//
// ★ 여기서는 세 섹터를 한 주소로 나란히 그리느라 상태를 **전체 목록**으로
//   읽습니다. 진짜 화면(OrderListScreen)은 **그 섹터의 아이콘에 있는 것만**
//   읽습니다 — 기공소에 `status=received` 가 들어와도 안 걸립니다.
// =========================================================

import OrderQuickFilters from '@/components/order/OrderQuickFilters';
import { parseFilterList, ISSUE_ORDER } from '@/server/domain/order-list';
import { STATUS_ORDER, type OrderStatus } from '@/server/domain/order-status';

const BASE = '/playground/order-filters';

const STATUS_COUNTS = {
  rescan: 2,
  received: 7,
  designing: 4,
  production_wait: 3,
  production: 5,
  shipping: 1,
  completed: 41,
};

const ISSUE_COUNTS = { rescan: 2, remake: 1, repair: 3, analog: 1 };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FilterPlayground({ searchParams }: PageProps) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };

  const statuses = parseFilterList(one('status'), STATUS_ORDER as readonly OrderStatus[]);
  const issues = parseFilterList(one('issue'), ISSUE_ORDER);

  const params: Record<string, string> = {};
  if (statuses.length) params.status = statuses.join(',');
  if (issues.length) params.issue = issues.join(',');
  // 필터를 바꿔도 안 없어져야 하는 다른 조건 — 실제 목록의 검색줄 대역입니다
  params.range = '3개월';

  return (
    <div className="min-h-screen bg-[#F4F6F9] p-6">
      {(['design_center', 'clinic', 'lab'] as const).map((sector) => (
        <section key={sector} className="mb-6 rounded-lg bg-white p-4">
          <h1 className="mb-2 text-[14px] font-bold text-[#4A5567]">{sector}</h1>
          <OrderQuickFilters
            basePath={BASE}
            params={params}
            statuses={statuses}
            issues={issues}
            statusCounts={STATUS_COUNTS}
            issueCounts={ISSUE_COUNTS}
            sector={sector}
          />
        </section>
      ))}

      <pre className="rounded-lg bg-white p-4 text-[13px] text-[#4A5567]">
        {JSON.stringify({ statuses, issues, params }, null, 2)}
      </pre>
    </div>
  );
}
