// =========================================================
// 놓을 위치: src/components/product/LabPriceTable.tsx
//
// 기공소가 보는 자기 기공원가. **읽기 전용**입니다.
//
// ★ 고치는 길을 두지 않습니다.
//   단가는 디자인센터가 정합니다. 받는 쪽이 스스로 올리면 그건 단가가
//   아니라 청구입니다. 대신 "다르다" 를 말할 곳을 화면에 적어 둡니다 —
//   고칠 수 없는 화면에 아무 안내가 없으면 전화할 데를 못 찾습니다.
//
// ★ 안 정한 칸은 0원이 아니라 '미정' 입니다.
//   0원으로 보이면 "공짜로 만들라는 거냐" 가 됩니다. 실제로는 아직
//   안 정한 것뿐이고, 정산에서도 청구액에 안 잡힙니다.
//
// ★ 쓸 수 없는 칸은 '—' 입니다.
//   폰틱이 안 되는 제품의 폰틱 단가는 비어 있는 게 맞습니다.
//   그것까지 '미정' 으로 보이면 챙길 것이 없는데 빨간 줄만 늘어납니다.
// =========================================================

import type { LabPriceBoard } from '@/server/repositories/lab-price';

export default function LabPriceTable({ board }: { board: LabPriceBoard }) {
  const { rows, unsetCount } = board;

  return (
    <section className="rounded-lg border border-[#E8EBF0] bg-white">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
        <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">제품 단가</h1>
        <span className="text-[13.5px] text-[#98A2B3]">{rows.length}개</span>
      </header>

      {/* ★ 고칠 수 없는 화면입니다. 어디로 말해야 하는지를 적어 둡니다 */}
      <p className="border-b border-[#E8EBF0] bg-[#FBFCFD] px-5 py-2.5 text-[13px] leading-relaxed text-[#98A2B3]">
        디자인센터에서 정한 <b className="font-semibold text-[#4A5567]">기공원가</b>입니다.
        정산에 이 값이 그대로 쓰입니다. 다른 값이 적혀 있으면 디자인센터에 알려 주세요 —
        여기서는 고칠 수 없습니다.
      </p>

      {unsetCount > 0 && (
        <p className="border-b border-[#F3C6C6] bg-[#FDECEA] px-5 py-2.5 text-[13px] font-semibold text-[#B3312C]">
          단가를 안 정한 칸이 {unsetCount}개 있습니다. 그 제품은 정산에서 금액이 안 잡힙니다 —
          만들기 전에 디자인센터와 맞춰 주세요.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="py-20 text-center text-[14px] text-[#98A2B3]">
          아직 단가를 받은 제품이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-[13px] text-[#98A2B3]">
                <th className="px-5 py-3 font-medium">보철 종류</th>
                <th className="px-3 py-3 font-medium">재료</th>
                <th className="px-3 py-3 text-right font-medium">기공원가</th>
                <th className="px-3 py-3 text-right font-medium">폰틱</th>
                <th className="px-5 py-3 text-right font-medium">치은포셀린</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F0F2F5]">
              {rows.map((row, i) => {
                // 같은 종류가 이어지면 이름을 한 번만 씁니다 — 눈이 덜 미끄러집니다
                const sameAsAbove = i > 0 && rows[i - 1].typeCode === row.typeCode;

                return (
                  <tr key={row.materialId} className="hover:bg-[#F8F9FB]">
                    <td className="px-5 py-2.5">
                      {sameAsAbove ? (
                        <span className="text-[#DDE2EA]">〃</span>
                      ) : (
                        <span className="font-semibold text-[#1A2130]">{row.typeName}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-[#4A5567]">
                      {row.materialName}
                      <span className="ml-1.5 text-[11px] text-[#C4CBD6]">{row.materialCode}</span>
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <Money value={row.labCost} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={row.ponticCost} usable={row.hasPontic} />
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Money value={row.pinkCost} usable={row.hasPink} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Money({ value, usable = true }: { value: number | null; usable?: boolean }) {
  // 쓸 수 없는 칸 — 챙길 것이 없습니다
  if (!usable) return <span className="text-[#DDE2EA]">—</span>;

  if (value === null) {
    return <span className="text-[12.5px] font-bold text-[#B3312C]">미정</span>;
  }

  return (
    <span className="font-semibold tabular-nums text-[#1A2130]">
      ₩{value.toLocaleString('ko-KR')}
    </span>
  );
}
