// =========================================================
// 놓을 위치: src/app/(dev)/playground/incoming-scans/page.tsx
//
// '들어온 스캔' 목록 세 가지 모양을 눈으로 봅니다 (2026-10-02).
//   ① 그냥 올라온 스캔 — '주문서 쓰기'
//   ② 같은 환자가 재스캔으로 걸려 있는 스캔 — 붉은 '재스캔에 붙이기' 가 먼저
//   ③ 파일에 적힌 치과가 우리와 다른 스캔 — 노란 띠
//
// 진짜 화면은 치과 로그인과 올라온 스캔이 있어야 해서, 모양은 여기서 봅니다.
// =========================================================

import IncomingScanList from '@/components/order/IncomingScanList';
import type { IncomingScanRow, RescanWaitingOrder } from '@/server/repositories/device-link';

const base = {
  clinicNameInFile: '다서울치과',
  teeth: [16],
  fileSize: 65_000_000,
  uploadStatus: 'uploaded',
  createdAt: '2026-10-02T10:12:00',
};

const SCANS: IncomingScanRow[] = [
  {
    ...base,
    id: '1',
    patientName: '안현석',
    chartNo: '24447',
    scannedAt: '2026-10-02 19:00',
    fileName: '2026-10-02 안현석.dxd',
  },
  {
    ...base,
    id: '2',
    patientName: '김민수',
    chartNo: '31002',
    scannedAt: '2026-10-02 18:40',
    fileName: '2026-10-02 김민수.dxd',
    teeth: [24, 25],
  },
  {
    ...base,
    id: '3',
    patientName: '유제옥',
    chartNo: '',
    scannedAt: '2026-10-02 18:10',
    fileName: '2026-10-02 유제옥.dxd',
    clinicNameInFile: '부산웃는치과',
  },
  {
    ...base,
    id: '4',
    patientName: '성승윤',
    chartNo: '',
    scannedAt: '',
    fileName: '2026-10-02 성승윤.dxd',
    uploadStatus: 'pending',
  },
];

// ★ ①번 환자가 재스캔으로 걸려 있습니다
const WAITING: RescanWaitingOrder[] = [
  { id: 'o1', orderNo: 'ORD-261002-001', patientName: '안 현석', dueDate: '2026-10-12' },
];

export default function IncomingScansPlayground() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">들어온 스캔</h1>
        <p className="mt-1 text-[14px] text-[#7C8595]">
          구강스캐너에서 내보낸 스캔입니다. 주문서를 쓰면 이 목록에서 사라집니다.
        </p>
      </header>

      <IncomingScanList scans={SCANS} clinicName="다서울치과의원" rescanOrders={WAITING} />
    </div>
  );
}
