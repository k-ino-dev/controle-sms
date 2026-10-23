"use client";

import { useState, useEffect } from "react";
import {
  X,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  Calendar,
  Sparkles,
  ShieldAlert,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateSmsSegments, formatSmsMessage } from "@/lib/sms";
import { DEFAULT_TEMPLATES } from "@/lib/sms/templates";

interface PaymentSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  defaultMonth?: string;
  dueAmount?: number;
  schoolSettings?: any;
  onSuccess?: (msg: string) => void;
}

export function PaymentSmsModal({
  isOpen,
  onClose,
  student,
  defaultMonth = "octobre",
  dueAmount = 105,
  schoolSettings,
  onSuccess,
}: PaymentSmsModalProps) {
  const [selectedOption, setSelectedOption] = useState<1 | 2>(1);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [amount, setAmount] = useState<number>(dueAmount);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    sentToday: boolean;
    lastSentAt: string | null;
    type: string | null;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchroniser mois et montant quand student change
  useEffect(() => {
    if (student) {
      setSelectedMonth(defaultMonth);
      setAmount(dueAmount || student.monthlyTarif || 105);
    }
  }, [student, defaultMonth, dueAmount]);

  // Vérification anti-doublon à l'ouverture de la modale
  useEffect(() => {
    if (isOpen && student?.id) {
      setLoadingCheck(true);
      fetch(`/api/paiements/rappel?studentId=${student.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.sentToday) {
            setDuplicateWarning(data);
          } else {
            setDuplicateWarning(null);
          }
        })
        .catch(() => setDuplicateWarning(null))
        .finally(() => setLoadingCheck(false));
    } else {
      setDuplicateWarning(null);
      setErrorMsg(null);
    }
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const opt1Template =
    schoolSettings?.sms_template_payment_opt1 || DEFAULT_TEMPLATES.sms_template_payment_opt1;
  const opt2Template =
    schoolSettings?.sms_template_payment_opt2 || DEFAULT_TEMPLATES.sms_template_payment_opt2;

  const studentFullName = `${student.firstName} ${student.lastName}`;

  // Textes formatés finaux
  const opt1FinalText = formatSmsMessage(opt1Template, {
    studentName: studentFullName,
    month: selectedMonth,
    amount: String(amount),
  });

  const opt2FinalText = formatSmsMessage(opt2Template, {
    studentName: studentFullName,
    month: selectedMonth,
  });

  const activeMessage = selectedOption === 1 ? opt1FinalText : opt2FinalText;
  const { charCount, segments } = calculateSmsSegments(activeMessage);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/paiements/rappel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          option: selectedOption,
          month: selectedMonth,
          amount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (onSuccess) {
          onSuccess(
            `✓ SMS (Option ${selectedOption}) mis en file pour le parent de ${studentFullName} !`
          );
        }
        onClose();
      } else {
        setErrorMsg(data.error || "Erreur lors de l'envoi du SMS.");
      }
    } catch {
      setErrorMsg("Erreur de connexion au serveur.");
    } finally {
      setSending(false);
    }
  };

  const arabicMonths = [
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
    "جانفي",
    "فيفري",
    "مارس",
    "أفريل",
    "ماي",
    "جوان",
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl p-5 sm:p-7 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Envoyer un SMS de Paiement
                </h3>
                <p className="text-xs text-slate-400">
                  {studentFullName} &bull; {student.className} &bull; Tel : {student.parentPhone}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={sending}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-4">
            {/* AVERTISSEMENT ANTI-DOUBLON SI DÉJÀ ENVOYÉ AUJOURD'HUI */}
            {duplicateWarning && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Attention doublon :</div>
                  <div>
                    Un SMS de paiement ({duplicateWarning.type}) a déjà été envoyé à cet élève aujourd'hui à{" "}
                    <strong>{duplicateWarning.lastSentAt}</strong>. Voulez-vous quand même renvoyer un SMS ?
                  </div>
                </div>
              </motion.div>
            )}

            {/* Sélecteur de Mois et Montant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Mois d'échéance :
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  {arabicMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Montant dû (DT) :
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* CHOIX ENTRE LES 2 OPTIONS (CARTES CLIQUABLES) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Choisissez le ton du message :
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1 : Rappel Simple */}
                <button
                  type="button"
                  onClick={() => setSelectedOption(1)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                    selectedOption === 1
                      ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30 text-blue-900 dark:text-blue-100"
                      : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-500 text-white">
                      Option 1
                    </span>
                    {selectedOption === 1 && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    Rappel Simple
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Message de courtoisie amical mentionnant le mois et le montant à régler.
                  </div>
                </button>

                {/* Option 2 : Avertissement Ferme */}
                <button
                  type="button"
                  onClick={() => setSelectedOption(2)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                    selectedOption === 2
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 text-amber-900 dark:text-amber-100"
                      : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-white">
                      Option 2
                    </span>
                    {selectedOption === 2 && (
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    Avertissement Ferme
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Avertissement solennel invitant à contacter l'école pour éviter la suspension des cours.
                  </div>
                </button>
              </div>
            </div>

            {/* APERÇU DU TEXTE ARABE FINAL & COMPTEUR DE SEGMENTS */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Message final envoyé au parent :
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                  {charCount} caractères &bull; {segments} segment{segments > 1 ? "s" : ""}
                </span>
              </div>

              <div
                dir="rtl"
                className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800 text-sm font-arabic leading-relaxed text-slate-800 dark:text-slate-100 select-all"
              >
                {activeMessage}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Footer Boutons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs text-white shadow-md flex items-center gap-2 transition cursor-pointer ${
                selectedOption === 1
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-amber-600 hover:bg-amber-500"
              }`}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mise en file d'attente...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Envoyer l'Option {selectedOption}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
