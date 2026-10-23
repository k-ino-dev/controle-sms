"use client";

import Link from "next/link";
import { SmsServicePill } from "./SmsServicePill";
import { ThemeToggle } from "./ThemeToggle";

export function MobileHeader({
  schoolName = "معهد الامتياز الخاص",
  schoolLogo = "/logo-transparent.png",
}: {
  schoolName?: string;
  schoolLogo?: string;
}) {
  return (
    <header className="md:hidden sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-2.5 flex items-center justify-between shadow-sm">
      <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
        <img
          src={schoolLogo}
          alt="Logo Établissement"
          className="h-9 w-auto max-w-[44px] object-contain shrink-0 group-hover:scale-105 transition-transform"
        />
        <div className="flex flex-col min-w-0">
          <span className="font-arabic font-extrabold text-sm text-[#2B3F66] dark:text-indigo-400 leading-tight truncate">
            {schoolName}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-none mt-0.5">
            Contrôle SMS
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        <SmsServicePill />
        <ThemeToggle />
      </div>
    </header>
  );
}
