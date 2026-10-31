"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Filter,
  Archive,
  RotateCcw,
  Trash2,
  Edit2,
  Phone,
  GraduationCap,
  School,
  X,
  Check,
  Calendar,
  CreditCard,
  AlertTriangle,
  Loader2,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TouchSelect } from "@/components/TouchSelect";
import LegacySectionBanner from "@/components/LegacySectionBanner";
import {
  LEVELS,
  SECTIONS,
  levelHasSection,
  isLegacySection,
} from "@/lib/sections";

export default function ElevesPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [legacyInfo, setLegacyInfo] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Modale Ajout / Modification
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLevel, setFormLevel] = useState("1ère");
  const [formSection, setFormSection] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fiche Élève (Détails avec onglets)
  const [detailStudent, setDetailStudent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"infos" | "absences" | "paiements">("infos");
  const [detailLoading, setDetailLoading] = useState(false);

  // Boîte de dialogue de confirmation de suppression
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedLevel) params.set("level", selectedLevel);
      if (selectedSection) params.set("section", selectedSection);
      if (showArchived) params.set("archived", "true");

      const res = await fetch(`/api/eleves?${params.toString()}`);
      const data = await res.json();
      setStudents(data.students || []);
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
        setLegacyInfo(data);
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

  const fetchAll = () => {
    fetchStudents();
    fetchClasses();
    fetchLegacyInfo();
  };

  useEffect(() => {
    fetchStudents();
  }, [search, selectedLevel, selectedSection, showArchived]);

  useEffect(() => {
    fetchClasses();
    fetchLegacyInfo();
  }, []);

  const openAddModal = () => {
    setEditingStudent(null);
    setFormFirstName("");
    setFormLastName("");
    setFormPhone("");
    setFormLevel("1ère");
    setFormSection("");
    setFormClassId("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (st: any) => {
    setEditingStudent(st);
    setFormFirstName(st.firstName);
    setFormLastName(st.lastName);
    setFormPhone(st.parentPhone);
    setFormLevel(st.level);
    setFormSection(isLegacySection(st.section) ? "" : (st.section || ""));
    setFormClassId(st.enrollments[0]?.classId || "");
    setFormError(null);
    setModalOpen(true);
  };

  const openDetailDrawer = async (id: string) => {
    setDetailLoading(true);
    setActiveTab("infos");
    try {
      const res = await fetch(`/api/eleves/${id}`);
      const data = await res.json();
      if (data.success) {
        setDetailStudent(data.student);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const payload: any = {
        firstName: formFirstName,
        lastName: formLastName,
        parentPhone: formPhone,
        level: formLevel,
        section: levelHasSection(formLevel) ? formSection : null,
        classId: formClassId || undefined,
      };

      const url = editingStudent ? `/api/eleves/${editingStudent.id}` : "/api/eleves";
      const method = editingStudent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Une erreur est survenue");
        setSaving(false);
        return;
      }

      setModalOpen(false);
      fetchAll();
    } catch {
      setFormError("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (id: string) => {
    try {
      await fetch(`/api/eleves/${id}/archive`, { method: "POST" });
      fetchAll();
      if (detailStudent?.id === id) {
        setDetailStudent(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      await fetch(`/api/eleves/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      fetchAll();
      if (detailStudent?.id === id) {
        setDetailStudent(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Section visible seulement pour 2ème, 3ème, Bac
  const isSectionAllowed = levelHasSection(formLevel);

  // Filtrer les classes compatibles avec le niveau sélectionné dans le formulaire
  const filteredFormClasses = classes.filter(
    (c) => c.level === formLevel && (!isSectionAllowed || c.section === formSection)
  );

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      {/* BANDEAU SI SCIENCES DÉTECTÉ */}
      <LegacySectionBanner legacyInfo={legacyInfo} onSuccess={fetchAll} />
      {/* En-tête et bouton Ajouter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Gestion des Élèves
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {students.length} élève(s) répertorié(s) &bull; Année 2026-2027
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-colored-primary transition cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un élève</span>
        </motion.button>
      </div>

      {/* Raccourci vers la page Classes si aucune classe n'existe */}
      {classes.length === 0 && !loading && (
        <div className="p-4 sm:p-5 rounded-3xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                Aucune classe configurée
              </h4>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-400">
                Créez d'abord vos classes pour pouvoir y affecter vos élèves.
              </p>
            </div>
          </div>
          <Link
            href="/classes"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une classe</span>
          </Link>
        </div>
      )}

      {/* Barre de filtres et recherche */}
      <div className="p-4 rounded-3xl glass-card space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Recherche */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, prénom, téléphone, classe..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {/* Filtre Niveau */}
          <div className="w-full md:w-44">
            <TouchSelect
              title="Filtrer par niveau"
              value={selectedLevel}
              onChange={setSelectedLevel}
              placeholder="Tous les niveaux"
              options={[
                { value: "", label: "Tous les niveaux" },
                ...LEVELS.map((lvl) => ({ value: lvl, label: lvl })),
              ]}
            />
          </div>

          {/* Filtre Section */}
          <div className="w-full md:w-44">
            <TouchSelect
              title="Filtrer par section"
              value={selectedSection}
              onChange={setSelectedSection}
              placeholder="Toutes sections"
              options={[
                { value: "", label: "Toutes sections" },
                ...SECTIONS.map((sec) => ({ value: sec, label: sec })),
                ...(legacyInfo?.studentsCount ? [{ value: "needs_update", label: "À mettre à jour" }] : []),
              ]}
            />
          </div>

          {/* Filtre Archivés */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
              showArchived
                ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300"
                : "bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{showArchived ? "Archivés (Actif)" : "Voir Archivés"}</span>
          </button>
        </div>
      </div>

      {/* Liste des élèves (Cartes tactiles / Tableau réactif) */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Aucun élève trouvé
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Modifiez vos critères de recherche ou ajoutez un nouvel élève.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((st, idx) => {
            const currentClass = st.enrollments[0]?.class?.name || "Non affecté";
            const hasLegacy = isLegacySection(st.section);

            return (
              <motion.div
                key={st.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                className={`p-5 rounded-3xl glass-card hover:shadow-colored-primary hover:-translate-y-0.5 transition-all relative group flex flex-col justify-between ${
                  hasLegacy ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10" : ""
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4
                        onClick={() => openDetailDrawer(st.id)}
                        className="font-bold text-base text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                      >
                        {st.lastName} {st.firstName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                        <span>
                          {st.level} {st.section ? `• ${st.section}` : ""}
                        </span>
                        {hasLegacy && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Section à mettre à jour</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl shrink-0 ${
                        st.isArchived
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900"
                      }`}
                    >
                      {currentClass}
                    </span>
                  </div>

                  {/* Numéro parent */}
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-mono font-medium">{st.parentPhone}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => openDetailDrawer(st.id)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Voir fiche
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(st)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleArchive(st.id)}
                      className={`p-1.5 rounded-lg transition ${
                        st.isArchived
                          ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800"
                      }`}
                      title={st.isArchived ? "Restaurer" : "Archiver"}
                    >
                      {st.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(st.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL AJOUT / MODIFICATION D'ÉLÈVE */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg p-6 sm:p-8 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingStudent ? "Modifier l'élève" : "Ajouter un élève"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs sm:text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveStudent} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nom
                    </label>
                    <input
                      type="text"
                      required
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      placeholder="Trabelsi"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Prénom
                    </label>
                    <input
                      type="text"
                      required
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      placeholder="Youssef"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro du Parent (Tunisie)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                      +216
                    </span>
                    <input
                      type="text"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="98123456"
                      className="w-full pl-14 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Format 8 chiffres. Les SMS d'absence et de rappel seront expédiés à ce numéro.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Niveau
                    </label>
                    <TouchSelect
                      title="Choisir le niveau"
                      value={formLevel}
                      onChange={(val) => {
                        setFormLevel(val);
                        if (!levelHasSection(val)) {
                          setFormSection("");
                        }
                      }}
                      options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
                    />
                  </div>

                  {/* Section avec animation conditionnelle (uniquement 2ème, 3ème, Bac) */}
                  <AnimatePresence>
                    {isSectionAllowed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Section
                        </label>
                        <TouchSelect
                          title="Choisir la section"
                          value={formSection}
                          onChange={(val) => setFormSection(val)}
                          placeholder="Choisir section..."
                          options={[
                            { value: "", label: "Choisir section..." },
                            ...SECTIONS.map((sec) => ({ value: sec, label: sec })),
                          ]}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Affecter à une classe (optionnel)
                  </label>
                  <TouchSelect
                    title="Choisir la classe"
                    value={formClassId}
                    onChange={(val) => setFormClassId(val)}
                    placeholder="Aucune affectation"
                    options={[
                      { value: "", label: "Aucune affectation" },
                      ...filteredFormClasses.map((cls) => ({ value: cls.id, label: cls.name })),
                    ]}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-colored-primary transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingStudent ? "Enregistrer" : "Créer l'élève"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TIROIR FICHE ÉLÈVE (Onglets Infos, Absences, Paiements) */}
      <AnimatePresence>
        {detailStudent && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-lg flex items-center justify-center">
                      {detailStudent.lastName[0]}
                      {detailStudent.firstName[0]}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {detailStudent.lastName} {detailStudent.firstName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400">
                          {detailStudent.level} {detailStudent.section ? `• ${detailStudent.section}` : ""}
                        </p>
                        {isLegacySection(detailStudent.section) && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Section à mettre à jour</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailStudent(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sélecteur d'onglets */}
                <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 my-4 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("infos")}
                    className={`flex-1 py-2 rounded-xl transition ${
                      activeTab === "infos"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Informations
                  </button>
                  <button
                    onClick={() => setActiveTab("absences")}
                    className={`flex-1 py-2 rounded-xl transition ${
                      activeTab === "absences"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Absences ({detailStudent.absences?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("paiements")}
                    className={`flex-1 py-2 rounded-xl transition ${
                      activeTab === "paiements"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Paiements ({detailStudent.payments?.length || 0})
                  </button>
                </div>

                {/* Contenu Onglet Infos */}
                {activeTab === "infos" && (
                  <div className="space-y-4 text-sm">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Numéro Parent :</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {detailStudent.parentPhone}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Classe Actuelle :</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {detailStudent.enrollments[0]?.class?.name || "Non affecté"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Statut :</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            detailStudent.isArchived
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                        >
                          {detailStudent.isArchived ? "Archivé" : "Actif"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                      <button
                        onClick={() => toggleArchive(detailStudent.id)}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        {detailStudent.isArchived ? "Restaurer l'élève" : "Archiver l'élève"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contenu Onglet Absences */}
                {activeTab === "absences" && (
                  <div className="space-y-2">
                    {(!detailStudent.absences || detailStudent.absences.length === 0) ? (
                      <p className="text-xs text-slate-400 text-center py-8">
                        Aucune absence enregistrée pour cet élève.
                      </p>
                    ) : (
                      detailStudent.absences.map((ab: any) => (
                        <div
                          key={ab.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {formatDate(ab.session?.date)} à {ab.session?.recordedAtTime}
                            </div>
                            <div className="text-slate-400 mt-0.5">
                              Classe : {ab.session?.class?.name || "Classe"}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                            SMS envoyé ✓
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Contenu Onglet Paiements */}
                {activeTab === "paiements" && (
                  <div className="space-y-2">
                    {(!detailStudent.payments || detailStudent.payments.length === 0) ? (
                      <p className="text-xs text-slate-400 text-center py-8">
                        Aucun paiement enregistré pour l'instant.
                      </p>
                    ) : (
                      detailStudent.payments.map((p: any) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white capitalize">
                              Mois de {p.month}
                            </div>
                            <div className="text-slate-400 mt-0.5">
                              Encaissé le {formatDate(p.paidAt)} {p.notes ? `(${p.notes})` : ""}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DE SUPPRESSION */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Supprimer cet élève ?
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cette action supprimera également son historique d'absences et de paiements. Si l'élève a simplement quitté l'établissement, préférez l'archivage.
              </p>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={() => deleteStudent(deleteConfirmId)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
