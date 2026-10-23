import { prisma } from "@/lib/prisma";
import { getSmsProvider, normalizeTunisianPhone } from "./index";

let isRunning = false;
let workerInterval: NodeJS.Timeout | null = null;
let lastBalanceCheck = 0;

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
    const provider = getSmsProvider();
    const now = new Date();

    // 1. Récupération périodique du solde WinSMS (toutes les 60 secondes max)
    if (Date.now() - lastBalanceCheck > 60000) {
      try {
        const balance = await provider.getBalance();
        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { balance, lastCheckedAt: now },
          create: { id: "singleton", balance, lastCheckedAt: now },
        });
        lastBalanceCheck = Date.now();
      } catch (err) {
        console.error("[SmsWorker] Erreur mise à jour solde :", err);
      }
    }

    // 2. Vérification de la limite quotidienne d'envoi configurée
    const dailyLimitSetting = await prisma.setting.findUnique({
      where: { key: "sms_daily_limit" },
    });
    const dailyLimit = dailyLimitSetting ? parseInt(dailyLimitSetting.value, 10) : 500;

    // Compter les SMS déjà envoyés aujourd'hui (depuis minuit)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sentTodayCount = await prisma.smsQueue.count({
      where: {
        status: "sent",
        sentAt: { gte: todayStart },
      },
    });

    if (sentTodayCount >= dailyLimit) {
      console.warn(`[SmsWorker] Limite quotidienne atteinte (${sentTodayCount}/${dailyLimit} SMS envoyés aujourd'hui). Envoi suspendu.`);
      isRunning = false;
      return { processed: 0, sent: 0, failed: 0, requeued: 0 };
    }

    // 3. Délai configurable entre deux SMS (par défaut 250 ms)
    const delaySetting = await prisma.setting.findUnique({
      where: { key: "sms_send_delay_ms" },
    });
    const delayMs = delaySetting ? parseInt(delaySetting.value, 10) : 250;

    // 4. Sélectionner les SMS "pending" prêts à être envoyés
    const pendingMessages = await prisma.smsQueue.findMany({
      where: {
        status: "pending",
        nextRetryAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
      take: 10, // Traiter par lots de 10
    });

    if (pendingMessages.length === 0) {
      isRunning = false;
      return { processed: 0, sent: 0, failed: 0, requeued: 0 };
    }

    // Récupérer le senderId configuré s'il existe
    const senderIdSetting = await prisma.setting.findUnique({
      where: { key: "winsms_sender_id" },
    });
    const senderId = senderIdSetting?.value || process.env.WINSMS_SENDER_ID || "IMTIYAZ";

    for (const msg of pendingMessages) {
      processed++;
      const phoneResult = normalizeTunisianPhone(msg.parentPhone);

      // Si le numéro est manifestement non valide dès l'analyse
      if (!phoneResult.valid) {
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: phoneResult.error || "Numéro invalide (format tunisien 8 chiffres attendu)",
            rawResponse: JSON.stringify({ phone: msg.parentPhone, normalized: phoneResult.normalized }),
          },
        });
        failed++;
        continue;
      }

      // Appel de l'envoi via l'interface SmsProvider
      const result = await provider.send(phoneResult.normalized, msg.message, senderId);

      if (result.success) {
        sent++;
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            failReason: null,
            rawResponse: result.raw ? JSON.stringify(result.raw) : null,
          },
        });

        // Mettre à jour l'état de service global
        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "success", lastError: null },
          create: { id: "singleton", lastSendStatus: "success" },
        });
      } else {
        // En cas d'échec : Gestion des 3 tentatives espacées (10 s, 1 min, 5 min)
        const nextAttempt = msg.retryCount + 1;
        const cause = result.error || "Erreur de transmission SMS";

        if (nextAttempt >= 3) {
          // Échec définitif après 3 tentatives
          failed++;
          await prisma.smsQueue.update({
            where: { id: msg.id },
            data: {
              status: "failed",
              retryCount: nextAttempt,
              failReason: cause,
              rawResponse: result.raw ? JSON.stringify(result.raw) : null,
            },
          });
        } else {
          // Reprogrammer une tentative espacée :
          // tentative 1 -> +10 secondes
          // tentative 2 -> +60 secondes (1 min)
          // tentative 3 -> +300 secondes (5 min)
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
              failReason: `Tentative ${nextAttempt}/3 échouée : ${cause}`,
              rawResponse: result.raw ? JSON.stringify(result.raw) : null,
            },
          });
        }

        // Mettre à jour l'état de service global
        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: cause },
          create: { id: "singleton", lastSendStatus: "error", lastError: cause },
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
