import { requireSector } from "@/server/policies/session";
import SectorShell from "@/components/layout/SectorShell";
import { canSeeMoney, type MemberRole } from "@/server/domain/member";
import NotificationBell from "@/components/layout/NotificationBell";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/server/repositories/notification";

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSector("design_center");
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
  ]);
  return (
    <SectorShell sector="design_center" isManager={canSeeMoney(s.role as MemberRole | null)} orgName={s.orgName ?? ""} userName={s.userName}
      bell={<NotificationBell notifications={notifications} unreadCount={unreadCount} />}
    >
      {children}
    </SectorShell>
  );
}
