import { requireSector } from "@/server/policies/session";
import SectorShell from "@/components/layout/SectorShell";

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSector("design_center");
  return (
    <SectorShell sector="design_center" orgName={s.orgName ?? ""} email={s.email} role={s.role}>
      {children}
    </SectorShell>
  );
}
