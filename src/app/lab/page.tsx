import { requireSector } from '@/server/policies/session';
import LogoutButton from '@/components/logout-button';

export default async function LabPage() {
  const session = await requireSector('lab');

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">🔧 기공소 관리 화면</h1>
      <p className="mt-4 text-gray-600">기공 작업 / 제작 관리 / 배송</p>
      <div className="mt-8 rounded-lg border bg-gray-50 p-5 text-sm">
        <p>조직 <b>{session.orgName}</b></p>
        <p className="mt-1">계정 {session.email} · 권한 {session.role}</p>
      </div>
      <LogoutButton />
    </main>
  );
}
