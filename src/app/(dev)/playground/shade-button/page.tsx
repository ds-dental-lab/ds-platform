// =========================================================
// 놓을 위치: src/app/(dev)/playground/shade-button/page.tsx
//
// 주문목록 줄의 📷(쉐이드 사진 붙이기) 창을 눈으로 보는 시연 화면.
//
// ★ 왜 따로 두나 — 치과 목록은 loading.tsx 로 조각이 나뉘어 스트리밍되는데,
//   개발 도구의 브라우저 판이 그 조각을 못 펼쳐서(S:0 hidden) 거기서는
//   단추를 눌러 볼 수가 없었습니다 (2026-09-06). 실제 크롬에서는 됩니다.
//   여기서는 표 한 줄만 그려 창·QR·올리기를 확인합니다.
//
// ★ ?orderId=… 를 주면 그 주문에 진짜로 올라갑니다 (로그인한 치과 계정).
// =========================================================

import ShadePhotoButton from '@/components/order/ShadePhotoButton';

export const dynamic = 'force-dynamic';

export default async function ShadeButtonPlayground({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; orderNo?: string }>;
}) {
  const { orderId = 'demo-order', orderNo = 'ORD-260906-003' } = await searchParams;

  return (
    <main className="mx-auto max-w-[720px] p-8">
      <h1 className="text-xl font-bold">📷 쉐이드 사진 단추</h1>
      <p className="mt-1 text-sm text-gray-500">
        주문목록 한 줄을 흉내 냅니다. 단추를 누르면 창이 뜹니다 — 줄은 링크지만 창을 눌러도 안 넘어가야 합니다.
      </p>

      <table className="mt-6 w-full border border-gray-200 text-sm">
        <tbody>
          <tr className="cursor-pointer hover:bg-[#FAFBFD]" onClick={undefined}>
            <td className="px-3 py-2 font-bold text-[#5546C8]">디자인</td>
            <td className="px-3 py-2">테스트치과</td>
            <td className="px-3 py-2 font-bold">쉐이드단추 시험</td>
            <td className="px-3 py-2 tabular-nums">26</td>
            <td className="px-3 py-2 text-center">
              <span className="inline-flex items-center gap-1">
                <ShadePhotoButton orderId={orderId} orderNo={orderNo} patientLabel="쉐이드단추 시험" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
