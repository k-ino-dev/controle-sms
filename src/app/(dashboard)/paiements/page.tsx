"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  Printer,
  MessageSquare,
  X,
  Loader2,
  Calendar,
  Sparkles,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { formatCurrency, formatDate, numberToFrenchWords } from "@/lib/utils";
import { schoolMonths } from "@/lib/validation";
import { PaymentReceiptModal, ReceiptData } from "@/components/PaymentReceiptModal";
import { PaymentSmsModal } from "@/components/PaymentSmsModal";
import { TouchSelect } from "@/components/TouchSelect";
import { SECTIONS, isLegacySection } from "@/lib/sections";

const monthLabelsShort: Record<string, string> = {
  octobre: "Oct",
  novembre: "Nov",
  décembre: "Déc",
  janvier: "Jan",
  février: "Fév",
  mars: "Mar",
  avril: "Avr",
  mai: "Mai",
  juin: "Juin",
};

export default function PaiementsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [tarifs, setTarifs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Paramètres de l'école (adresse, téléphone, logo, etc.)
  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  // Filtres
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [hasLegacyStudents, setHasLegacyStudents] = useState(false);

  // Modale de saisie de paiement
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("octobre");
  const [inputAmount, setInputAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<"Espèces" | "Chèque" | "Virement">("Espèces");
  const [inputNotes, setInputNotes] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Modale d'impression de Reçu A4 (2 exemplaires conformes)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [paymentJustSaved, setPaymentJustSaved] = useState<ReceiptData | null>(null);

  // Modale d'envoi SMS de paiement (2 options au choix)
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsModalStudent, setSmsModalStudent] = useState<any | null>(null);
  const [smsModalMonth, setSmsModalMonth] = useState<string>("octobre");
  const [smsModalDue, setSmsModalDue] = useState<number>(105);
  const [smsSuccessToast, setSmsSuccessToast] = useState<string | null>(null);

  const openSmsModal = (student: any, month?: string) => {
    setSmsModalStudent(student);
    let targetMonth = month;
    if (!targetMonth) {
      const firstUnpaid = schoolMonths.find((m) => student.months[m]?.status !== "paid");
      targetMonth = firstUnpaid || "octobre";
    }
    const monthData = student.months[targetMonth];
    const due = monthData
      ? Math.max(0, monthData.dueAmount - (monthData.paidAmount || 0))
      : (student.monthlyTarif || 105);
    setSmsModalMonth(targetMonth);
    setSmsModalDue(due > 0 ? due : (student.monthlyTarif || 105));
    setSmsModalOpen(true);
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedClassId) params.set("classId", selectedClassId);
      if (selectedLevel) params.set("level", selectedLevel);
      if (selectedSection) params.set("section", selectedSection);

      const res = await fetch(`/api/paiements?${params.toString()}`);
      const data = await res.json();
      setStudents(data.students || []);
      if (data.tarifs) setTarifs(data.tarifs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLegacyInfo = async () => {
    try {
      const res = await fetch("/api/sections/legacy");
      const data = await res.json();
      if (data.success) {
        setHasLegacyStudents(data.studentsCount > 0);
      }
    } catch (err) {
      console.error("Erreur legacy info :", err);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      setClasses(data.classes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/parametres");
      const data = await res.json();
      if (data.success && data.settings) {
        setSchoolSettings(data.settings);
      }
    } catch (err) {
      console.error("Erreur lecture paramètres :", err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, selectedClassId, selectedLevel, selectedSection]);

  useEffect(() => {
    fetchClasses();
    fetchSettings();
    fetchLegacyInfo();
  }, []);

  const openPaymentModal = (student: any, month: string) => {
    setSelectedStudent(student);
    setSelectedMonth(month);
    setPaymentJustSaved(null);
    const monthData = student.months[month];
    const due = monthData?.dueAmount || student.monthlyTarif || 100;
    // Si déjà payé ou acompte, initialiser avec le reste ou montant plein
    const currentPaid = monthData?.paidAmount || 0;
    const remainingForMonth = Math.max(0, due - currentPaid);
    setInputAmount(remainingForMonth > 0 ? remainingForMonth : due);

    // Déterminer le mode de règlement si déjà saisi
    let existingMethod: "Espèces" | "Chèque" | "Virement" = "Espèces";
    let extraNotes = "";
    if (monthData?.notes) {
      if (monthData.notes.startsWith("Chèque")) {
        existingMethod = "Chèque";
        extraNotes = monthData.notes.replace(/^Chèque\s*[-:]?\s*/, "");
      } else if (monthData.notes.startsWith("Virement")) {
        existingMethod = "Virement";
        extraNotes = monthData.notes.replace(/^Virement\s*[-:]?\s*/, "");
      } else if (monthData.notes.startsWith("Espèces")) {
        existingMethod = "Espèces";
        extraNotes = monthData.notes.replace(/^Espèces\s*[-:]?\s*/, "");
      } else {
        extraNotes = monthData.notes;
      }
    }
    setPaymentMethod(existingMethod);
    setInputNotes(extraNotes);
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedMonth) return;

    setSavingPayment(true);
    try {
      const finalNotes = inputNotes.trim()
        ? `${paymentMethod} - ${inputNotes.trim()}`
        : paymentMethod;

      const res = await fetch("/api/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          month: selectedMonth,
          amount: Number(inputAmount),
          notes: finalNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Célébration discrète avec confettis si paiement complet !
        if (data.isFullyPaid) {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: ["#10B981", "#6366F1", "#06B6D4"],
          });
        }

        const newAmount = Number(inputAmount);

        // Formatage Niveau et Classe SANS AUCUNE PARENTHÈSE
        const levelFormatted = selectedStudent.section
          ? `${selectedStudent.level} ${selectedStudent.section}`
          : selectedStudent.level;
        const classFormatted = selectedStudent.className || "Non affecté";

        const academicYear = schoolSettings?.academic_year || "2026-2027";
        const yearPrefix = academicYear.split("-")[0] || new Date().getFullYear();
        // Numéro de reçu séquentiel unique retourné par la base de données
        const receiptNo = data.payment?.receiptNo || `REC-${yearPrefix}-1001`;

        const savedReceipt: ReceiptData = {
          receiptNo,
          academicYear,
          studentName: `${selectedStudent.lastName} ${selectedStudent.firstName}`,
          level: levelFormatted,
          className: classFormatted,
          month: selectedMonth,
          amountPaid: newAmount,
          paymentMethod,
          date: data.payment?.paidAt ? new Date(data.payment.paidAt) : new Date(),
          schoolName: schoolSettings?.school_name || "معهد الامتياز الخاص",
          schoolNameFr: schoolSettings?.school_name_fr || "Institut Privé d'Excellence",
          schoolPhone: schoolSettings?.school_phone || "+216 71 888 999",
          schoolAddress: schoolSettings?.school_address || "Avenue Habib Bourguiba, Tunis",
          schoolLogo: schoolSettings?.school_logo || "/logo-transparent.png",
        };

        setPaymentJustSaved(savedReceipt);
        fetchPayments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleViewExistingReceipt = (student: any, month: string) => {
    const monthInfo = student.months[month];
    if (!monthInfo || monthInfo.status === "unpaid") return;

    const levelFormatted = student.section
      ? `${student.level} ${student.section}`
      : student.level;
    const classFormatted = student.className || "Non affecté";
    const amountPaid = monthInfo.paidAmount || student.monthlyTarif || 100;

    let extractedMethod: "Espèces" | "Chèque" | "Virement" = "Espèces";
    if (monthInfo.notes) {
      if (monthInfo.notes.startsWith("Chèque")) extractedMethod = "Chèque";
      else if (monthInfo.notes.startsWith("Virement")) extractedMethod = "Virement";
    }

    const academicYear = schoolSettings?.academic_year || "2026-2027";
    const yearPrefix = academicYear.split("-")[0] || new Date().getFullYear();
    // Le numéro de reçu existant est récupéré de la base et NE CHANGE JAMAIS
    const receiptNo =
      monthInfo.receiptNo ||
      (monthInfo.paymentId
        ? `REC-${yearPrefix}-${monthInfo.paymentId.substring(0, 4).toUpperCase()}`
        : `REC-${yearPrefix}-1001`);

    setReceiptData({
      receiptNo,
      academicYear,
      studentName: `${student.lastName} ${student.firstName}`,
      level: levelFormatted,
      className: classFormatted,
      month,
      amountPaid,
      paymentMethod: extractedMethod,
      date: monthInfo.date ? new Date(monthInfo.date) : new Date(),
      schoolName: schoolSettings?.school_name || "معهد الامتياز الخاص",
      schoolNameFr: schoolSettings?.school_name_fr || "Institut Privé d'Excellence",
      schoolPhone: schoolSettings?.school_phone || "+216 71 888 999",
      schoolAddress: schoolSettings?.school_address || "Avenue Habib Bourguiba, Tunis",
      schoolLogo: schoolSettings?.school_logo || "/logo-transparent.png",
    });
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Frais de Scolarité & Paiements
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suivi des 9 mois (Octobre &rarr; Juin) &bull; Reçus conformes A4
          </p>
        </div>

        {/* Légende rapide des couleurs */}
        <div className="flex items-center gap-3 text-xs font-semibold p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Payé</span>
          </div>
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Partiel</span>
          </div>
          <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Non payé</span>
          </div>
        </div>
      </div>

      {/* Alerte toast de rappel SMS */}
      <AnimatePresence>
        {smsSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs sm:text-sm font-semibold flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{smsSuccessToast}</span>
            </div>
            <button
              onClick={() => setSmsSuccessToast(null)}
              className="p-1 hover:bg-emerald-500/20 rounded-lg text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtres de recherche */}
      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par élève ou téléphone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
          />
        </div>

        <div className="w-full md:w-56">
          <TouchSelect
            title="Filtrer par classe"
            value={selectedClassId}
            onChange={setSelectedClassId}
            placeholder="Toutes les classes"
            options={[
              { value: "", label: "Toutes les classes" },
              ...classes.map((cls) => ({
                value: cls.id,
                label: cls.name,
                badge: `${cls.enrollments?.length || 0} élève${(cls.enrollments?.length || 0) > 1 ? "s" : ""}`,
              })),
            ]}
          />
        </div>

        <div className="w-full md:w-48">
          <TouchSelect
            title="Filtrer par section"
            value={selectedSection}
            onChange={setSelectedSection}
            placeholder="Toutes sections"
            options={[
              { value: "", label: "Toutes sections" },
              ...SECTIONS.map((sec) => ({ value: sec, label: sec })),
              ...(hasLegacyStudents ? [{ value: "needs_update", label: "À mettre à jour" }] : []),
            ]}
          />
        </div>
      </div>

      {/* Table / Grille des Paiements */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card">
          <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {selectedClassId && !search
              ? "Cette classe n'a pas d'élève"
              : search
              ? "Aucun élève trouvé pour cette recherche"
              : "Aucun élève trouvé"}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {selectedClassId && !search
              ? "Affectez d'abord des élèves à cette classe dans le menu Classes pour gérer leurs paiements."
              : search
              ? "Vérifiez l'orthographe du nom ou du numéro de téléphone."
              : "Inscrivez des élèves dans le menu Élèves."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((st) => {
            const hasLegacy = isLegacySection(st.section);

            return (
              <div
                key={st.id}
                className={`p-5 rounded-3xl glass-card hover:shadow-subtle transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  hasLegacy ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10" : ""
                }`}
              >
                {/* Infos Élève */}
                <div className="min-w-[200px]">
                  <div className="font-bold text-base text-slate-900 dark:text-white">
                    {st.lastName} {st.firstName}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <span>
                      {st.className} &bull; {st.level} {st.section ? `• ${st.section}` : ""}
                    </span>
                    {hasLegacy && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>Section à mettre à jour</span>
                      </span>
                    )}
                  </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                  Total : <span className="text-emerald-600 font-bold">{formatCurrency(st.totalPaid)}</span> / {formatCurrency(st.annualTotal)}
                  {st.remaining > 0 && (
                    <span className="text-rose-500 font-bold ml-1">
                      (Reste : {formatCurrency(st.remaining)})
                    </span>
                  )}
                </div>

                {/* Bouton Envoyer SMS avec modale 2 options */}
                <div className="pt-2">
                  <button
                    onClick={() => openSmsModal(st)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-bold border border-indigo-200/80 dark:border-indigo-800/50 transition cursor-pointer"
                    title="Envoyer un rappel ou avertissement SMS au parent"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Envoyer SMS</span>
                  </button>
                </div>
              </div>

              {/* Les 9 Boutons de Mois */}
              <div className="flex-1 grid grid-cols-3 sm:grid-cols-9 gap-1.5 sm:gap-2">
                {schoolMonths.map((m) => {
                  const monthInfo = st.months[m];
                  const isPaid = monthInfo.status === "paid";
                  const isPartial = monthInfo.status === "partial";
                  const isUnpaid = monthInfo.status === "unpaid";

                  return (
                    <div key={m} className="relative group">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openPaymentModal(st, m)}
                        className={`w-full py-2.5 px-1.5 rounded-2xl flex flex-col items-center justify-center font-bold text-xs transition-all border ${
                          isPaid
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                            : isPartial
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
                        }`}
                      >
                        <span>{monthLabelsShort[m]}</span>
                        <span className="text-[10px] font-mono mt-0.5 opacity-80">
                          {isPaid ? "Payé" : isPartial ? `${monthInfo.paidAmount} DT` : "0 DT"}
                        </span>
                      </motion.button>

                      {/* Bouton rapide d'envoi de SMS de rappel si impayé ou partiel */}
                      {!isPaid && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSmsModal(st, m);
                          }}
                          title={`Envoyer un SMS de paiement pour ${m}`}
                          className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md transition-opacity cursor-pointer hover:bg-indigo-500"
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* MODAL ENREGISTREMENT PAIEMENT */}
      <AnimatePresence>
        {paymentModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 sm:p-8 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Paiement du mois de {selectedMonth}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedStudent.lastName} {selectedStudent.firstName} &bull; {selectedStudent.className}
                  </p>
                </div>
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {paymentJustSaved ? (
                <div className="py-4 space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Paiement enregistré avec succès !
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedStudent.lastName} {selectedStudent.firstName} &bull; Mois : {selectedMonth}
                    </p>
                    <div className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {paymentJustSaved.amountPaid} DT
                    </div>
                    <div className="mt-2 inline-block px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-[#7A2E3A]">
                      N° de reçu : {paymentJustSaved.receiptNo}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptData(paymentJustSaved);
                        setPaymentModalOpen(false);
                        setPaymentJustSaved(null);
                      }}
                      className="flex-1 py-3 px-4 rounded-2xl bg-[#2B3F66] hover:bg-[#1E2D4A] text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimer le reçu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentModalOpen(false);
                        setPaymentJustSaved(null);
                      }}
                      className="py-3 px-5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSavePayment} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400 block">Tarif officiel pour ce niveau :</span>
                      <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
                        {formatCurrency(selectedStudent.monthlyTarif)} / mois
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInputAmount(selectedStudent.monthlyTarif)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold text-[11px]"
                    >
                      Montant total
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Montant versé (DT) :
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      required
                      value={inputAmount}
                      onChange={(e) => setInputAmount(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    {inputAmount < selectedStudent.monthlyTarif && (
                      <p className="text-xs text-amber-600 mt-1">
                        Paiement partiel : Reste à payer pour ce mois ={" "}
                        <strong>{selectedStudent.monthlyTarif - inputAmount} DT</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Mode de règlement :
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {(["Espèces", "Chèque", "Virement"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMethod(mode)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                            paymentMethod === mode
                              ? "bg-[#2B3F66] text-white border-[#2B3F66] shadow-sm"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span>{mode}</span>
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={inputNotes}
                      onChange={(e) => setInputNotes(e.target.value)}
                      placeholder={
                        paymentMethod === "Chèque"
                          ? "N° de chèque, Banque émettrice..."
                          : paymentMethod === "Virement"
                          ? "Référence bancaire de virement..."
                          : "Observations éventuelles..."
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      {selectedStudent.months[selectedMonth]?.status !== "unpaid" && (
                        <button
                          type="button"
                          onClick={() => {
                            handleViewExistingReceipt(selectedStudent, selectedMonth);
                            setPaymentModalOpen(false);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#2B3F66]/10 hover:bg-[#2B3F66]/20 text-[#2B3F66] dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Voir / Imprimer le reçu</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={savingPayment}
                        className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-colored-success flex items-center gap-1.5 cursor-pointer"
                      >
                        {savingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Valider & Enregistrer</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALE REÇU IMPRIMABLE CONFORME (Double exemplaire A4 détachable par pointillés) */}
      <PaymentReceiptModal
        receiptData={receiptData}
        onClose={() => setReceiptData(null)}
      />

      {/* MODALE ENVOI SMS PAIEMENT (2 OPTIONS AU CHOIX DU DIRECTEUR) */}
      <PaymentSmsModal
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        student={smsModalStudent}
        defaultMonth={smsModalMonth}
        dueAmount={smsModalDue}
        schoolSettings={schoolSettings}
        onSuccess={(msg) => {
          setSmsSuccessToast(msg);
          setTimeout(() => setSmsSuccessToast(null), 6000);
        }}
      />
    </div>
  );
}
