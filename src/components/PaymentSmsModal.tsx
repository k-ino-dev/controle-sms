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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  calculateSmsSegments,
  formatSmsMessage,
  MONTHS_MAP,
  toArabicMonth,
} from "@/lib/sms";
import { DEFAULT_TEMPLATES } from "@/lib/sms/templates";
import { TouchSelect } from "./TouchSelect";

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
  const [selectedMonth, setSelectedMonth] = useState<string>(toArabicMonth(defaultMonth));
  const [amount, setAmount] = useState<number>(dueAmount);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    sentToday: boolean;
    lastSentAt: string | null;
    type: string | null;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchroniser mois et montant quand student ou defaultMonth change
  useEffect(() => {
    if (student) {
      const arMonth = toArabicMonth(defaultMonth);
      setSelectedMonth(arMonth);
      setAmount(dueAmount || student.monthlyTarif || 105);
    }
  }, [student, defaultMonth, dueAmount]);

  // Verrouiller le défilement de la page arrière quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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

  // Textes formatés finaux avec mois toujours en arabe
  const opt1FinalText = formatSmsMessage(opt1Template, {
    studentName: studentFullName,
    month: selectedMonth,
    amount: String(amount),
  });

  const opt2FinalText = formatSmsMessage(opt2Template, {
    studentName: studentFullName,
    month: selectedMonth,
    amount: String(amount),
  });

  const activeMessage = selectedOption === 1 ? opt1FinalText : opt2FinalText;
  const { charCount, segments } = calculateSmsSegments(activeMessage);

  const handleMonthChange = (newArabicMonth: string) => {
    setSelectedMonth(newArabicMonth);

    // Mettre à jour le montant restant automatiquement si l'élève a des données pour ce mois
    const monthObj = MONTHS_MAP.find((m) => m.ar === newArabicMonth);
    if (monthObj && student.months?.[monthObj.fr]) {
      const mData = student.months[monthObj.fr];
      const remaining = Math.max(0, mData.dueAmount - (mData.paidAmount || 0));
      if (remaining > 0) {
        setAmount(remaining);
      } else if (mData.dueAmount > 0) {
        setAmount(mData.dueAmount);
      }
    }
  };

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

  const monthOptions = MONTHS_MAP.map((m) => ({
    value: m.ar,
    label: `${m.ar} (${m.label})`,
  }));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
        {/* Fond assombri */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Boîte modale / Bottom sheet */}
        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-xl max-h-[90dvh] sm:max-h-[85vh] bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Poignée mobile */}
          <div className="sm:hidden pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* En-tête FIXE */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  Envoyer un SMS de Paiement
                </h3>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {studentFullName} &bull; {student.className} &bull; {student.parentPhone}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenu DÉFILABLE au milieu */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 overscroll-contain">
            {/* Avertissement anti-doublon */}
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
                    <strong>{duplicateWarning.lastSentAt}</strong>.
                  </div>
                </div>
              </motion.div>
            )}

            {/* Sélecteur de Mois et Montant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mois d'échéance :
                </label>
                <TouchSelect
                  title="Choisir le mois d'échéance"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  options={monthOptions}
                  icon={<Calendar className="w-4 h-4" />}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Montant dû (DT) :
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            {/* Choix entre Option 1 et Option 2 */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Choisissez le ton du message :
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1 : Rappel Simple */}
                <button
                  type="button"
                  onClick={() => setSelectedOption(1)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative min-h-[80px] ${
                    selectedOption === 1
                      ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30 text-blue-900 dark:text-blue-100"
                      : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-500 text-white">
                      Option 1
                    </span>
                    {selectedOption === 1 && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-0.5">
                    Rappel Simple
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Notification courtoise de non-paiement.
                  </div>
                </button>

                {/* Option 2 : Avertissement Ferme */}
                <button
                  type="button"
                  onClick={() => setSelectedOption(2)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative min-h-[80px] ${
                    selectedOption === 2
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 text-amber-900 dark:text-amber-100"
                      : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-white">
                      Option 2
                    </span>
                    {selectedOption === 2 && (
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-0.5">
                    Avertissement Ferme
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Avertissement solennel d'exclusion en cas de non-règlement.
                  </div>
                </button>
              </div>
            </div>

            {/* Aperçu du texte envoyé & compteur */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Message final envoyé au parent :
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                  {charCount} car. &bull; {segments} segment{segments > 1 ? "s" : ""}
                </span>
              </div>

              <div
                dir="rtl"
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-sm font-arabic leading-relaxed text-slate-800 dark:text-slate-100 select-all"
              >
                {activeMessage}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Pied de page FIXE avec boutons toujours visibles */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={`min-h-[44px] px-6 py-2.5 rounded-2xl font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                selectedOption === 1
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-amber-600 hover:bg-amber-500"
              }`}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours...</span>
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
