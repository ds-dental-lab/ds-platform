import { requireSector } from "@/server/policies/session";
import SectorShell from "@/components/layout/SectorShell";
import { canSeeMoney, type MemberRole } from "@/server/domain/member";
import NotificationBell from "@/components/layout/NotificationBell";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/server/repositories/notification";
import { countPendingSignups } from "@/server/repositories/signup";
import { countNewContacts } from "@/server/repositories/contact";

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSector("design_center");
  const isManager = canSeeMoney(s.role as MemberRole | null);

  const [notifications, unreadCount, pendingSignups, newContacts] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
    /*
      ★ 기다리는 가입 신청을 사이드바에 띄웁니다.
        승인 화면에 들어가야만 보이면, 아무도 안 들어가는 날에는
        그 치과가 하루 종일 아무것도 못 합니다.
        메뉴 자체가 관리자에게만 보이므로 셀 일도 관리자일 때뿐입니다.
    */
    isManager ? countPendingSignups() : Promise.resolve(0),
    isManager ? countNewContacts() : Promise.resolve(0),
  ]);

  return (
    <SectorShell sector="design_center" isManager={isManager} orgName={s.orgName ?? ""} userName={s.userName}
      navCounts={{ "/design/signups": pendingSignups, "/design/contacts": newContacts }}
      bell={<NotificationBell notifications={notifications} unreadCount={unreadCount} pushKey={process.env.VAPID_PUBLIC_KEY ?? null} />}
    >
      {children}
    </SectorShell>
  );
}
