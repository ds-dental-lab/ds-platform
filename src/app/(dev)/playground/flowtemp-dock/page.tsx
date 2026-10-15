// 놀이터 — 치과 책갈피(FlowTempDock) 모양 보기. 개발 중에만 열립니다.
import FlowTempDock from '@/components/layout/FlowTempDock';
import AutoPrintPanel from '@/components/order/AutoPrintPanel';
import { autoNotice, autoProgress, boardRow, type AutoJob } from '@/server/domain/auto-print';
import type { Board } from '@/server/actions/auto-print';

const job = (over: Partial<AutoJob>): AutoJob => ({
  step: 'waiting_design',
  bedClearedAt: null,
  percent: null,
  failedAt: null,
  failedReason: null,
  ...over,
});

const rows: [string, string, number[], AutoJob][] = [
  ['김민수', 'ORD-261015-021', [26], job({ step: 'failed', failedAt: 'sending', failedReason: '프린터를 찾지 못했습니다' })],
  ['박지영', 'ORD-261015-019', [36], job({ step: 'queued' })],
  ['한복계1', 'ORD-261015-011', [17], job({ step: 'printing', percent: 62 })],
  ['윤기두', 'ORD-261015-014', [16], job({ designStage: 'analyzing' })],
  ['이서연', 'ORD-261015-016', [46], job({ designStage: 'stalled' })],
  ['정우성', 'ORD-261015-009', [11], job({ step: 'done', finishedAt: '2026-10-15T06:32:47Z' })],
];

const board: Board = {
  productName: 'FlowTemp',
  items: rows.map(([patientLabel, orderNo, teeth, j], i) => ({
    orderId: `00000000-0000-0000-0000-00000000000${i}`,
    orderNo,
    patientLabel,
    teeth,
    ...boardRow(j),
  })),
};

const doneJob = job({ step: 'done', finishedAt: '2026-10-15T06:32:47Z' });

export default function Page() {
  return (
    <main className="min-h-screen bg-[#F5F6F8] p-10">
      <h1 className="text-[18px] font-bold">치과 화면 (뒤 배경)</h1>
      <p className="mt-2 text-[13px] text-[#7C8595]">오른쪽 가장자리의 책갈피를 눌러 보세요.</p>
      <div className="mt-6 max-w-[560px]">
        <AutoPrintPanel
          orderId="00000000-0000-0000-0000-000000000005"
          steps={autoProgress(doneJob)}
          notice={autoNotice(doneJob)}
          needsBed={false}
          canClear
          finishedAt={doneJob.finishedAt ?? null}
          canReprint
        />
      </div>
      <FlowTempDock preview={board} />
    </main>
  );
}
