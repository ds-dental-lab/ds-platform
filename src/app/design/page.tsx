import { requireSector } from '@/server/policies/session';
import LogoutButton from '@/components/logout-button';

export default async function DesignPage() {
  const session = await requireSector('design_center');

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">🎨 디자인센터 관리 화면</h1>
      <p className="mt-4 text-gray-600">주문 접수 / 디자인 작업 / 기공 의뢰</p>
      <div className="mt-8 rounded-lg border bg-gray-50 p-5 text-sm">
        <p>조직 <b>{session.orgName}</b></p>
        <p className="mt-1">계정 {session.email} · 권한 {session.role}</p>
      </div>
      <LogoutButton />
    </main>
  );
}
