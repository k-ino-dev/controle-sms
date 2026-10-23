"use client";

import { ThemeToggle } from "./ThemeToggle";
import { SmsServicePill } from "./SmsServicePill";
import { User, Bell, Sparkles } from "lucide-react";

export function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* SMS Service Pill (visible sur desktop et tablette) */}
        <div className="hidden sm:block">
          <SmsServicePill />
        </div>

        {/* Année Scolaire Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>2026-2027</span>
        </div>

        {/* Theme Toggle sur mobile (sur desktop il est aussi dans la sidebar) */}
        <div className="md:hidden">
          <ThemeToggle />
        </div>

        {/* Directeur Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
            D
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Directeur
            </span>
            <span className="text-[10px] text-slate-400">Administrateur</span>
          </div>
        </div>
      </div>
    </header>
  );
}
