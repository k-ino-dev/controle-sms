"use client";

import { useState, useEffect } from "react";
import {
  Building,
  DollarSign,
  MessageSquare,
  Lock,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Send,
  Loader2,
  Save,
  HelpCircle,
  RefreshCw,
  Smartphone,
  Info,
  Sliders,
  ShieldCheck,
  Check,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SmsServicePill } from "@/components/SmsServicePill";
import { calculateSmsSegments } from "@/lib/sms";
import { DEFAULT_TEMPLATES } from "@/lib/sms/templates";

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState<
    "general" | "tarifs" | "sms" | "winsms" | "securite" | "archivage"
  >("general");

  const [settings, setSettings] = useState<any>({
    school_name: "",
    school_name_fr: "",
    school_phone: "",
    school_address: "",
    school_logo: "",
    prices_by_level: {
      "7ème": 100,
      "8ème": 100,
      "9ème": 100,
      "1ère": 105,
      "2ème": 105,
      "3ème": 110,
      "Bac": 180,
    },
    sms_template_absence: DEFAULT_TEMPLATES.sms_template_absence,
    sms_template_payment_opt1: DEFAULT_TEMPLATES.sms_template_payment_opt1,
    sms_template_payment_opt2: DEFAULT_TEMPLATES.sms_template_payment_opt2,
    winsms_sender_id: "ELIMTIAZ",
    winsms_api_key: "",
    winsms_api_url: "https://api.winsms.tn/v1",
    sms_low_balance_threshold: 25,
    sms_delay_between_sends: 1000,
    sms_daily_limit: 500,
    academic_year: "2026-2027",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // SMS Live Status
  const [smsStatus, setSmsStatus] = useState<any>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Test SMS
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "رسالة تجريبية من معهد الامتياز الخاص. نظام المراقبة والإرسال WinSMS يعمل بنجاح."
  );
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Archivage / Réinitialisation
  const [confirmationInput, setConfirmationInput] = useState("");
  const [nextYearInput, setNextYearInput] = useState("2027-2028");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    setRefreshingStatus(true);
    try {
      const res = await fetch("/api/sms/status");
      if (res.ok) {
        const data = await res.json();
        setSmsStatus(data);
      }
    } catch {
      // Ignorer
    } finally {
      setRefreshingStatus(false);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch("/api/parametres"),
          fetch("/api/sms/status"),
        ]);
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          const loaded = { ...settingsData.settings };
          if (loaded.sms_template_absence?.includes("[HH:MM]")) {
            loaded.sms_template_absence = loaded.sms_template_absence.replaceAll("[HH:MM]", "[الساعة]");
          }
          setSettings(loaded);
        }
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setSmsStatus(statusData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/parametres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        fetchStatus();
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (level: string, val: number) => {
    setSettings((prev: any) => ({
      ...prev,
      prices_by_level: {
        ...prev.prices_by_level,
        [level]: val,
      },
    }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);

    try {
      const res = await fetch("/api/parametres/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Mot de passe modifié avec succès !" });
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setPasswordMsg({ type: "error", text: data.error || "Erreur de mot de passe" });
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Erreur de connexion" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;

    setTestingSms(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `✓ SMS envoyé avec succès au ${data.phone} (${data.segments} segment${data.segments > 1 ? "s" : ""}). Solde restant : ${data.balance} SMS.`,
        });
        fetchStatus();
      } else {
        setTestResult({
          success: false,
          message: `Erreur : ${data.error || "Échec de l'envoi."}`,
        });
      }
    } catch {
      setTestResult({ success: false, message: "Erreur de connexion lors du test." });
    } finally {
      setTestingSms(false);
    }
  };

  const handleResetDatabase = async () => {
    if (confirmationInput !== "ARCHIVER ET REINITIALISER") return;

    setResetting(true);
    setResetResult(null);

    try {
      const res = await fetch("/api/archive/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationText: confirmationInput,
          nextYearName: nextYearInput,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResetResult("✓ Base réinitialisée avec succès ! Sauvegarde de sécurité créée.");
        setConfirmationInput("");
      } else {
        setResetResult(`Erreur : ${data.error}`);
      }
    } catch {
      setResetResult("Erreur de connexion");
    } finally {
      setResetting(false);
    }
  };

  // Helper pour insérer un placeholder à la fin ou au curseur
  const insertVariable = (fieldKey: string, variableText: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [fieldKey]: (prev[fieldKey] || "") + variableText,
    }));
  };

  // Helper de prévisualisation avec valeurs simulées
  const getPreviewText = (template: string, type: "absence" | "opt1" | "opt2") => {
    let text = template || "";
    text = text.replaceAll("[الاسم واللقب]", "محمد علي الفاسي");
    text = text.replaceAll("[الساعة]", "8h");
    text = text.replaceAll("[HH:MM]", "8h");
    text = text.replaceAll("[الشهر]", "أكتوبر");
    text = text.replaceAll("[المبلغ]", "105");
    return text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Paramètres & Configuration
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Établissement, Tarifs, Passerelle WinSMS Tunisie, Modèles arabes et Archivage
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>Paramètres enregistrés avec succès !</span>
          </span>
        )}
      </div>

      {/* Barre d'onglets de configuration */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {[
          { id: "general", label: "Établissement", icon: Building },
          { id: "tarifs", label: "Tarifs par Niveau", icon: DollarSign },
          { id: "sms", label: "Modèles SMS Arabe", icon: MessageSquare },
          { id: "winsms", label: "Passerelle WinSMS Tunisie", icon: Zap },
          { id: "securite", label: "Sécurité & Mot de passe", icon: Lock },
          { id: "archivage", label: "Archivage & Nouvelle Année", icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-colored-primary"
                  : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ONGLET 1 : ÉTABLISSEMENT */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl glass-card space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
            Identité de l'Établissement
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nom de l'établissement (Arabe)
              </label>
              <input
                type="text"
                dir="rtl"
                required
                value={settings.school_name}
                onChange={(e) => setSettings({ ...settings, school_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-arabic"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nom de l'établissement (Français)
              </label>
              <input
                type="text"
                required
                value={settings.school_name_fr}
                onChange={(e) => setSettings({ ...settings, school_name_fr: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Téléphone de l'école
              </label>
              <input
                type="text"
                value={settings.school_phone}
                onChange={(e) => setSettings({ ...settings, school_phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Année Scolaire en cours
              </label>
              <input
                type="text"
                value={settings.academic_year}
                onChange={(e) => setSettings({ ...settings, academic_year: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Adresse complète
            </label>
            <input
              type="text"
              value={settings.school_address}
              onChange={(e) => setSettings({ ...settings, school_address: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>

          {/* Logo de l'établissement */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Logo officiel de l'établissement (utilisé pour les reçus, le site et l'en-tête mobile)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="h-20 w-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 flex items-center justify-center shrink-0 shadow-sm overflow-hidden relative group">
                <img
                  src={settings.school_logo || "/logo-transparent.png"}
                  alt="Aperçu logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center gap-2 ${
                    uploadingLogo
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 cursor-not-allowed"
                      : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                  }`}>
                    {uploadingLogo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{uploadingLogo ? "Téléversement..." : "Téléverser un nouveau logo"}</span>
                    <input
                      type="file"
                      disabled={uploadingLogo}
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingLogo(true);
                        setLogoError(null);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const res = await fetch("/api/uploads", {
                            method: "POST",
                            body: formData,
                          });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            setSettings((prev: any) => ({
                              ...prev,
                              school_logo: data.url,
                            }));
                          } else {
                            setLogoError(data.error || "Échec du téléversement");
                          }
                        } catch {
                          setLogoError("Erreur de connexion au serveur");
                        } finally {
                          setUploadingLogo(false);
                        }
                      }}
                    />
                  </label>

                  {settings.school_logo && (
                    <button
                      type="button"
                      onClick={() => setSettings((prev: any) => ({ ...prev, school_logo: "" }))}
                      className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-300 transition"
                    >
                      Rétablir logo par défaut
                    </button>
                  )}
                </div>

                {logoError && (
                  <p className="text-xs text-rose-500 font-medium">{logoError}</p>
                )}

                <p className="text-[11px] text-slate-400">
                  Logo actif : <code>{settings.school_logo || "/logo-transparent.png"}</code>.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-colored-primary flex items-center gap-2 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Enregistrer les modifications</span>
            </button>
          </div>
        </form>
      )}

      {/* ONGLET 2 : TARIFS PAR NIVEAU */}
      {activeTab === "tarifs" && (
        <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl glass-card space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Tarifs Mensuels par Niveau (en Dinars Tunisiens - DT)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Le total annuel est calculé automatiquement sur une base de 9 mois de scolarité (Octobre &rarr; Juin).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {Object.keys(settings.prices_by_level || {}).map((lvl) => {
              const monthly = settings.prices_by_level[lvl] || 0;
              const annual = monthly * 9;

              return (
                <div
                  key={lvl}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Classe de {lvl}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Total an : {annual} DT
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      required
                      value={monthly}
                      onChange={(e) => handlePriceChange(lvl, Number(e.target.value))}
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      DT / m
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-colored-primary flex items-center gap-2 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Enregistrer les tarifs</span>
            </button>
          </div>
        </form>
      )}

      {/* ONGLET 3 : MODÈLES SMS ARABE (3 MODÈLES ÉDITABLES AVEC PUCES, COMPTEUR & PREVIEW) */}
      {activeTab === "sms" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-2">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Modèles de Messages SMS (Envoyés aux Parents en Arabe)
            </h3>
            <p className="text-xs text-slate-400">
              Personnalisez les 3 modèles officiels. Cliquez sur les puces pour insérer automatiquement les variables dynamiques. Le nombre de segments SMS Unicode est calculé en temps réel (1 segment = 70 caractères, puis 67 car./segment).
            </p>
          </div>

          {/* 1. Modèle Absence */}
          {(() => {
            const template = settings.sms_template_absence || "";
            const { charCount, segments, charsPerSegment } = calculateSmsSegments(template);
            const preview = getPreviewText(template, "absence");

            return (
              <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-4 border-l-4 border-l-rose-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                      Modèle 1 &bull; Notification automatique
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      SMS d'Absence (Contrôle en classe)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev: any) => ({
                        ...prev,
                        sms_template_absence: DEFAULT_TEMPLATES.sms_template_absence,
                      }))
                    }
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rétablir le texte par défaut</span>
                  </button>
                </div>

                {/* Puces de variables */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Insérer une variable :
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: " [الاسم واللقب]", label: "Nom & Prénom de l'élève" },
                      { tag: " [الساعة]", label: "Heure (ex: 8h)" },
                    ].map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable("sms_template_absence", v.tag)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition cursor-pointer"
                      >
                        + {v.tag.trim()} ({v.label})
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={3}
                  dir="rtl"
                  required
                  value={template}
                  onChange={(e) =>
                    setSettings({ ...settings, sms_template_absence: e.target.value })
                  }
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-arabic focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                />

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Longueur : <strong>{charCount}</strong> caractères
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold">
                    {segments} segment{segments > 1 ? "s" : ""} ({segments} crédit{segments > 1 ? "s" : ""})
                  </span>
                </div>

                {/* Prévisualisation */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Aperçu sur le téléphone du parent (données d'exemple) :
                  </span>
                  <p dir="rtl" className="font-arabic text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {preview}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* 2. Modèle Paiement Option 1 */}
          {(() => {
            const template = settings.sms_template_payment_opt1 || "";
            const { charCount, segments } = calculateSmsSegments(template);
            const preview = getPreviewText(template, "opt1");

            return (
              <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-4 border-l-4 border-l-blue-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-500">
                      Modèle 2 &bull; Rappel Manuel
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      Paiement : Option 1 (Rappel amical de courtoisie)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev: any) => ({
                        ...prev,
                        sms_template_payment_opt1: DEFAULT_TEMPLATES.sms_template_payment_opt1,
                      }))
                    }
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rétablir modèle par défaut</span>
                  </button>
                </div>

                {/* Puces de variables */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Insérer une variable :
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: " [الاسم واللقب]", label: "Nom & Prénom de l'élève" },
                      { tag: " [الشهر]", label: "Mois d'échéance" },
                      { tag: " [المبلغ]", label: "Montant dû en DT" },
                    ].map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable("sms_template_payment_opt1", v.tag)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                      >
                        + {v.tag.trim()} ({v.label})
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={3}
                  dir="rtl"
                  required
                  value={template}
                  onChange={(e) =>
                    setSettings({ ...settings, sms_template_payment_opt1: e.target.value })
                  }
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-arabic focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Longueur : <strong>{charCount}</strong> caractères
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold">
                    {segments} segment{segments > 1 ? "s" : ""} ({segments} crédit{segments > 1 ? "s" : ""})
                  </span>
                </div>

                {/* Prévisualisation */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Aperçu sur le téléphone du parent (données d'exemple) :
                  </span>
                  <p dir="rtl" className="font-arabic text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {preview}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* 3. Modèle Paiement Option 2 */}
          {(() => {
            const template = settings.sms_template_payment_opt2 || "";
            const { charCount, segments } = calculateSmsSegments(template);
            const preview = getPreviewText(template, "opt2");

            return (
              <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-4 border-l-4 border-l-amber-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                      Modèle 3 &bull; Avertissement Ferme
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      Paiement : Option 2 (Avertissement de suspension / Appel urgent)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev: any) => ({
                        ...prev,
                        sms_template_payment_opt2: DEFAULT_TEMPLATES.sms_template_payment_opt2,
                      }))
                    }
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rétablir modèle par défaut</span>
                  </button>
                </div>

                {/* Puces de variables */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Insérer une variable :
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: " [الاسم واللقب]", label: "Nom & Prénom de l'élève" },
                      { tag: " [الشهر]", label: "Mois d'échéance" },
                    ].map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable("sms_template_payment_opt2", v.tag)}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-semibold hover:bg-amber-100 transition cursor-pointer"
                      >
                        + {v.tag.trim()} ({v.label})
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={3}
                  dir="rtl"
                  required
                  value={template}
                  onChange={(e) =>
                    setSettings({ ...settings, sms_template_payment_opt2: e.target.value })
                  }
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-arabic focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Longueur : <strong>{charCount}</strong> caractères
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold">
                    {segments} segment{segments > 1 ? "s" : ""} ({segments} crédit{segments > 1 ? "s" : ""})
                  </span>
                </div>

                {/* Prévisualisation */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Aperçu sur le téléphone du parent (données d'exemple) :
                  </span>
                  <p dir="rtl" className="font-arabic text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {preview}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-colored-primary flex items-center gap-2 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Enregistrer tous les modèles SMS</span>
            </button>
          </div>
        </form>
      )}

      {/* ONGLET 4 : PASSERELLE WINSMS TUNISIE */}
      {activeTab === "winsms" && (
        <div className="space-y-6">
          {/* État du service & Solde en direct */}
          <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500" />
                  <span>Passerelle WinSMS Tunisie (Envoi direct par Internet)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tous les SMS sont expédiés via l'API sécurisée WinSMS Tunisie sans aucun matériel ni modem GSM requis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <SmsServicePill />
                <button
                  onClick={fetchStatus}
                  disabled={refreshingStatus}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
                  title="Rafraîchir le solde"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingStatus ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Cartes métriques SMS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block">Solde WinSMS</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {smsStatus?.balance ?? 0} SMS
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block">Fournisseur actif</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  {smsStatus?.provider || "mock"}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block">Seuil d'alerte bas</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {settings.sms_low_balance_threshold} SMS
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block">Dernier statut</span>
                <span
                  className={`text-sm font-bold ${
                    smsStatus?.lastSendStatus === "error"
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  {smsStatus?.lastSendStatus === "error" ? "Erreur" : "Opérationnel"}
                </span>
              </div>
            </div>

            {smsStatus?.lastError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                Dernière cause d'erreur : {smsStatus.lastError}
              </div>
            )}
          </div>

          {/* Formulaire de configuration des identifiants WinSMS */}
          <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl glass-card space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Identifiants & Paramètres de l'API WinSMS
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sender ID (Nom d'expéditeur officiel)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ELIMTIAZ"
                  value={settings.winsms_sender_id}
                  onChange={(e) => setSettings({ ...settings, winsms_sender_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  L'entête SMS unique validé auprès de WinSMS et des opérateurs tunisiens (ex: ELIMTIAZ).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Clé API WinSMS (Secret Key)
                </label>
                <input
                  type="password"
                  placeholder="winsms_key_..."
                  value={settings.winsms_api_key}
                  onChange={(e) => setSettings({ ...settings, winsms_api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Reste confidentielle côté serveur, jamais transmise au navigateur client.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  URL de l'API WinSMS
                </label>
                <input
                  type="text"
                  value={settings.winsms_api_url}
                  onChange={(e) => setSettings({ ...settings, winsms_api_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Seuil d'alerte crédit bas (en nombre de SMS)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={settings.sms_low_balance_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sms_low_balance_threshold: parseInt(e.target.value, 10) || 25,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Délai entre deux envois successifs (millisecondes)
                </label>
                <input
                  type="number"
                  min="200"
                  step="100"
                  value={settings.sms_delay_between_sends}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sms_delay_between_sends: parseInt(e.target.value, 10) || 1000,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Limite maximale journalière (sécurité anti-débordement)
                </label>
                <input
                  type="number"
                  min="50"
                  value={settings.sms_daily_limit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sms_daily_limit: parseInt(e.target.value, 10) || 500,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-colored-primary flex items-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Enregistrer la configuration WinSMS</span>
              </button>
            </div>
          </form>

          {/* Test d'envoi SMS en direct */}
          <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Test d'Envoi SMS en Direct
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Envoyez un message test vers votre propre numéro mobile tunisien pour valider la clé API et l'entête WinSMS.
              </p>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold ${
                  testResult.success
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                {testResult.message}
              </div>
            )}

            <form onSubmit={handleSendTestSms} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Numéro de téléphone de test (Tunisie, ex: 98123456 ou 21698123456) :
                </label>
                <input
                  type="text"
                  required
                  placeholder="98123456"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full max-w-sm px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Texte du message :
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-arabic"
                />
              </div>

              <button
                type="submit"
                disabled={testingSms}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-colored-success flex items-center gap-2 cursor-pointer transition"
              >
                {testingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Envoyer le SMS de test</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ONGLET 5 : SÉCURITÉ & MOT DE PASSE */}
      {activeTab === "securite" && (
        <form onSubmit={handleChangePassword} className="p-6 sm:p-8 rounded-3xl glass-card max-w-md space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
            Modifier le Mot de Passe Directeur
          </h3>

          {passwordMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold ${
                passwordMsg.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-600"
              }`}
            >
              {passwordMsg.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mot de passe actuel
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-colored-primary flex items-center justify-center gap-2 cursor-pointer"
          >
            {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Mettre à jour le mot de passe</span>
          </button>
        </form>
      )}

      {/* ONGLET 6 : ARCHIVAGE DE L'ANNÉE & NOUVELLE ANNÉE */}
      {activeTab === "archivage" && (
        <div className="space-y-6">
          {/* Étape 1 : Téléchargement de l'archive */}
          <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-500" />
              <span>1. Télécharger l'Archive Complète (.db)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Téléchargez une copie intégrale de la base de données actuelle contenant tous les élèves, classes, absences, paiements et SMS.
            </p>
            <a
              href="/api/archive/export"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-colored-primary transition"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le fichier d'archive</span>
            </a>
          </div>

          {/* Étape 2 : Démarrage d'une nouvelle année scolaire */}
          <div className="p-6 sm:p-8 rounded-3xl glass-card border-rose-500/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  2. Démarrer une Nouvelle Année Scolaire
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Zone critique &bull; Double confirmation obligatoire
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Une sauvegarde de sécurité automatique sera effectuée avant l'opération. Ensuite, les élèves, classes, absences, paiements et SMS seront remis à zéro pour l'année scolaire suivante. Vos paramètres d'établissement et grilles tarifaires seront précieusement conservés.
            </p>

            {resetResult && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold">
                {resetResult}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nom de la nouvelle année scolaire :
                </label>
                <input
                  type="text"
                  value={nextYearInput}
                  onChange={(e) => setNextYearInput(e.target.value)}
                  placeholder="2027-2028"
                  className="w-full max-w-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">
                  Pour confirmer, tapez exactement :{" "}
                  <span className="font-mono bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded text-rose-800 dark:text-rose-200">
                    ARCHIVER ET REINITIALISER
                  </span>
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="ARCHIVER ET REINITIALISER"
                  className="w-full max-w-md px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-900 text-sm font-mono"
                />
              </div>

              <button
                onClick={handleResetDatabase}
                disabled={confirmationInput !== "ARCHIVER ET REINITIALISER" || resetting}
                className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-colored-danger flex items-center gap-2 cursor-pointer transition"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Confirmer et réinitialiser pour la nouvelle année</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
