"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UserCheck,
  GraduationCap,
  School,
  CreditCard,
  MessageSquareText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { SmsServicePill } from "./SmsServicePill";
import { ThemeToggle } from "./ThemeToggle";

import { ALL_NAV_ITEMS } from "@/lib/navigation";

export function Sidebar({
  schoolName = "معهد الامتياز الخاص",
  schoolLogo = "/logo-transparent.png",
}: {
  schoolName?: string;
  schoolLogo?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <aside
      className={`hidden md:flex flex-col justify-between border-r border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl transition-all duration-300 relative z-30 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Bouton pour replier */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm z-40 transition"
        title={collapsed ? "Agrandir" : "Réduire"}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Header Sidebar : Logo & Titre (en mode replié : uniquement le logo) */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-center">
        <Link
          href="/"
          className={`flex items-center group transition-all ${
            collapsed ? "justify-center w-full" : "gap-3"
          }`}
          title={schoolName}
        >
          <img
            src={schoolLogo}
            alt="Logo Établissement"
            className="w-10 h-10 object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col overflow-hidden min-w-0"
            >
              <span className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">
                Contrôle SMS
              </span>
              <span className="text-xs text-[#2B3F66] dark:text-indigo-400 font-bold font-arabic truncate mt-0.5">
                {schoolName}
              </span>
            </motion.div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {ALL_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? item.highlight
                    ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "text-indigo-600 dark:text-indigo-300 font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
              }`}
              title={collapsed ? item.name : undefined}
            >
              {/* Sliding active pill indicator */}
              {isActive && (
                <motion.div
                  layoutId="active-nav-indicator"
                  className={`absolute inset-0 rounded-xl shadow-sm -z-10 ${
                    item.highlight
                      ? "bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30"
                      : "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/40"
                  }`}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive
                    ? item.highlight
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600"
                }`}
              />

              {!collapsed && <span className="truncate">{item.name}</span>}

              {/* Tag distinctif pour le contrôle d'absence */}
              {!collapsed && item.highlight && (
                <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500 text-white">
                  Direct
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer Sidebar : SMS Status, Theme Toggle, Déconnexion */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
        {!collapsed ? (
          <div className="px-1">
            <SmsServicePill />
          </div>
        ) : (
          <div className="flex justify-center">
            <Link href="/parametres" className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse block" title="Service SMS WinSMS" />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/40">
          <ThemeToggle />

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Déconnexion"
            className="flex items-center gap-2 p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-sm font-medium w-full justify-center"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
