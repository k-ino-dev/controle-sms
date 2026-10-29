"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  Calendar,
  Filter,
  Loader2,
  AlertTriangle,
  Send,
  Phone,
  Layers,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateTime } from "@/lib/utils";

export default function SmsHistoryPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    sentCount: 0,
    pendingCount: 0,
    failedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtres
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      if (dateFilter) params.set("date", dateFilter);

      const res = await fetch(`/api/sms?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, typeFilter, search, dateFilter]);

  const handleRetrySms = async (id: string) => {
    if (!window.confirm("Attention : veuillez vous assurer que ce SMS n'a pas déjà été reçu par le parent avant de le renvoyer. Souhaitez-vous vraiment procéder à la réexpédition ?")) {
      return;
    }
    setRetryingId(id);
    try {
      const res = await fetch(`/api/sms/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Impossible de réexpédier ce message.");
      } else {
        fetchLogs();
      }
    } catch {
      alert("Erreur de connexion lors de la réexpédition.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Historique des SMS
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suivi des envois aux parents &bull; Encodage PDU Arabe multi-segments UDH
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Cartes de statistiques rapides */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl glass-card">
          <div className="text-xs text-slate-400 font-semibold">Total Messages</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalCount}
          </div>
        </div>
        <div className="p-4 rounded-3xl glass-card border-emerald-500/20">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Envoyés</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.sentCount}
          </div>
        </div>
        <div className="p-4 rounded-3xl glass-card border-amber-500/20">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>En attente</span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.pendingCount}
          </div>
        </div>
        <div className="p-4 rounded-3xl glass-card border-rose-500/20">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            <span>Échecs</span>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {stats.failedCount}
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, élève, texte..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-36 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm"
        >
          <option value="">Tous statuts</option>
          <option value="sent">Envoyé</option>
          <option value="pending">En attente</option>
          <option value="uncertain">Statut incertain</option>
          <option value="failed">Échec</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-48 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm font-medium"
        >
          <option value="">Tous les types</option>
          <option value="absence">Absence</option>
          <option value="paiement - option 1">Paiement - Option 1</option>
          <option value="paiement - option 2">Paiement - Option 2</option>
          <option value="test">Test</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-full md:w-40 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm"
        />
      </div>

      {/* Table des SMS */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card">
          <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Aucun SMS dans l'historique
          </h3>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((sms) => {
            const isSent = sms.status === "sent";
            const isPending = sms.status === "pending";
            const isUncertain = sms.status === "uncertain";
            const isFailed = sms.status === "failed";

            return (
              <div
                key={sms.id}
                className="p-5 rounded-3xl glass-card hover:shadow-subtle transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Badge Statut */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                        isSent
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : isPending
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                          : isUncertain
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {isSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Envoyé</span>
                        </>
                      ) : isPending ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>En attente ({sms.retryCount}/3)</span>
                        </>
                      ) : isUncertain ? (
                        <>
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Statut incertain</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Échec</span>
                        </>
                      )}
                    </span>

                    {/* Référence officielle WinSMS */}
                    {sms.providerRef && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <span>Réf WinSMS : {sms.providerRef}</span>
                      </span>
                    )}

                    {/* Badge Type */}
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold capitalize">
                      {sms.type}
                    </span>

                    {/* Nombre de parties UDH */}
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>{sms.partsCount || 1} partie(s)</span>
                    </span>

                    <span className="text-xs text-slate-400">
                      {formatDateTime(sms.createdAt)}
                    </span>
                  </div>

                  {/* Destinataire & Élève */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sms.parentPhone}</span>
                    </div>
                    {sms.student && (
                      <span className="text-slate-500">
                        Élève : <strong>{sms.student.lastName} {sms.student.firstName}</strong>
                      </span>
                    )}
                  </div>

                  {/* Texte du SMS en arabe avec dir="auto" */}
                  <div
                    dir="auto"
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-sm font-arabic text-slate-800 dark:text-slate-200"
                  >
                    {sms.message}
                  </div>

                  {/* Cause d'échec ou d'incertitude */}
                  {(isFailed || isUncertain) && sms.failReason && (
                    <div className={`text-xs flex items-center gap-1.5 font-medium ${isUncertain ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{isUncertain ? "Attention : " : "Cause du refus : "}{sms.failReason}</span>
                    </div>
                  )}
                </div>

                {/* Bouton Renvoyer pour les SMS en échec ou statut incertain */}
                {(isFailed || isUncertain) && (
                  <div className="shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleRetrySms(sms.id)}
                      disabled={retryingId === sms.id}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-colored-primary flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      {retryingId === sms.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Renvoyer</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
