"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, MessageSquare, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export interface SmsStatusData {
  success: boolean;
  serviceState: "green" | "orange" | "red";
  stateReason?: string | null;
  balance: number | null;
  balanceAvailable?: boolean;
  balanceFormatted?: string;
  isLowBalance: boolean;
  lowBalanceThreshold: number;
  licenceDate?: string | null;
  licenceDateFormatted?: string | null;
  daysUntilExpiry?: number | null;
  licenceExpiringSoon?: boolean;
  lastSendStatus: "success" | "error";
  lastError: string | null;
  lastCheckedRelative?: string;
  failed24hCount?: number;
  provider: string;
}

export function SmsServicePill({ showDetails = false }: { showDetails?: boolean }) {
  const [status, setStatus] = useState<SmsStatusData>({
    success: true,
    serviceState: "green",
    stateReason: null,
    balance: null,
    balanceFormatted: "Vérification...",
    isLowBalance: false,
    lowBalanceThreshold: 25,
    lastSendStatus: "success",
    lastError: null,
    provider: "winsms",
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/sms/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus((prev) => ({ ...prev, serviceState: "red", stateReason: "Service inaccessible" }));
      }
    } catch {
      setStatus((prev) => ({ ...prev, serviceState: "red", stateReason: "Erreur de connexion" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // 15s
    return () => clearInterval(interval);
  }, []);

  const stateColors = {
    green: {
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
      ping: "bg-emerald-400",
      label: "SMS Actif",
    },
    orange: {
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
      ping: "bg-amber-400",
      label: status.licenceExpiringSoon
        ? "Pack expire bientôt"
        : status.balance === null
        ? "Solde indisponible"
        : "Solde SMS bas",
    },
    red: {
      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
      ping: "bg-rose-400",
      label: "SMS en échec",
    },
  }[status.serviceState || "green"];

  const balanceDisplay =
    status.balance !== null && status.balance !== undefined
      ? `${status.balance} SMS`
      : "Solde indisponible";

  const tooltipText = status.stateReason
    ? `État : ${status.stateReason} | ${balanceDisplay}`
    : `Fournisseur : ${status.provider.toUpperCase()} | ${balanceDisplay} | Seuil : ${status.lowBalanceThreshold}`;

  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/parametres"
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-[1.02] ${stateColors.bg}`}
        title={tooltipText}
      >
        <div className="flex items-center gap-2">
          {/* Indicateur d'état pulsant */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stateColors.ping}`}
            />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${stateColors.dot}`} />
          </span>
          <span className="truncate">{stateColors.label}</span>
        </div>

        <span className="text-[11px] font-bold opacity-80 pl-1 border-l border-current/20 shrink-0">
          {balanceDisplay}
        </span>
      </Link>

      {showDetails && (
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 mt-2">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
            <div className="text-slate-400">Solde actuel</div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {balanceDisplay}
            </div>
            {status.lastCheckedRelative && (
              <div className="text-[10px] text-slate-400 mt-0.5">{status.lastCheckedRelative}</div>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
            <div className="text-slate-400">Validité pack</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {status.licenceDateFormatted || "N/A"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bandeau d'alerte global si solde bas, expiration de licence ou échec SMS
export function SmsBalanceBanner() {
  const [status, setStatus] = useState<SmsStatusData | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/sms/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // Ignorer
      }
    };
    check();
    const interval = setInterval(check, 20000);
    return () => clearInterval(interval);
  }, []);

  if (!status || status.serviceState === "green") return null;

  const isRed = status.serviceState === "red";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={`px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-3 sticky top-0 z-40 backdrop-blur-md border-b ${
        isRed
          ? "bg-rose-500/15 border-rose-500/30 text-rose-900 dark:text-rose-200"
          : "bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200"
      }`}
    >
      <div className="flex items-center gap-2">
        {isRed ? (
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <span>
          {isRed ? (
            <>
              <strong>Erreur d'envoi SMS :</strong>{" "}
              {status.stateReason || status.lastError || "Le dernier envoi via WinSMS a échoué. Vérifiez votre compte et la clé API."}
            </>
          ) : status.licenceExpiringSoon ? (
            <>
              <strong>Pack WinSMS bientôt expiré :</strong> La validité du pack se termine le{" "}
              <strong>{status.licenceDateFormatted}</strong> ({status.daysUntilExpiry} jour{status.daysUntilExpiry && status.daysUntilExpiry > 1 ? "s" : ""} restant{status.daysUntilExpiry && status.daysUntilExpiry > 1 ? "s" : ""}). Pensez à renouveler votre licence.
            </>
          ) : status.balance !== null ? (
            <>
              <strong>Solde SMS bas :</strong> Il vous reste <strong>{status.balance} SMS</strong> (seuil d'alerte : {status.lowBalanceThreshold}). Pensez à recharger votre compte WinSMS.
            </>
          ) : (
            <>
              <strong>Solde WinSMS indisponible :</strong> Impossible de lire le solde actuel sur votre compte WinSMS. Vérifiez votre connexion.
            </>
          )}
        </span>
      </div>
      <Link
        href="/parametres"
        className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition text-xs ${
          isRed
            ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-950 dark:text-white"
            : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-white"
        }`}
      >
        Gérer
      </Link>
    </motion.div>
  );
}
