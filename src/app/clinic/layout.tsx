import { requireSector } from "@/server/policies/session";
import SectorShell from "@/components/layout/SectorShell";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSector("clinic");
  return (
    <SectorShell sector="clinic" orgName={s.orgName ?? ""} email={s.email} role={s.role}>
      {children}
    </SectorShell>
  );
}
