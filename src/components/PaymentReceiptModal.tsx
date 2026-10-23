"use client";

import React from "react";
import { Printer, X } from "lucide-react";
import { motion } from "framer-motion";
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

// Composant d'un exemplaire individuel (Deux exemplaires strictement identiques)
function ReceiptCopy({ data }: { data: ReceiptData }) {
  const logoUrl = data.schoolLogo || "/logo-transparent.png";

  return (
    <div className="print-receipt-copy relative bg-white text-slate-900 border-[3.5px] border-double border-[#2B3F66] rounded-2xl p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-sm">
      {/* Filigrane discret en arrière-plan (~5% d'opacité) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.05] z-0">
        <img
          src={logoUrl}
          alt=""
          className="w-64 h-64 object-contain"
        />
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* EN-TÊTE : Logo + Noms Établissement (Arabe & Français) + Titre "REÇU DE PAIEMENT" & Numéro & Année */}
        <div className="flex items-start justify-between gap-4 border-b border-[#2B3F66]/20 pb-2.5">
          {/* Logo & Identité école */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoUrl}
              alt="Logo Établissement"
              className="h-16 w-auto max-w-[80px] object-contain shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-arabic font-extrabold text-xl text-[#2B3F66] leading-tight">
                {data.schoolName}
              </span>
              <span className="font-serif italic font-semibold text-xs text-[#7A2E3A] tracking-wide mt-0.5">
                {data.schoolNameFr}
              </span>
              <span className="text-[11px] text-slate-500 font-medium mt-1">
                {data.schoolAddress} &bull; Tél : {data.schoolPhone}
              </span>
            </div>
          </div>

          {/* Titre REÇU DE PAIEMENT + N° + Année Scolaire (Identique sur les deux exemplaires, aucun badge) */}
          <div className="flex flex-col items-end text-right shrink-0">
            <div className="font-serif font-black text-base text-[#2B3F66] tracking-tight">
              REÇU DE PAIEMENT
            </div>
            <div className="text-xs font-mono font-bold text-[#7A2E3A] mt-0.5">
              N° {data.receiptNo}
            </div>
            <div className="text-[10.5px] text-slate-500 font-semibold mt-0.5">
              Année Scolaire {data.academicYear}
            </div>
          </div>
        </div>

        {/* INFORMATIONS ÉLÈVE & SCOLARITÉ (4 CHAMPS DISTINCTS SANS AUCUNE PARENTHÈSE) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-slate-200">
          <div>
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Élève
            </span>
            <span className="font-bold text-sm text-slate-900 leading-tight block truncate">
              {data.studentName}
            </span>
          </div>

          {/* Niveau séparé, sans aucune parenthèse */}
          <div>
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Niveau
            </span>
            <span className="font-bold text-xs text-slate-800 block">
              {data.level}
            </span>
          </div>

          {/* Classe séparée, sans aucune parenthèse */}
          <div>
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Classe
            </span>
            <span className="font-bold text-xs text-slate-800 block truncate">
              {data.className}
            </span>
          </div>

          <div>
            <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#7A2E3A] block">
              Mois Concerné
            </span>
            <span className="font-bold text-xs text-slate-900 capitalize block">
              {data.month}
            </span>
          </div>
        </div>

        {/* MONTANT VERSÉ MIS EN VALEUR (AÉRÉ, GRANDES DIMENSIONS, UNIQUEMENT LE MONTANT EFFECTIF) */}
        <div className="my-2 p-4 rounded-xl bg-[#F8FAFC] border border-[#2B3F66]/25 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#2B3F66]">
              Montant versé :
            </span>
            <span className="text-3xl font-black font-mono text-[#2E7D5B] tracking-tight">
              {data.amountPaid} DT
            </span>
          </div>

          {/* Mode de règlement & Date et heure exacte */}
          <div className="flex flex-col items-end text-right gap-1 text-xs text-slate-600">
            <div>
              Mode de règlement : <strong className="font-bold text-slate-900">{data.paymentMethod}</strong>
            </div>
            <div className="text-[11px] text-slate-500">
              Date et heure : <strong className="text-slate-800 font-semibold">{formatDateTime(data.date)}</strong>
            </div>
          </div>
        </div>

        {/* ZONES SIGNATURE & CACHET (ESPACÉES ET AÉRÉES POUR APPLICATION PROPRE DU TAMPON) */}
        <div className="pt-3 flex items-start justify-between gap-8 border-t border-[#2B3F66]/20">
          {/* Emplacement Signature de l'administration */}
          <div className="flex-1 flex flex-col justify-between text-xs text-slate-700">
            <span className="font-bold text-slate-800">Signature de l'administration</span>
            <div className="h-16 w-full border-b border-slate-300 mt-2" />
          </div>

          {/* Emplacement réservé pour le Cachet */}
          <div className="flex flex-col items-center justify-between text-xs text-slate-700">
            <span className="font-bold text-slate-800 mb-1">Cachet de l'établissement</span>
            <div className="h-16 w-44 border-2 border-dashed border-[#2B3F66]/30 rounded-xl flex items-center justify-center text-[10px] text-slate-400 bg-slate-50/50">
              (Emplacement Cachet)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modale complète avec barre d'outils et affichage des 2 exemplaires A4
export function PaymentReceiptModal({
  receiptData,
  onClose,
}: {
  receiptData: ReceiptData | null;
  onClose: () => void;
}) {
  if (!receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receipt-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="receipt-modal-card w-full max-w-3xl bg-slate-100 rounded-3xl p-4 sm:p-6 shadow-2xl relative my-auto"
      >
        {/* BARRE D'OUTILS DE LA MODALE (Masquée à l'impression) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-300 no-print mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#2B3F66] text-white flex items-center justify-center shadow-sm">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                Reçu de paiement prêt à l'impression
              </h3>
              <p className="text-xs text-slate-500">
                Format A4 portrait &bull; 2 exemplaires identiques (École et Parent)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-[#2B3F66] hover:bg-[#1E2D4A] text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENEUR IMPRIMABLE CONTENANT LES DEUX EXEMPLAIRES SÉPARÉS PAR POINTILLÉS */}
        <div className="print-receipt-container space-y-4">
          {/* 1er Exemplaire */}
          <ReceiptCopy data={receiptData} />

          {/* LIGNE DE DÉCOUPE AVEC CISEAUX AU MILIEU */}
          <div className="print-divider" />

          {/* 2ème Exemplaire (Strictement identique) */}
          <ReceiptCopy data={receiptData} />
        </div>
      </motion.div>
    </div>
  );
}
