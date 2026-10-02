import { requireSector } from "@/server/policies/session";
import SectorShell from "@/components/layout/SectorShell";
import { canSeeMoney, type MemberRole } from "@/server/domain/member";
import NotificationBell from "@/components/layout/NotificationBell";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/server/repositories/notification";
import { scannerNavState } from "@/server/repositories/device-link";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSector("clinic");
  const [notifications, unreadCount, scanner] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
    // 스캐너를 연결한 치과에만 '들어온 스캔' 이 보입니다 (2026-10-02)
    scannerNavState(),
  ]);
  return (
    <SectorShell sector="clinic" isManager={canSeeMoney(s.role as MemberRole | null)} orgName={s.orgName ?? ""} userName={s.userName}
      features={{ scanner: scanner.linked }}
      navCounts={{ "/clinic/scans": scanner.waiting }}
      bell={<NotificationBell notifications={notifications} unreadCount={unreadCount} pushKey={process.env.VAPID_PUBLIC_KEY ?? null} />}
    >
      {children}
    </SectorShell>
  );
}
