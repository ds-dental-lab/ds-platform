import { requireSector } from "@/server/policies/session";
import SectorShell from "@/components/layout/SectorShell";

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSector("lab");
  return (
    <SectorShell sector="lab" orgName={s.orgName ?? ""} email={s.email} role={s.role}>
      {children}
    </SectorShell>
  );
}
