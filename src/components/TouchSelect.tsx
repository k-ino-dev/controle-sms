"use client";

import { useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface TouchSelectOption {
  value: string;
  label: string;
  badge?: string | number;
  sublabel?: string;
}

interface TouchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TouchSelectOption[];
  title?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  icon?: ReactNode;
}

export function TouchSelect({
  value,
  onChange,
  options,
  title = "Sélectionner une option",
  placeholder = "Choisir...",
  disabled = false,
  className = "",
  buttonClassName = "",
  icon,
}: TouchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Verrouiller le défilement de la page arrière quand le panneau est ouvert
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Réinitialiser la recherche à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Fermer sur Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const filteredOptions = searchQuery.trim()
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
          {/* Arrière-plan flou et assombri, se ferme en touchant dehors */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Conteneur de la feuille (Bottom Sheet sur mobile, modale centrée sur desktop) */}
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              maxHeight: "min(70dvh, 520px)",
              minHeight: options.length > 2 ? "min(280px, 45dvh)" : "auto",
            }}
          >
            {/* Poignée tactile pour mobile */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* En-tête fixe avec titre et bouton croix de fermeture */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {title}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Champ de recherche si plus de 8 options */}
            {options.length > 8 && (
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-900/60">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher une option..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Zone centrale défilable avec flex: 1 1 auto; min-height: 0 */}
            <div
              className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 sm:p-3 overscroll-contain"
              style={{ flex: "1 1 auto", minHeight: 0 }}
            >
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Aucune option trouvée
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full min-h-[48px] px-4 py-3 rounded-2xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold"
                          : "text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold"
                      }`}
                    >
                      <div className="flex flex-col min-w-0 mr-2">
                        <span className="text-sm sm:text-base leading-snug truncate">
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-xs text-slate-400 dark:text-slate-400 font-normal">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {opt.badge !== undefined && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Marge de sécurité pour mobile au-dessus de la barre de navigation */}
            <div className="sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Bouton déclencheur tactile */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${buttonClassName}`}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0">
          {icon && <span className="shrink-0 text-indigo-500">{icon}</span>}
          <span
            className={`truncate text-sm sm:text-base font-bold ${
              selectedOption
                ? "text-slate-900 dark:text-white"
                : "text-slate-400 dark:text-slate-500 font-normal"
            }`}
          >
            {displayText}
          </span>
          {selectedOption?.badge !== undefined && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200" />
      </button>

      {/* Rendu du panneau dans un portail au niveau de body */}
      {mounted && createPortal(modalContent, document.body)}
    </div>
  );
}

export default TouchSelect;
