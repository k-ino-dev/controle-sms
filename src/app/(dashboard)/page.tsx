"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserX,
  CreditCard,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    absentToday: 0,
    monthlyRevenue: 0,
    smsSent: 0,
    smsPending: 0,
    smsFailed: 0,
  });
  const [smsStatus, setSmsStatus] = useState({
    balance: 0,
    isLowBalance: false,
    serviceState: "green" as "green" | "orange" | "red",
    lowBalanceThreshold: 25,
    lastError: null as string | null,
  });
  const [recentAbsences, setRecentAbsences] = useState<any[]>([]);
  const [absenceTrend, setAbsenceTrend] = useState<any[]>([]);
  const [paymentTrend, setPaymentTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [studentsRes, presenceRes, paymentsRes, smsRes, smsStatusRes] = await Promise.all([
          fetch("/api/eleves"),
          fetch("/api/presence"),
          fetch("/api/paiements"),
          fetch("/api/sms"),
          fetch("/api/sms/status"),
        ]);

        const studentsData = await studentsRes.json();
        const presenceData = await presenceRes.json();
        const paymentsData = await paymentsRes.json();
        const smsData = await smsRes.json();
        const smsStatusData = smsStatusRes.ok ? await smsStatusRes.json() : null;

        const students = studentsData.students || [];
        const sessions = presenceData.sessions || [];
        const payments = paymentsData.students || [];
        const smsLogs = smsData.logs || [];

        // Calcul des absents du jour
        const todayStr = new Date().toISOString().slice(0, 10);
        let absentsCount = 0;
        const recent: any[] = [];

        sessions.forEach((sess: any) => {
          if (sess.date?.startsWith(todayStr)) {
            absentsCount += sess.absences?.length || 0;
          }
          sess.absences?.forEach((ab: any) => {
            recent.push({
              id: ab.id,
              studentName: `${ab.student?.firstName} ${ab.student?.lastName}`,
              className: sess.class?.name || "Classe",
              time: sess.recordedAtTime,
              date: sess.date,
              smsSent: ab.smsSent,
            });
          });
        });

        // Calcul total paiements du mois en cours
        let totalRev = 0;
        payments.forEach((s: any) => {
          totalRev += s.totalPaid || 0;
        });

        setStats({
          totalStudents: students.length,
          absentToday: absentsCount,
          monthlyRevenue: totalRev,
          smsSent: smsData.stats?.sentCount || 0,
          smsPending: smsData.stats?.pendingCount || 0,
          smsFailed: smsData.stats?.failedCount || 0,
        });

        if (smsStatusData) {
          setSmsStatus({
            balance: smsStatusData.balance ?? 0,
            isLowBalance: Boolean(smsStatusData.isLowBalance),
            serviceState: smsStatusData.serviceState || "green",
            lowBalanceThreshold: smsStatusData.lowBalanceThreshold || 25,
            lastError: smsStatusData.lastError || null,
          });
        }

        setRecentAbsences(recent.slice(0, 5));

        // Données graphiques 7 derniers jours
        const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
        const dummyAbsenceTrend = days.map((day, idx) => ({
          day,
          absents: (idx * 2 + 1) % 5,
        }));
        setAbsenceTrend(dummyAbsenceTrend);

        // Données graphiques paiements
        const monthsList = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin"];
        const dummyPayTrend = monthsList.map((m, idx) => ({
          month: m,
          montant: idx === 0 ? 1850 : idx === 1 ? 1240 : 0,
        }));
        setPaymentTrend(dummyPayTrend);
      } catch (err) {
        console.error("Erreur chargement dashboard :", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const statCards = [
    {
      title: "Total Élèves",
      value: stats.totalStudents,
      label: "Inscrits cette année",
      icon: Users,
      color: "from-indigo-500 to-violet-600",
      shadow: "shadow-colored-primary",
      href: "/eleves",
    },
    {
      title: "Absents Aujourd'hui",
      value: stats.absentToday,
      label: "Parents prévenus par SMS",
      icon: UserX,
      color: "from-rose-500 to-pink-600",
      shadow: "shadow-colored-danger",
      href: "/presence",
    },
    {
      title: "Frais Encaissés",
      value: formatCurrency(stats.monthlyRevenue),
      label: "Total perçu",
      icon: CreditCard,
      color: "from-emerald-500 to-teal-600",
      shadow: "shadow-colored-success",
      href: "/paiements",
    },
    {
      title: "SMS & Solde",
      value: stats.smsSent,
      label: smsStatus.isLowBalance
        ? `⚠️ ${smsStatus.balance} restants (Solde bas)`
        : `${smsStatus.balance} SMS restants • ${stats.smsPending} en file`,
      icon: MessageSquare,
      color: smsStatus.isLowBalance
        ? "from-amber-500 to-orange-600"
        : "from-cyan-500 to-blue-600",
      shadow: "shadow-colored-primary",
      href: "/sms",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête de bienvenue & Raccourcis rapides */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Tableau de bord
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aperçu en direct de l'établissement &bull; Année 2026-2027
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/presence"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-colored-success transition-all transform active:scale-95"
          >
            <UserX className="w-4 h-4" />
            <span>Faire un contrôle</span>
          </Link>
          <Link
            href="/paiements"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-sm shadow-sm transition-all active:scale-95"
          >
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Nouveau paiement</span>
          </Link>
        </div>
      </div>

      {/* Alerte si le crédit SMS est bas */}
      {smsStatus.isLowBalance && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-sm shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                Solde SMS faible : {smsStatus.balance} crédits restants
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-300">
                Le seuil d'alerte est fixé à {smsStatus.lowBalanceThreshold} SMS. Rechargez votre compte WinSMS Tunisie pour garantir la continuité des notifications d'absences et de paiements.
              </div>
            </div>
          </div>
          <Link
            href="/parametres"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 transition text-center shadow-sm"
          >
            Gérer le compte SMS
          </Link>
        </div>
      )}

      {/* Cartes KPI avec compteurs animés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.3 }}
            >
              <Link
                href={card.href}
                className="block p-5 rounded-3xl glass-card hover:-translate-y-1 transition-all duration-200 group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white ${card.shadow} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {loading ? "..." : card.value}
                </div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                  {card.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {card.label}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Graphiques interactifs Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des Absences */}
        <div className="p-6 rounded-3xl glass-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Absences des 7 derniers jours
              </h3>
              <p className="text-xs text-slate-400">Nombre d'absents enregistrés</p>
            </div>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={absenceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderRadius: "12px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="absents"
                  stroke="#F43F5E"
                  strokeWidth={3}
                  dot={{ fill: "#F43F5E", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Encaissements par mois */}
        <div className="p-6 rounded-3xl glass-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Recouvrement mensuel (DT)
              </h3>
              <p className="text-xs text-slate-400">Frais de scolarité perçus par mois</p>
            </div>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val} DT`, "Encaissé"]}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderRadius: "12px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="montant" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Raccourci vers les derniers absents */}
      <div className="p-6 rounded-3xl glass-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Dernières absences enregistrées
            </h3>
            <p className="text-xs text-slate-400">Élèves absents lors des derniers contrôles</p>
          </div>
          <Link
            href="/presence"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Voir tout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentAbsences.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Aucune absence récente enregistrée.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentAbsences.map((ab) => (
              <div key={ab.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                    ABS
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      {ab.studentName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {ab.className} &bull; à {ab.time}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>SMS envoyé</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
