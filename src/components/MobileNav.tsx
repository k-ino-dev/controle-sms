"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MoreHorizontal,
  X,
  Check,
  ChevronRight,
  School,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_NAV_ITEMS, NavigationItem } from "@/lib/navigation";

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Verrouiller le défilement de l'arrière-plan quand le menu Plus est ouvert
  useEffect(() => {
    if (moreOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [moreOpen]);

  // Fermer le panneau quand l'URL change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Séparation selon la source unique de vérité : 4 items principaux + 1 central mis en valeur
  const homeItem = ALL_NAV_ITEMS.find((i) => i.id === "dashboard")!;
  const elevesItem = ALL_NAV_ITEMS.find((i) => i.id === "eleves")!;
  const presenceItem = ALL_NAV_ITEMS.find((i) => i.id === "presence")!;
  const paiementsItem = ALL_NAV_ITEMS.find((i) => i.id === "paiements")!;

  // Items dans le panneau "Plus" (Classes, Historique SMS, Paramètres, etc.)
  const moreItems = ALL_NAV_ITEMS.filter((i) => !i.inBottomBar);

  // Le bouton "Plus" est surligné si la page courante est l'une de celles du panneau Plus
  const isMoreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <>
      {/* 1. BARRE DU BAS FIXE (5 entrées maximum pour lisibilité optimale sur petit écran) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 safe-bottom bottom-nav shadow-lg">
        <div className="flex items-center justify-around">
          {/* 1. Accueil */}
          <Link
            href={homeItem.href}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 px-1 rounded-xl transition-all ${
              pathname === homeItem.href
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <homeItem.icon className="w-5 h-5" />
              {pathname === homeItem.href && (
                <motion.div
                  layoutId="mobile-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
                />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate">
              {homeItem.shortName}
            </span>
          </Link>

          {/* 2. Élèves */}
          <Link
            href={elevesItem.href}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 px-1 rounded-xl transition-all ${
              pathname === elevesItem.href
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <elevesItem.icon className="w-5 h-5" />
              {pathname === elevesItem.href && (
                <motion.div
                  layoutId="mobile-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
                />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate">
              {elevesItem.shortName}
            </span>
          </Link>

          {/* 3. Contrôle (Bouton central d'appel mis en valeur) */}
          <Link
            href={presenceItem.href}
            className="relative -top-3.5 flex flex-col items-center justify-center group"
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                pathname === presenceItem.href
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-emerald-500/25 shadow-emerald-500/30"
                  : "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white ring-4 ring-indigo-500/20 shadow-indigo-500/30"
              }`}
            >
              <presenceItem.icon className="w-6 h-6" />
            </motion.div>
            <span
              className={`text-[10px] mt-1 font-bold ${
                pathname === presenceItem.href
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {presenceItem.shortName}
            </span>
          </Link>

          {/* 4. Paiements */}
          <Link
            href={paiementsItem.href}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 px-1 rounded-xl transition-all ${
              pathname === paiementsItem.href
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <paiementsItem.icon className="w-5 h-5" />
              {pathname === paiementsItem.href && (
                <motion.div
                  layoutId="mobile-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
                />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate">
              {paiementsItem.shortName}
            </span>
          </Link>

          {/* 5. Plus (Bouton d'accès aux autres pages dont Classes) */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 px-1 rounded-xl transition-all cursor-pointer ${
              isMoreActive || moreOpen
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
            aria-label="Plus de pages"
          >
            <div className="relative">
              <MoreHorizontal className="w-5 h-5" />
              {isMoreActive && (
                <motion.div
                  layoutId="mobile-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
                />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate">Plus</span>
          </button>
        </div>
      </nav>

      {/* 2. PANNEAU BOTTOM SHEET DU MENU "PLUS" */}
      <AnimatePresence>
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-[70] flex flex-col justify-end">
            {/* Arrière-plan flou et assombri, se ferme en touchant dehors */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Conteneur Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden"
            >
              {/* Poignée tactile mobile */}
              <div className="pt-3 pb-1 flex justify-center">
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* En-tête avec titre et bouton croix de fermeture */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Autres modules
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Toutes les fonctionnalités de l'établissement
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Fermer le menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grandes cartes tactiles défilables */}
              <div className="p-4 space-y-3 overflow-y-auto min-h-0 overscroll-contain pb-[max(2rem,env(safe-area-inset-bottom))]">
                {moreItems.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`min-h-[64px] p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isActive
                          ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 dark:text-indigo-100 shadow-sm"
                          : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                              : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700 shadow-sm"
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm sm:text-base leading-tight truncate">
                              {item.name}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                                Actif
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center shrink-0 text-slate-400">
                        {isActive ? (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default MobileNav;
