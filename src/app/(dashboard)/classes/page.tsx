"use client";

import { useState, useEffect } from "react";
import {
  School,
  Plus,
  Users,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  X,
  Loader2,
  AlertTriangle,
  GraduationCap,
  Search,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TouchSelect from "@/components/TouchSelect";
import LegacySectionBanner from "@/components/LegacySectionBanner";
import {
  LEVELS,
  SECTIONS,
  levelHasSection,
  isLegacySection,
} from "@/lib/sections";

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [legacyInfo, setLegacyInfo] = useState<any | null>(null);

  // Filtres
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterSection, setFilterSection] = useState("");

  // Modale Ajout de classe
  const [modalOpen, setModalOpen] = useState(false);
  const [formLevel, setFormLevel] = useState("1ère");
  const [formSection, setFormSection] = useState("");
  const [formCustomName, setFormCustomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Vue détaillée / Gestion des élèves d'une classe
  const [activeClass, setActiveClass] = useState<any | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");
  const [classDetailLoading, setClassDetailLoading] = useState(false);

  // Modifier / Renommer une classe
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("1ère");
  const [editSection, setEditSection] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      setClasses(data.classes || []);
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

  const fetchAll = () => {
    fetchClasses();
    fetchLegacyInfo();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openClassDetails = async (cls: any) => {
    setActiveClass(cls);
    setClassDetailLoading(true);
    try {
      // Recharger la classe avec ses élèves
      const res = await fetch(`/api/classes/${cls.id}`);
      const data = await res.json();
      if (data.success) {
        setActiveClass(data.class);
      }

      // Charger les élèves éligibles (même niveau et section, non encore affectés)
      const eligRes = await fetch(`/api/classes/${cls.id}/students`);
      const eligData = await eligRes.json();
      setEligibleStudents(eligData.students || []);
      setSelectedStudentToAdd("");
    } catch (err) {
      console.error(err);
    } finally {
      setClassDetailLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    try {
      const isSectionNeeded = levelHasSection(formLevel);
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: formLevel,
          section: isSectionNeeded ? formSection : null,
          name: formCustomName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Erreur de création");
        setCreating(false);
        return;
      }

      setModalOpen(false);
      setFormCustomName("");
      fetchAll();
    } catch {
      setFormError("Erreur serveur");
    } finally {
      setCreating(false);
    }
  };

  const handleAddStudentToClass = async () => {
    if (!selectedStudentToAdd || !activeClass) return;
    try {
      const res = await fetch(`/api/classes/${activeClass.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentToAdd }),
      });
      if (res.ok) {
        openClassDetails(activeClass);
        fetchAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!activeClass) return;
    try {
      const res = await fetch(`/api/classes/${activeClass.id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) {
        openClassDetails(activeClass);
        fetchAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditClassModal = (cls: any) => {
    setEditingClass(cls);
    setEditName(cls.name);
    setEditLevel(cls.level);
    setEditSection(isLegacySection(cls.section) ? "" : (cls.section || ""));
    setEditError(null);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setUpdating(true);
    setEditError(null);

    try {
      const isSectionNeeded = levelHasSection(editLevel);
      const res = await fetch(`/api/classes/${editingClass.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          level: editLevel,
          section: isSectionNeeded ? editSection : null,
          updateStudents: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Erreur lors de la mise à jour");
        setUpdating(false);
        return;
      }

      setEditingClass(null);
      fetchAll();
      if (activeClass?.id === editingClass.id) {
        setActiveClass((prev: any) => ({
          ...prev,
          name: data.class?.name || editName.trim(),
          level: editLevel,
          section: isSectionNeeded ? editSection : null,
        }));
      }
    } catch {
      setEditError("Erreur serveur lors de la mise à jour");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Voulez-vous supprimer cette classe ? Les élèves ne seront pas supprimés mais perdront leur affectation.")) return;
    try {
      await fetch(`/api/classes/${id}`, { method: "DELETE" });
      if (activeClass?.id === id) setActiveClass(null);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const isFormSectionAllowed = levelHasSection(formLevel);
  const isEditSectionAllowed = levelHasSection(editLevel);

  // Filtrer les classes affichées
  const filteredClasses = classes.filter((cls) => {
    if (filterLevel && cls.level !== filterLevel) return false;
    if (filterSection) {
      if (filterSection === "needs_update") {
        if (!isLegacySection(cls.section)) return false;
      } else if (cls.section !== filterSection) {
        return false;
      }
    }
    if (search) {
      const q = search.toLowerCase();
      const matchName = cls.name?.toLowerCase().includes(q);
      const matchLevel = cls.level?.toLowerCase().includes(q);
      const matchSection = cls.section?.toLowerCase().includes(q);
      if (!matchName && !matchLevel && !matchSection) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      {/* BANDEAU SI SCIENCES DÉTECTÉ */}
      <LegacySectionBanner legacyInfo={legacyInfo} onSuccess={fetchAll} />

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Gestion des Classes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {classes.length} classe(s) configurée(s) &bull; Année 2026-2027
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setFormLevel("1ère");
            setFormSection("");
            setFormCustomName("");
            setFormError(null);
            setModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-colored-primary transition cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter une classe</span>
        </motion.button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="p-4 rounded-3xl glass-card space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une classe..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
            />
          </div>

          <div className="w-full md:w-44">
            <TouchSelect
              title="Filtrer par niveau"
              value={filterLevel}
              onChange={setFilterLevel}
              placeholder="Tous les niveaux"
              options={[
                { value: "", label: "Tous les niveaux" },
                ...LEVELS.map((lvl) => ({ value: lvl, label: lvl })),
              ]}
            />
          </div>

          <div className="w-full md:w-48">
            <TouchSelect
              title="Filtrer par section"
              value={filterSection}
              onChange={setFilterSection}
              placeholder="Toutes sections"
              options={[
                { value: "", label: "Toutes sections" },
                ...SECTIONS.map((sec) => ({ value: sec, label: sec })),
                ...(legacyInfo?.classesCount ? [{ value: "needs_update", label: "À mettre à jour" }] : []),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Grille des classes */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card">
          <School className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {classes.length === 0 ? "Aucune classe créée" : "Aucune classe trouvée pour ces critères"}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {classes.length === 0
              ? "Cliquez sur 'Ajouter une classe' pour commencer."
              : "Modifiez vos filtres ou réinitialisez la recherche."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls, idx) => {
            const hasLegacy = isLegacySection(cls.section);

            return (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`p-5 rounded-3xl glass-card hover:shadow-colored-primary hover:-translate-y-0.5 transition-all flex flex-col justify-between ${
                  hasLegacy ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10" : ""
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                        <School className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="font-bold text-base text-slate-900 dark:text-white truncate">
                            {cls.name}
                          </h4>
                          {hasLegacy && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span>Section à mettre à jour</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {cls.level} {cls.section ? `• ${cls.section}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditClassModal(cls)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Modifier / Renommer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>{cls.enrollments?.length || 0} élève(s) inscrit(s)</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  <button
                    onClick={() => openClassDetails(cls)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-bold text-xs transition text-center"
                  >
                    Gérer les élèves de la classe
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL AJOUT CLASSE (avec nom séquentiel automatique) */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Ajouter une classe
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateClass} className="space-y-4">
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

                <AnimatePresence>
                  {isFormSectionAllowed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Section
                      </label>
                      <TouchSelect
                        title="Sélectionner une section"
                        value={formSection}
                        onChange={(val) => setFormSection(val)}
                        placeholder="Sélectionner une section..."
                        options={[
                          { value: "", label: "Sélectionner une section..." },
                          ...SECTIONS.map((sec) => ({ value: sec, label: sec })),
                        ]}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom personnalisé (laisser vide pour nom auto séquentiel)
                  </label>
                  <input
                    type="text"
                    value={formCustomName}
                    onChange={(e) => setFormCustomName(e.target.value)}
                    placeholder={`Ex: ${formLevel} ${formSection ? formSection + ' ' : ''}classe 2`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Si laissé vide, le système numérote automatiquement la classe par combinaison niveau + section.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-colored-primary flex items-center gap-1.5 cursor-pointer"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Créer la classe</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL MODIFIER / RENOMMER UNE CLASSE */}
      <AnimatePresence>
        {editingClass && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    Modifier la classe
                  </h4>
                  {isLegacySection(editingClass.section) && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                      Sciences ➔ À mettre à jour
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEditingClass(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-semibold">
                  {editError}
                </div>
              )}

              <form onSubmit={handleUpdateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Niveau
                  </label>
                  <TouchSelect
                    title="Niveau"
                    value={editLevel}
                    onChange={(val) => {
                      setEditLevel(val);
                      if (!levelHasSection(val)) {
                        setEditSection("");
                      }
                    }}
                    options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
                  />
                </div>

                <AnimatePresence>
                  {isEditSectionAllowed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Section (choix autorisés : Informatique, Lettres, Économie)
                      </label>
                      <TouchSelect
                        title="Section autorisée"
                        value={editSection}
                        onChange={(val) => setEditSection(val)}
                        placeholder="Choisir une section..."
                        options={[
                          { value: "", label: "Choisir une section..." },
                          ...SECTIONS.map((sec) => ({ value: sec, label: sec })),
                        ]}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom de la classe
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Si le nom est séquentiel automatique (ex: "3ème Sciences classe 1"), il sera automatiquement actualisé vers la nouvelle section.
                  </p>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingClass(null)}
                    disabled={updating}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-colored-primary flex items-center justify-center gap-1.5"
                  >
                    {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Enregistrer</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TIROIR GESTION DES ÉLÈVES D'UNE CLASSE */}
      <AnimatePresence>
        {activeClass && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto pb-28 sm:pb-8"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {activeClass.name}
                      </h3>
                      {isLegacySection(activeClass.section) && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span>Section à mettre à jour</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeClass.level} {activeClass.section ? `• ${activeClass.section}` : ""} &bull;{" "}
                      {activeClass.enrollments?.length || 0} élève(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveClass(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Ajouter un élève dans la classe */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 my-4 space-y-3">
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                    Ajouter un élève compatible à cette classe :
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="flex-1 min-w-0">
                      <TouchSelect
                        title="Sélectionner un élève"
                        value={selectedStudentToAdd}
                        onChange={(val) => setSelectedStudentToAdd(val)}
                        placeholder="Sélectionner un élève disponible..."
                        options={[
                          { value: "", label: "Sélectionner un élève disponible..." },
                          ...eligibleStudents.map((st) => ({
                            value: st.id,
                            label: `${st.lastName} ${st.firstName} (${st.parentPhone})`,
                          })),
                        ]}
                      />
                    </div>
                    <button
                      onClick={handleAddStudentToClass}
                      disabled={!selectedStudentToAdd}
                      className="px-4 py-3 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 shrink-0 transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                  {eligibleStudents.length === 0 && (
                    <p className="text-[11px] text-slate-400">
                      Tous les élèves de ce niveau et de cette section sont déjà affectés.
                    </p>
                  )}
                </div>

                {/* Liste des élèves de la classe */}
                <div className="space-y-2 mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Élèves dans la classe :
                  </h4>
                  {(!activeClass.enrollments || activeClass.enrollments.length === 0) ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Aucun élève dans cette classe.
                    </p>
                  ) : (
                    activeClass.enrollments.map((en: any) => {
                      const studentHasLegacy = isLegacySection(en.student?.section);

                      return (
                        <div
                          key={en.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 font-bold flex items-center justify-center text-xs">
                              {en.student?.lastName[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {en.student?.lastName} {en.student?.firstName}
                                </span>
                                {studentHasLegacy && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 text-[10px] font-bold">
                                    À mettre à jour
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-400 font-mono text-[11px]">
                                {en.student?.parentPhone}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveStudent(en.studentId)}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            title="Retirer de la classe"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
