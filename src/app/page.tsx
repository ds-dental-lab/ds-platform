import { redirect } from "next/navigation";
import { getSession } from "@/server/policies/session";
import LogoutButton from "@/components/logout-button";

const HOME_BY_SECTOR = {
  clinic: "/clinic",
  design_center: "/design",
  lab: "/lab",
} as const;

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.orgType) {
    redirect(HOME_BY_SECTOR[session.orgType]);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 p-6">
      <div className="rounded-lg border bg-white p-10 text-center">
        <h1 className="text-lg font-bold">소속된 조직이 없습니다</h1>
        <p className="mt-3 text-sm text-gray-500">{session.email}</p>
        <LogoutButton />
      </div>
    </main>
  );
}
