"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  UserCheck,
  UserX,
  School,
  CheckCircle2,
  XCircle,
  Save,
  Clock,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentTimeHHMM } from "@/lib/utils";
import { TouchSelect } from "@/components/TouchSelect";

export default function PresencePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // absentStudentIds : Set d'IDs marqués absents
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  // Clé d'idempotence unique pour ce contrôle
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // État d'enregistrement
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger les classes
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/classes");
        const data = await res.json();
        const clsList = data.classes || [];
        setClasses(clsList);
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingClasses(false);
      }
    }
    load();
  }, []);

  // Quand une classe est sélectionnée, charger ses élèves et générer une nouvelle clé d'idempotence
  useEffect(() => {
    if (!selectedClassId) return;

    async function loadStudents() {
      setLoadingStudents(true);
      setSuccessResult(null);
      setErrorMessage(null);
      setAbsentIds(new Set()); // Par défaut : TOUS PRÉSENTS !
      // Générer une clé d'idempotence : classId + timestamp + random
      setIdempotencyKey(`session_${selectedClassId}_${Date.now()}_${Math.random().toString(36).substring(7)}`);

      try {
        const res = await fetch(`/api/classes/${selectedClassId}`);
        const data = await res.json();
        const enrolled = data.class?.enrollments?.map((e: any) => e.student) || [];
        setStudents(enrolled);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStudents(false);
      }
    }

    loadStudents();
  }, [selectedClassId]);

  // Bascule Présent / Absent au clic avec micro-interaction
  const toggleAttendance = (studentId: string) => {
    if (submitting || successResult) return;

    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId); // Redevient Présent
      } else {
        next.add(studentId); // Passe en Absent
      }
      return next;
    });
  };

  // Enregistrement avec protection double-clic
  const handleSubmitAttendance = async () => {
    if (submitting || !selectedClassId || students.length === 0) return;

    setSubmitting(true);
    setErrorMessage(null);

    const currentTime = getCurrentTimeHHMM();

    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          idempotencyKey,
          recordedAtTime: currentTime,
          absentStudentIds: Array.from(absentIds),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Une erreur est survenue lors de l'enregistrement");
        setSubmitting(false);
        return;
      }

      setSuccessResult({
        time: currentTime,
        absentCount: absentIds.size,
        presentCount: students.length - absentIds.size,
        smsQueued: data.smsQueued || 0,
      });
    } catch {
      setErrorMessage("Erreur de connexion au serveur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForNewControl = () => {
    setSuccessResult(null);
    setAbsentIds(new Set());
    setIdempotencyKey(`session_${selectedClassId}_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  };

  const presentCount = students.length - absentIds.size;
  const absentCount = absentIds.size;
  const currentSelectedClass = classes.find((c) => c.id === selectedClassId);

  const validateButtonRef = useRef<HTMLButtonElement>(null);

  const handleFloatingPillClick = () => {
    validateButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const confirmed = window.confirm(
        `Valider le contrôle : ${absentCount} absent(s), ${absentCount} SMS seront envoyés ?`
      );
      if (confirmed) {
        handleSubmitAttendance();
      }
    }, 400);
  };

  const classOptions = classes.map((cls) => ({
    value: cls.id,
    label: cls.name,
    badge: `${cls.enrollments?.length || 0} élève${(cls.enrollments?.length || 0) > 1 ? "s" : ""}`,
  }));

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Contrôle d'absence</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
              En direct
            </span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cochez les absents en un clic &bull; Les SMS partent automatiquement aux parents
          </p>
        </div>

        {/* Heure actuelle en temps réel */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-200 self-start sm:self-auto">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Heure d'appel : {getCurrentTimeHHMM()}</span>
        </div>
      </div>

      {loadingClasses ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : classes.length === 0 ? (
        <div className="p-10 sm:p-14 text-center rounded-3xl glass-card space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
            <School className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Aucune classe configurée
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Pour effectuer l'appel d'absence, vous devez d'abord créer au moins une classe.
            </p>
          </div>
          <div>
            <Link
              href="/classes"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-colored-primary transition"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une classe</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Sélection de la classe via TouchSelect personnalisé */}
          <div className="p-4 rounded-3xl glass-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Choisir la classe :
              </label>
              <TouchSelect
                title="Choisir la classe"
                value={selectedClassId}
                onChange={setSelectedClassId}
                disabled={submitting}
                options={classOptions}
                placeholder="Sélectionner une classe..."
                icon={<School className="w-5 h-5 text-indigo-500" />}
                buttonClassName="font-bold border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Compteur interactif en direct */}
            <div className="flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 sm:px-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shrink-0 self-stretch sm:self-auto">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{presentCount} Présent(s)</span>
              </div>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span>{absentCount} Absent(s)</span>
              </div>
            </div>
          </div>

      {/* Message de confirmation de succès après enregistrement */}
      <AnimatePresence>
        {successResult && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-colored-success"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-extrabold text-base sm:text-lg">
                  Contrôle enregistré à {successResult.time} !
                </h4>
                <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {successResult.smsQueued > 0
                    ? `✓ ${successResult.smsQueued} SMS envoyé(s) aux parents des absents.`
                    : "Tous les élèves étaient présents. Aucun SMS envoyé."}
                </p>
              </div>
            </div>

            <button
              onClick={handleResetForNewControl}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Nouveau contrôle</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message d'erreur */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Roster tactile d'élèves */}
      {loadingStudents ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card">
          <UserX className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Aucun élève dans cette classe
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Affectez d'abord des élèves à cette classe dans le menu "Classes".
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Appuyez sur un élève pour le marquer Absent / Présent :
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.map((student) => {
              const isAbsent = absentIds.has(student.id);

              return (
                <motion.div
                  key={student.id}
                  whileTap={{ scale: 0.96 }}
                  animate={
                    isAbsent
                      ? { x: [0, -3, 3, -3, 0] } // Léger shake animé au passage en absent
                      : {}
                  }
                  transition={{ duration: 0.2 }}
                  onClick={() => toggleAttendance(student.id)}
                  className={`min-h-[72px] p-4 rounded-3xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3 ${
                    isAbsent
                      ? "bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/40 text-rose-900 dark:text-rose-100 shadow-colored-danger"
                      : "bg-white/80 dark:bg-slate-900/60 border-emerald-500/20 hover:border-emerald-500/40 text-slate-900 dark:text-white hover:bg-emerald-50/20"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <motion.div
                      layout
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        isAbsent
                          ? "bg-rose-500 text-white shadow-sm"
                          : "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isAbsent ? <XCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                    </motion.div>

                    <div className="truncate">
                      <div className="font-bold text-sm sm:text-base leading-tight truncate">
                        {student.lastName} {student.firstName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Tél : {student.parentPhone}
                      </div>
                    </div>
                  </div>

                  {/* Badge d'état visuel */}
                  <div
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs shrink-0 transition-colors ${
                      isAbsent
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {isAbsent ? "ABSENT" : "PRÉSENT"}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bouton Valider le contrôle en fin de liste (flux normal, ne masque aucun élève) */}
          <div className="pt-6 pb-28 md:pb-12">
            <motion.button
              ref={validateButtonRef}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSubmitAttendance}
              disabled={submitting || students.length === 0 || !!successResult}
              className={`w-full py-4 px-6 rounded-3xl font-bold text-base shadow-xl flex items-center justify-center gap-3 transition-all cursor-pointer ${
                successResult
                  ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                  : absentCount > 0
                  ? "bg-gradient-to-r from-rose-600 via-rose-600 to-pink-600 text-white shadow-colored-danger hover:from-rose-500 hover:to-pink-500"
                  : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-colored-success hover:from-emerald-500 hover:to-teal-500"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Enregistrement et expédition des SMS en cours...</span>
                </>
              ) : successResult ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Contrôle validé pour {currentSelectedClass?.name}</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>
                    Valider le contrôle ({absentCount} absent(s) &bull; {absentCount} SMS à envoyer)
                  </span>
                </>
              )}
            </motion.button>
          </div>

          {/* Pastille flottante compacte en bas à droite sur mobile (ne masque aucun élève grâce au padding en fin de liste) */}
          {!successResult && students.length > 0 && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleFloatingPillClick}
              disabled={submitting}
              className={`fixed bottom-24 right-4 z-40 md:hidden flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl font-extrabold text-xs text-white border border-white/25 transition-all cursor-pointer ${
                absentCount > 0
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/40 ring-4 ring-rose-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/40 ring-4 ring-emerald-500/20"
              }`}
              title="Valider le contrôle"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {absentCount === 0 ? "0 absent" : `${absentCount} absent${absentCount > 1 ? "s" : ""}`}
              </span>
            </motion.button>
          )}
        </div>
      )}
    </>
  )}
</div>
  );
}
