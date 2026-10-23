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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const levels = ["7ème", "8ème", "9ème", "1ère", "2ème", "3ème", "Bac"];
const sections = ["Informatique", "Sciences", "Lettres"];

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Renommer une classe
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [newName, setNewName] = useState("");

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

  useEffect(() => {
    fetchClasses();
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
      const isSectionNeeded = ["2ème", "3ème", "Bac"].includes(formLevel);
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
      fetchClasses();
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
        fetchClasses();
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
        fetchClasses();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = async () => {
    if (!editingClass || !newName.trim()) return;
    try {
      await fetch(`/api/classes/${editingClass.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setEditingClass(null);
      fetchClasses();
      if (activeClass?.id === editingClass.id) {
        setActiveClass((prev: any) => ({ ...prev, name: newName.trim() }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Voulez-vous supprimer cette classe ? Les élèves ne seront pas supprimés mais perdront leur affectation.")) return;
    try {
      await fetch(`/api/classes/${id}`, { method: "DELETE" });
      if (activeClass?.id === id) setActiveClass(null);
      fetchClasses();
    } catch (err) {
      console.error(err);
    }
  };

  const isSectionAllowed = ["2ème", "3ème", "Bac"].includes(formLevel);

  return (
    <div className="space-y-6">
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

      {/* Grille des classes */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : classes.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card">
          <School className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Aucune classe créée
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Cliquez sur "Ajouter une classe" pour commencer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, idx) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="p-5 rounded-3xl glass-card hover:shadow-colored-primary hover:-translate-y-0.5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <School className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">
                        {cls.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {cls.level} {cls.section ? `• ${cls.section}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingClass(cls);
                        setNewName(cls.name);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Renommer"
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
          ))}
        </div>
      )}

      {/* MODAL AJOUT CLASSE (avec nom séquentiel automatique) */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
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
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Niveau
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => {
                      setFormLevel(e.target.value);
                      if (!["2ème", "3ème", "Bac"].includes(e.target.value)) {
                        setFormSection("");
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    {levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <AnimatePresence>
                  {isSectionAllowed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Section
                      </label>
                      <select
                        required
                        value={formSection}
                        onChange={(e) => setFormSection(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                      >
                        <option value="">Sélectionner une section...</option>
                        {sections.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
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
                    Si laissé vide, le système incrémente automatiquement le numéro de classe.
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
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-colored-primary flex items-center gap-1.5"
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

      {/* TIROIR GESTION DES ÉLÈVES D'UNE CLASSE */}
      <AnimatePresence>
        {activeClass && (
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
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {activeClass.name}
                    </h3>
                    <p className="text-xs text-slate-400">
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
                  <div className="flex gap-2">
                    <select
                      value={selectedStudentToAdd}
                      onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="">Sélectionner un élève disponible...</option>
                      {eligibleStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.lastName} {st.firstName} ({st.parentPhone})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddStudentToClass}
                      disabled={!selectedStudentToAdd}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 shrink-0"
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
                    activeClass.enrollments.map((en: any) => (
                      <div
                        key={en.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 font-bold flex items-center justify-center text-xs">
                            {en.student?.lastName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {en.student?.lastName} {en.student?.firstName}
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">
                              {en.student?.parentPhone}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveStudent(en.studentId)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Retirer de la classe"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL RENOMMER */}
      <AnimatePresence>
        {editingClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl glass-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <h4 className="font-bold text-base text-slate-900 dark:text-white mb-3">
                Renommer la classe
              </h4>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingClass(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRename}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
