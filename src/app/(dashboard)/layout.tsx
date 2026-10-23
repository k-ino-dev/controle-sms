import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";
import { SmsBalanceBanner } from "@/components/SmsServicePill";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Nom et Logo de l'établissement configurés
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["school_name", "school_logo"] } },
  });
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const schoolName = settingsMap["school_name"] || "معهد الامتياز الخاص";
  const schoolLogo = settingsMap["school_logo"] || "/logo-transparent.png";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-slate-100 font-sans">
      {/* Barre latérale desktop */}
      <Sidebar schoolName={schoolName} schoolLogo={schoolLogo} />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* En-tête mobile avec logo */}
        <MobileHeader schoolName={schoolName} schoolLogo={schoolLogo} />

        {/* Alerte si le solde SMS est bas ou en échec */}
        <SmsBalanceBanner />

        {/* Zone de contenu défilable */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-28 md:pb-10">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>

        {/* Barre de navigation mobile basse */}
        <MobileNav />
      </div>
    </div>
  );
}
