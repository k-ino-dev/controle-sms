"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCheck,
  GraduationCap,
  CreditCard,
  Settings,
  MessageSquareText,
} from "lucide-react";
import { motion } from "framer-motion";

const mobileItems = [
  { name: "Accueil", href: "/", icon: LayoutDashboard },
  { name: "Contrôle", href: "/presence", icon: UserCheck, special: true },
  { name: "Élèves", href: "/eleves", icon: GraduationCap },
  { name: "Paiements", href: "/paiements", icon: CreditCard },
  { name: "SMS", href: "/sms", icon: MessageSquareText },
  { name: "Réglages", href: "/parametres", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 safe-bottom bottom-nav shadow-lg">
      <div className="flex items-center justify-around">
        {mobileItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.special) {
            // Bouton spécial tactile pour le contrôle d'absence en classe
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-3 flex flex-col items-center justify-center"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                    isActive
                      ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-emerald-500/20"
                      : "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white ring-4 ring-indigo-500/20"
                  }`}
                >
                  <Icon className="w-7 h-7" />
                </motion.div>
                <span
                  className={`text-[10px] mt-1 font-bold ${
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Contrôle
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-1 rounded-xl transition-all ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isActive && (
                  <motion.div
                    layoutId="mobile-dot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
                  />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
