"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateTime } from "@/lib/utils";

export interface ReceiptData {
  receiptNo: string;
  academicYear: string;
  studentName: string;
  level: string; // ex: "2ème Lettres" ou "Bac Informatique" ou "1ère" (sans parenthèses)
  className: string; // ex: "2ème Lettres classe 3" ou "Non affecté"
  month: string;
  amountPaid: number;
  paymentMethod: string; // "Espèces" | "Chèque" | "Virement"
  date: Date;
  schoolName: string;
  schoolNameFr: string;
  schoolPhone: string;
  schoolAddress: string;
  schoolLogo: string;
}

// Composant d'un exemplaire individuel du reçu (strictement identique pour l'École et le Parent)
export function ReceiptCopy({
  data,
  isPrintVersion = false,
}: {
  data: ReceiptData;
  isPrintVersion?: boolean;
}) {
  const logoUrl = data.schoolLogo || "/logo-transparent.png";

  return (
    <div
      className={`relative bg-white text-slate-900 overflow-hidden box-border select-none flex flex-col justify-between ${
        isPrintVersion
          ? "print-receipt-copy"
          : "p-5 sm:p-6 border-[3px] border-double border-[#2B3F66] rounded-2xl shadow-sm min-h-[360px]"
      }`}
    >
      {/* Filigrane discret centré (~4% d'opacité, strictement confiné dans l'exemplaire) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.04] z-0 overflow-hidden">
        <img
          src={logoUrl}
          alt=""
          className={isPrintVersion ? "w-36 h-36 object-contain" : "w-52 h-52 object-contain"}
        />
      </div>

      <div className={`relative z-10 flex flex-col justify-between h-full ${isPrintVersion ? "" : "space-y-2.5"}`}>
        {/* EN-TÊTE : Logo + Noms Établissement (Arabe & Français) + Titre "REÇU DE PAIEMENT" & Numéro & Année */}
        <div className="flex items-start justify-between gap-3 border-b border-[#2B3F66]/20 pb-2">
          {/* Logo & Identité établissement */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt="Logo Établissement"
              className={isPrintVersion ? "h-11 w-auto max-w-[50px] object-contain shrink-0" : "h-13 w-auto max-w-[65px] object-contain shrink-0"}
              style={isPrintVersion ? { maxHeight: "42px" } : { maxHeight: "52px" }}
            />
            <div className="flex flex-col min-w-0">
              <span className={`font-arabic font-extrabold text-[#2B3F66] leading-tight truncate ${
                isPrintVersion ? "text-sm" : "text-base sm:text-lg"
              }`}>
                {data.schoolName}
              </span>
              <span className={`font-serif italic font-semibold text-[#7A2E3A] tracking-wide mt-0.5 truncate ${
                isPrintVersion ? "text-[10px]" : "text-[11px]"
              }`}>
                {data.schoolNameFr}
              </span>
              <span className="text-[9px] text-slate-500 font-medium mt-0.5 truncate">
                {data.schoolAddress} &bull; Tél : {data.schoolPhone}
              </span>
            </div>
          </div>

          {/* Titre REÇU DE PAIEMENT + N° + Année Scolaire */}
          <div className="flex flex-col items-end text-right shrink-0">
            <div className={`font-serif font-black text-[#2B3F66] tracking-tight ${
              isPrintVersion ? "text-sm" : "text-sm sm:text-base"
            }`}>
              REÇU DE PAIEMENT
            </div>
            <div className="text-xs font-mono font-bold text-[#7A2E3A] mt-0.5">
              N° {data.receiptNo}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5">
              Année Scolaire {data.academicYear}
            </div>
          </div>
        </div>

        {/* INFORMATIONS ÉLÈVE & SCOLARITÉ (4 CHAMPS DISTINCTS SANS AUCUNE PARENTHÈSE) */}
        <div className={`grid grid-cols-4 gap-2 border-b border-slate-200 ${
          isPrintVersion ? "py-1.5" : "py-2"
        }`}>
          <div className="min-w-0">
            <span className="text-[8.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Élève
            </span>
            <span
              className={`font-bold text-slate-900 leading-tight block break-words ${
                isPrintVersion ? "text-xs line-clamp-2 max-h-[2.5rem]" : "text-xs sm:text-sm truncate"
              }`}
              title={data.studentName}
            >
              {data.studentName}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[8.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Niveau
            </span>
            <span className="font-bold text-xs text-slate-800 block truncate">
              {data.level}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[8.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Classe
            </span>
            <span className="font-bold text-xs text-slate-800 block truncate">
              {data.className}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[8.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Mois Concerné
            </span>
            <span className="font-bold text-xs text-slate-900 capitalize block truncate">
              {data.month}
            </span>
          </div>
        </div>

        {/* MONTANT VERSÉ MIS EN VALEUR (AÉRÉ, UNIQUEMENT LE MONTANT EFFECTIF) */}
        <div className={`rounded-xl bg-[#F8FAFC] border border-[#2B3F66]/20 flex items-center justify-between ${
          isPrintVersion ? "p-2.5" : "p-3"
        }`}>
          <div className="flex items-baseline gap-2.5">
            <span className={`uppercase font-extrabold tracking-wider text-[#2B3F66] ${
              isPrintVersion ? "text-[10px]" : "text-[11px]"
            }`}>
              Montant versé :
            </span>
            <span className={`font-black font-mono text-[#2E7D5B] tracking-tight ${
              isPrintVersion ? "text-2xl" : "text-2xl sm:text-3xl"
            }`}>
              {data.amountPaid} DT
            </span>
          </div>

          {/* Mode de règlement & Date et heure exacte */}
          <div className="flex flex-col items-end text-right gap-0.5 text-[10.5px] text-slate-600">
            <div>
              Mode : <strong className="font-bold text-slate-900">{data.paymentMethod}</strong>
            </div>
            <div className="text-[9.5px] text-slate-500">
              Date : <strong className="text-slate-800 font-semibold">{formatDateTime(data.date)}</strong>
            </div>
          </div>
        </div>

        {/* ZONES SIGNATURE & CACHET */}
        <div className={`flex items-start justify-between gap-6 border-t border-[#2B3F66]/20 ${
          isPrintVersion ? "pt-1.5" : "pt-2"
        }`}>
          {/* Emplacement Signature de l'administration */}
          <div className="flex-1 flex flex-col justify-between text-xs text-slate-700">
            <span className="font-bold text-slate-800 text-[10.5px]">Signature de l'administration</span>
            <div className={`w-full border-b border-slate-300 mt-1 ${
              isPrintVersion ? "h-9" : "h-10 sm:h-12"
            }`} />
          </div>

          {/* Emplacement réservé pour le Cachet */}
          <div className="flex flex-col items-center justify-between text-xs text-slate-700">
            <span className="font-bold text-slate-800 text-[10.5px] mb-0.5">Cachet de l'établissement</span>
            <div className={`border-2 border-dashed border-[#2B3F66]/30 rounded-xl flex items-center justify-center text-[9px] text-slate-400 bg-slate-50/50 ${
              isPrintVersion ? "h-9 w-32" : "h-10 sm:h-12 w-36 sm:w-40"
            }`}>
              (Emplacement Cachet)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant de la modale avec aperçu écran + portail dédié pour impression A4
export function PaymentReceiptModal({
  receiptData,
  onClose,
}: {
  receiptData: ReceiptData | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* 1. CONTENEUR D'IMPRESSION DÉDIÉ MONTÉ DIRECTEMENT DANS BODY VIA PORTAL (EXACTEMENT 210mm x 297mm) */}
      {mounted &&
        receiptData &&
        createPortal(
          <div id="print-root">
            <div className="print-receipt-sheet">
              {/* 1er Exemplaire (Haut de page, 148mm) */}
              <ReceiptCopy data={receiptData} isPrintVersion={true} />

              {/* LIGNE DE DÉCOUPE UNIQUE EXACTEMENT AU MILIEU (148,5mm du haut) */}
              <div className="print-cut-line">
                <span className="print-cut-line-text">
                  ✂ Ligne de découpe (Exemplaire École / Exemplaire Parent)
                </span>
              </div>

              {/* 2ème Exemplaire (Bas de page, 148mm) */}
              <ReceiptCopy data={receiptData} isPrintVersion={true} />
            </div>
          </div>,
          document.body
        )}

      {/* 2. MODALE D'APERÇU À L'ÉCRAN (Accessible et responsive) */}
      <AnimatePresence>
        {receiptData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-3xl bg-slate-100 dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
            >
              {/* BARRE D'OUTILS DE LA MODALE */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-300 dark:border-slate-800 shrink-0 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#2B3F66] text-white flex items-center justify-center shadow-sm shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight truncate">
                      Reçu de paiement prêt à l'impression
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Format A4 portrait &bull; 2 exemplaires identiques &bull; N° {receiptData.receiptNo}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-5 py-2.5 rounded-2xl bg-[#2B3F66] hover:bg-[#1E2D4A] text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition transform active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer (A4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                    title="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* APERÇU FIDÈLE DU REÇU À L'ÉCRAN DÉFILABLE */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* 1er Exemplaire */}
                <ReceiptCopy data={receiptData} />

                {/* Ligne de découpe visible sur l'aperçu */}
                <div className="flex items-center justify-center my-3 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-b-2 border-dashed border-[#7A2E3A]/40" />
                  </div>
                  <span className="relative bg-slate-100 dark:bg-slate-900 px-4 text-xs font-bold text-[#7A2E3A] rounded-full">
                    ✂ Ligne de découpe (Exemplaire École / Exemplaire Parent)
                  </span>
                </div>

                {/* 2ème Exemplaire */}
                <ReceiptCopy data={receiptData} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PaymentReceiptModal;
