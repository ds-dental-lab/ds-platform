// =========================================================
// 놓을 위치: src/app/design/account/page.tsx
//
// 계정 정보. 우리 조직의 사업자 정보를 넣습니다.
//
// ★ 청구서에 그대로 실립니다.
//   비어 있으면 문서에 '-' 로 찍힙니다. 아직 개설 전이면 비워 둬도 됩니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireSession } from '@/server/policies/session';
import { getMyOrg, getMyAlimtalk } from '@/server/repositories/account';
import AccountForm from '@/components/account/AccountForm';
import MyAccountCard from '@/components/account/MyAccountCard';
import AlimtalkCard from '@/components/account/AlimtalkCard';
import ScannerDeviceCard from '@/components/account/ScannerDeviceCard';
import { listScannerDevices } from '@/server/repositories/device-link';
import { canManageMembers, type MemberRole } from '@/server/domain/member';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireSession();

  const [org, alimtalk, devices] = await Promise.all([
    getMyOrg(),
    getMyAlimtalk(),
    listScannerDevices(),
  ]);
  if (!org) notFound();

  return (
    <>
      <AccountForm org={org} editable={org.editable} basePath="/design" />

      {/*
        ★ 자기 비밀번호는 **누구나** 바꿉니다 (사용자 요청 2026-08-25).
          전에는 로그아웃하고 '비밀번호 찾기' 로 메일을 기다려야 했습니다 —
          잊어버린 것도 아닌데 그건 너무 멉니다. 그래서 아무도 안 바꿉니다.
      */}
      <MyAccountCard email={session.email} name={session.userName} />

      {/* ★ 자기 것만 고칩니다 — 관리자든 사용자든 모두에게 보입니다 */}
      {alimtalk && (
        <AlimtalkCard
          phone={alimtalk.phone}
          on={alimtalk.on}
          events={alimtalk.events}
          recent={alimtalk.recent}
        />
      )}

      {/*
        ★★ **설계 PC 연결** (2026-10-14). exocad 를 여는 일을 브라우저가
          `denflow://` 로 시키고 있었는데, 브라우저가 안 쏘면 **조용히**
          멈춥니다 — 창도 오류도 없이요. 이틀을 거기서 썼습니다.
          이 PC 를 기기로 묶어 두면 에이전트가 물어보고 가져갑니다.
      */}
      <ScannerDeviceCard
        devices={devices}
        canManage={canManageMembers(session.role as MemberRole | null)}
        sector="design_center"
      />
    </>
  );
}
