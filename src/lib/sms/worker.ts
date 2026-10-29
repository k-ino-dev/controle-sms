import { prisma } from "@/lib/prisma";
import { getEffectiveSmsProvider, normalizeTunisianPhone } from "./index";
import { sanitizeApiKeyInString } from "@/lib/crypto";

let isRunning = false;
let workerInterval: NodeJS.Timeout | null = null;
let lastBalanceCheck = 0;

/**
 * Calcule le début de la journée courante (00:00:00) selon le fuseau horaire officiel Africa/Tunis
 */
export function getStartOfTodayInTunis(): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Tunis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(new Date()).split("-");
  return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00+01:00`);
}

/**
 * Traitement d'un lot de messages SMS en attente dans la file
 */
export async function processSmsQueueOnce(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  requeued: number;
}> {
  if (isRunning) {
    return { processed: 0, sent: 0, failed: 0, requeued: 0 };
  }

  isRunning = true;
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let requeued = 0;

  try {
    const { provider, config } = await getEffectiveSmsProvider();
    const now = new Date();

    // 1. Récupération périodique du solde WinSMS (toutes les 60 secondes max)
    if (config.mode === "winsms" && config.apiKey && Date.now() - lastBalanceCheck > 60000) {
      try {
        const balance = await provider.getBalance();
        if (balance > 0) {
          await prisma.smsServiceStatus.upsert({
            where: { id: "singleton" },
            update: { balance, lastCheckedAt: now },
            create: { id: "singleton", balance, lastCheckedAt: now },
          });
        }
        lastBalanceCheck = Date.now();
      } catch (err) {
        console.error("[SmsWorker] Erreur mise à jour périodique solde :", err);
      }
    }

    // 2. Limite quotidienne d'envoi (calculée sur la journée Africa/Tunis)
    const dailyLimitSetting = await prisma.setting.findUnique({
      where: { key: "sms_daily_limit" },
    });
    const dailyLimit = dailyLimitSetting ? parseInt(dailyLimitSetting.value, 10) : 500;
    const startOfTodayTunis = getStartOfTodayInTunis();

    // 3. Seuil de crédit bas configuré
    const lowBalanceThresholdSetting = await prisma.setting.findUnique({
      where: { key: "sms_low_balance_threshold" },
    });
    const threshold = lowBalanceThresholdSetting
      ? parseInt(lowBalanceThresholdSetting.value, 10)
      : 25;

    // Dernier solde connu enregistré en base
    const statusRecord = await prisma.smsServiceStatus.findUnique({
      where: { id: "singleton" },
    });

    // 4. Délai configurable entre deux SMS (par défaut 250 ms)
    const delaySetting = await prisma.setting.findUnique({
      where: { key: "sms_send_delay_ms" },
    });
    const delayMs = delaySetting ? parseInt(delaySetting.value, 10) : 250;

    // 5. Sélectionner les SMS "pending" prêts à être envoyés
    const pendingMessages = await prisma.smsQueue.findMany({
      where: {
        status: "pending",
        nextRetryAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    if (pendingMessages.length === 0) {
      isRunning = false;
      return { processed: 0, sent: 0, failed: 0, requeued: 0 };
    }

    const senderId = config.senderId || "Lyc.Emtiyez";

    for (const msg of pendingMessages) {
      processed++;
      const phoneResult = normalizeTunisianPhone(msg.parentPhone);

      // A. Numéro invalide
      if (!phoneResult.valid) {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : ${phoneResult.error || "Numéro invalide (format tunisien 8 chiffres attendu)"}`,
            rawResponse: JSON.stringify({ phone: msg.parentPhone, normalized: phoneResult.normalized }),
          },
        });
        failed++;
        continue;
      }

      // B. BLOCAGES INTERNES SÉPARÉS (sans contacter WinSMS) :
      // 1. Mode simulation
      if (config.mode === "mock") {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: "Bloqué par le site : Mode simulation actif",
            rawResponse: JSON.stringify({ mode: "mock", note: "Aucun envoi réel en mode simulation" }),
          },
        });
        failed++;
        continue;
      }

      // 2. Clé API non configurée
      if (!config.apiKey || !config.apiKey.trim()) {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: "Bloqué par le site : Clé API WinSMS non configurée",
            rawResponse: JSON.stringify({ error: "Missing API Key" }),
          },
        });
        failed++;
        continue;
      }

      // 3. Limite quotidienne atteinte (comptabilisée sur la journée Africa/Tunis)
      const sentTodayCount = await prisma.smsQueue.count({
        where: {
          status: "sent",
          sentAt: { gte: startOfTodayTunis },
        },
      });

      if (sentTodayCount >= dailyLimit) {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : Limite journalière d'envoi atteinte (${dailyLimit} SMS/jour)`,
          },
        });
        failed++;
        continue;
      }

      // 4. Seuil de crédit bas
      // Logique stricte : jamais de blocage si le solde connu est supérieur au seuil !
      if (
        statusRecord &&
        statusRecord.lastCheckedAt &&
        statusRecord.balance <= threshold
      ) {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : Seuil de crédit bas atteint (${statusRecord.balance} SMS restant(s) <= seuil de ${threshold})`,
          },
        });
        failed++;
        continue;
      }

      // C. ANTI-DOUBLON : Vérifier qu'un SMS identique n'a pas déjà été marqué sent
      const alreadySent = await prisma.smsQueue.findFirst({
        where: {
          id: { not: msg.id },
          parentPhone: phoneResult.normalized,
          message: msg.message,
          status: "sent",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (alreadySent) {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : Doublon détecté (SMS identique déjà envoyé avec succès le ${alreadySent.sentAt?.toLocaleTimeString("fr-FR")} réf: ${alreadySent.providerRef || "N/A"})`,
          },
        });
        failed++;
        continue;
      }

      // D. APPEL RÉEL À L'API WINSMS
      const result = await provider.send(phoneResult.normalized, msg.message, senderId);
      const sanitizedRawString = result.raw
        ? sanitizeApiKeyInString(JSON.stringify(result.raw))
        : null;

      // 1. SUCCÈS CONFIRMÉ (code === "ok")
      if (result.success) {
        sent++;
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            providerRef: result.reference || null,
            failReason: null,
            rawResponse: sanitizedRawString,
          },
        });

        // Mise à jour immédiate du solde affiché depuis le champ "balance" retourné par WinSMS
        const newBalance = typeof result.balance === "number" ? result.balance : statusRecord?.balance ?? 0;
        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: {
            balance: newBalance,
            lastCheckedAt: new Date(),
            lastSendStatus: "success",
            lastError: null,
          },
          create: {
            id: "singleton",
            balance: newBalance,
            lastCheckedAt: new Date(),
            lastSendStatus: "success",
          },
        });
      }
      // 2. STATUT INCERTAIN (réponse ambiguë / corps non-JSON reçu) -> NE PAS RETENTER
      else if (result.isUncertain) {
        failed++;
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "uncertain",
            failReason: result.error || "Statut incertain : réponse reçue mais illisible de WinSMS",
            rawResponse: sanitizedRawString,
          },
        });

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: result.error },
          create: { id: "singleton", lastSendStatus: "error", lastError: result.error },
        });
      }
      // 3. ERREUR RÉSEAU (Timeout, 5xx, coupure de connexion) -> RETRY ESPACÉ AUTORISÉ
      else if (result.isNetworkError) {
        const nextAttempt = msg.retryCount + 1;
        const cause = result.error || "Erreur réseau";

        if (nextAttempt >= 3) {
          failed++;
          await prisma.smsQueue.update({
            where: { id: msg.id },
            data: {
              status: "failed",
              retryCount: nextAttempt,
              failReason: `Échec après 3 tentatives réseau : ${cause}`,
              rawResponse: sanitizedRawString,
            },
          });
        } else {
          requeued++;
          const delays = [10 * 1000, 60 * 1000, 300 * 1000];
          const delay = delays[msg.retryCount] || (60 * 1000);
          const nextDate = new Date(Date.now() + delay);

          await prisma.smsQueue.update({
            where: { id: msg.id },
            data: {
              status: "pending",
              retryCount: nextAttempt,
              nextRetryAt: nextDate,
              failReason: `Tentative ${nextAttempt}/3 échouée (erreur réseau) : ${cause}`,
              rawResponse: sanitizedRawString,
            },
          });
        }

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: cause },
          create: { id: "singleton", lastSendStatus: "error", lastError: cause },
        });
      }
      // 4. REFUS PAR L'API (code 102, code inconnu, etc.) -> ÉCHEC IMMÉDIAT SANS NOUVELLE TENTATIVE
      else {
        failed++;
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: result.error || "Refus par WinSMS",
            rawResponse: sanitizedRawString,
          },
        });

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: result.error },
          create: { id: "singleton", lastSendStatus: "error", lastError: result.error },
        });
      }

      // Respecter le délai configurable entre deux envois
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  } catch (error: any) {
    console.error("[SmsWorker] Erreur cycle d'envoi :", error);
  } finally {
    isRunning = false;
  }

  return { processed, sent, failed, requeued };
}

declare global {
  // eslint-disable-next-line no-var
  var __smsWorkerStarted: boolean | undefined;
}

/**
 * Démarrage de la boucle d'arrière-plan toutes les 5 secondes
 */
export function startSmsWorker(intervalMs = 5000): void {
  if (globalThis.__smsWorkerStarted || workerInterval) {
    return;
  }
  globalThis.__smsWorkerStarted = true;

  // Premier passage immédiat
  processSmsQueueOnce().catch((err) => {
    console.error("[SmsWorker] Erreur exécution initiale :", err);
  });

  // Boucle récurrente
  workerInterval = setInterval(() => {
    processSmsQueueOnce().catch((err) => {
      console.error("[SmsWorker] Erreur boucle :", err);
    });
  }, intervalMs);
}

/**
 * Arrêt propre de la boucle
 */
export function stopSmsWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
