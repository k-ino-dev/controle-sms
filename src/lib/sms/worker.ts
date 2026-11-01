import { prisma } from "@/lib/prisma";
import { getEffectiveSmsProvider, normalizeTunisianPhone } from "./index";
import { sanitizeApiKeyInString } from "@/lib/crypto";
import { SmsProvider } from "./types";
import fs from "fs";
import path from "path";

// Identifiant unique de l'instance courante du worker pour le verrouillage distribué
const WORKER_ID = `worker-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
const LOCK_KEY = "sms_worker_lock";
const LOCK_TTL_MS = 15000; // 15 secondes d'expiration du verrou

let isProcessing = false;
let workerInterval: NodeJS.Timeout | null = null;
let lastBalanceCheckTime = 0;
let wakeFileWatcher: fs.FSWatcher | null = null;

// Écouteurs de réveil en mémoire (in-process)
let wakeListeners: Array<() => void> = [];

export function registerWakeListener(listener: () => void): () => void {
  wakeListeners.push(listener);
  return () => {
    wakeListeners = wakeListeners.filter((l) => l !== listener);
  };
}

/**
 * Fichier signal pour réveiller immédiatement un worker distant ou externe
 */
function getWakeFilePath(): string {
  const baseDir = process.env.UPLOADS_DIR
    ? path.dirname(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), "data");
  return path.join(baseDir, ".sms_wake");
}

/**
 * Déclenche immédiatement l'envoi de la file d'attente SMS sans attendre le cycle de 5s
 */
export function triggerSmsWorker(): void {
  // 1. Notification en mémoire (même processus)
  for (const listener of wakeListeners) {
    try {
      listener();
    } catch {
      // Ignore
    }
  }

  // 2. Notification inter-processus par touch de fichier signal
  try {
    const wakeFile = getWakeFilePath();
    const dir = path.dirname(wakeFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(wakeFile, Date.now().toString());
  } catch {
    // Non-bloquant si le fichier est verrouillé ou non accessible
  }
}

/**
 * Gestion du verrou distribué (unique worker actif à la fois)
 */
export async function acquireOrRenewLock(): Promise<boolean> {
  const now = Date.now();
  try {
    const existing = await prisma.setting.findUnique({
      where: { key: LOCK_KEY },
    });

    if (existing) {
      let lockData: { workerId: string; heartbeat: number } | null = null;
      try {
        lockData = JSON.parse(existing.value);
      } catch {
        // En cas de format corrompu, on autorise la reprise
      }

      if (lockData && lockData.workerId !== WORKER_ID && (now - lockData.heartbeat) < LOCK_TTL_MS) {
        // Un autre worker actif détient le verrou
        return false;
      }
    }

    // Acquisition ou renouvellement du verrou
    await prisma.setting.upsert({
      where: { key: LOCK_KEY },
      update: {
        value: JSON.stringify({ workerId: WORKER_ID, heartbeat: now }),
        updatedAt: new Date(),
      },
      create: {
        key: LOCK_KEY,
        value: JSON.stringify({ workerId: WORKER_ID, heartbeat: now }),
      },
    });
    return true;
  } catch {
    // Si la base de données est momentanément inaccessible
    return false;
  }
}

/**
 * Libère proprement le verrou lors de l'arrêt du worker
 */
export async function releaseWorkerLock(): Promise<void> {
  try {
    const existing = await prisma.setting.findUnique({
      where: { key: LOCK_KEY },
    });
    if (existing) {
      const lockData = JSON.parse(existing.value);
      if (lockData.workerId === WORKER_ID) {
        await prisma.setting.delete({ where: { key: LOCK_KEY } });
      }
    }
  } catch {
    // Ignorer à l'extinction
  }
}

/**
 * Passe les SMS coincés en "sending" depuis plus de 2 minutes en "uncertain"
 * (sécurité anti-doublon au démarrage ou après redémarrage imprévu)
 */
export async function recoverStuckSendingSms(): Promise<number> {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const result = await prisma.smsQueue.updateMany({
      where: {
        status: "sending",
        nextRetryAt: { lte: twoMinutesAgo },
      },
      data: {
        status: "uncertain",
        failReason: "Envoi interrompu (délai dépassé > 2 min après redémarrage du conteneur)",
      },
    });

    if (result.count > 0) {
      console.log(`[SmsWorker] ${result.count} SMS coincés en cours d'envoi passés en statut 'uncertain' (sécurité anti-doublon).`);
    }
    return result.count;
  } catch (err) {
    console.error("[SmsWorker] Erreur lors de la récupération des SMS bloqués :", err);
    return 0;
  }
}

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
 * Migre les anciennes valeurs de solde "0" enregistrées par défaut ou suite à un échec vers null,
 * sans toucher aux vrais soldes de 0 confirmés par une lecture explicite de WinSMS sans erreur.
 */
export async function migrateZeroBalanceToNull(): Promise<void> {
  try {
    const status = await prisma.smsServiceStatus.findUnique({
      where: { id: "singleton" },
    });
    if (status && status.balance === 0) {
      // Un solde de 0 est valide UNIQUEMENT si une réponse brute a confirmé {"balance":0} sans erreur
      const isConfirmedZero =
        Boolean(status.rawResponse) &&
        (status.rawResponse!.includes('"balance":0') || status.rawResponse!.includes('"balance":"0"')) &&
        !status.lastError;

      if (!isConfirmedZero) {
        await prisma.smsServiceStatus.update({
          where: { id: "singleton" },
          data: { balance: null },
        });
        console.log("[Migration] Ancien solde '0' non confirmé migré vers null (solde inconnu).");
      }
    }
  } catch {
    // Non bloquant
  }
}

/**
 * Rafraîchit le solde en arrière-plan (au démarrage, toutes les 10 minutes ou après chaque lot)
 */
export async function refreshBalanceIfNeeded(provider: SmsProvider, force = false): Promise<void> {
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const now = Date.now();
  if (!force && (now - lastBalanceCheckTime) < TEN_MINUTES_MS) {
    return;
  }

  // Résolution de la configuration courante pour inspecter l'état de la clé
  const { config } = await getEffectiveSmsProvider();

  if (config.mode !== "winsms") {
    return;
  }

  lastBalanceCheckTime = now;

  // 1. Clé illisible (problème d'ENCRYPTION_KEY)
  if (config.isKeyUnreadable) {
    const reason = "Clé illisible : déchiffrement impossible avec ENCRYPTION_KEY (ressaisissez-la)";
    console.log(`[SmsWorker] Consultation solde impossible : ${reason}`);
    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: {
        lastCheckedAt: new Date(),
        lastError: reason,
        balance: null,
      },
      create: {
        id: "singleton",
        balance: null,
        lastCheckedAt: new Date(),
        lastError: reason,
      },
    });
    return;
  }

  // 2. Clé absente
  if (!config.apiKey || !config.apiKey.trim()) {
    const reason = "Clé API WinSMS non configurée dans Paramètres";
    console.log(`[SmsWorker] Consultation solde impossible : ${reason}`);
    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: {
        lastCheckedAt: new Date(),
        lastError: reason,
        balance: null,
      },
      create: {
        id: "singleton",
        balance: null,
        lastCheckedAt: new Date(),
        lastError: reason,
      },
    });
    return;
  }

  try {
    const result = await provider.getBalance();

    if (result.success && result.balance !== null) {
      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          balance: result.balance,
          licenceDate: result.licenceDate || undefined,
          lastCheckedAt: new Date(),
          rawResponse: result.raw ? sanitizeApiKeyInString(JSON.stringify(result.raw)) : undefined,
          lastError: null,
        },
        create: {
          id: "singleton",
          balance: result.balance,
          licenceDate: result.licenceDate || undefined,
          lastCheckedAt: new Date(),
          rawResponse: result.raw ? sanitizeApiKeyInString(JSON.stringify(result.raw)) : undefined,
        },
      });
      console.log(`[SmsWorker] Solde WinSMS actualisé : ${result.balance} SMS (licence : ${result.licenceDate || "N/A"})`);
    } else {
      const errorReason = result.error || "Réponse inattendue de WinSMS";
      console.log(`[SmsWorker] Échec consultation solde : ${errorReason}`);

      const currentStatus = await prisma.smsServiceStatus.findUnique({
        where: { id: "singleton" },
      });

      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          lastCheckedAt: new Date(),
          lastError: errorReason,
          rawResponse: result.raw ? sanitizeApiKeyInString(JSON.stringify(result.raw)) : undefined,
          // Si le solde était 0 non confirmé, migrer vers null
          ...(currentStatus?.balance === 0 ? { balance: null } : {}),
        },
        create: {
          id: "singleton",
          balance: null,
          lastCheckedAt: new Date(),
          lastError: errorReason,
          rawResponse: result.raw ? sanitizeApiKeyInString(JSON.stringify(result.raw)) : undefined,
        },
      });
    }
  } catch (err: any) {
    const reason = `Connexion impossible (erreur réseau : ${err.message || String(err)})`;
    console.error(`[SmsWorker] Erreur consultation solde : ${sanitizeApiKeyInString(reason)}`);
    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: {
        lastCheckedAt: new Date(),
        lastError: reason,
      },
      create: {
        id: "singleton",
        balance: null,
        lastCheckedAt: new Date(),
        lastError: reason,
      },
    });
  }
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
  if (isProcessing) {
    return { processed: 0, sent: 0, failed: 0, requeued: 0 };
  }

  // Vérification du verrou distribué (un seul worker actif)
  const hasLock = await acquireOrRenewLock();
  if (!hasLock) {
    return { processed: 0, sent: 0, failed: 0, requeued: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let requeued = 0;

  try {
    // 1. Rechargement dynamique de la configuration à chaque cycle (sans redémarrage)
    const { provider, config } = await getEffectiveSmsProvider();
    const now = new Date();

    // 2. Consultation périodique du solde (toutes les 10 min)
    if (config.mode === "winsms" && config.apiKey) {
      await refreshBalanceIfNeeded(provider, false);
    }

    // 3. Paramètres applicatifs
    const dailyLimitSetting = await prisma.setting.findUnique({
      where: { key: "sms_daily_limit" },
    });
    const dailyLimit = dailyLimitSetting ? parseInt(dailyLimitSetting.value, 10) : 150;
    const startOfTodayTunis = getStartOfTodayInTunis();

    const lowBalanceThresholdSetting = await prisma.setting.findUnique({
      where: { key: "sms_low_balance_threshold" },
    });
    const threshold = lowBalanceThresholdSetting
      ? parseInt(lowBalanceThresholdSetting.value, 10)
      : 500;

    const statusRecord = await prisma.smsServiceStatus.findUnique({
      where: { id: "singleton" },
    });

    const delaySetting = await prisma.setting.findUnique({
      where: { key: "sms_send_delay_ms" },
    });
    const delayMs = delaySetting ? parseInt(delaySetting.value, 10) : 250;

    // 4. Sélection des SMS en attente
    const pendingMessages = await prisma.smsQueue.findMany({
      where: {
        status: "pending",
        nextRetryAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    if (pendingMessages.length === 0) {
      isProcessing = false;
      return { processed: 0, sent: 0, failed: 0, requeued: 0 };
    }

    // Log clair requis quand la file n'est pas vide
    console.log(`[SmsWorker] ${pendingMessages.length} SMS en attente, envoi en cours`);

    const senderId = config.senderId || "Lyc.Emtiyez";

    for (const msg of pendingMessages) {
      // Verrouillage d'état atomique : "pending" -> "sending"
      const claimResult = await prisma.smsQueue.updateMany({
        where: { id: msg.id, status: "pending" },
        data: { status: "sending", sentAt: new Date() },
      });

      if (claimResult.count === 0) {
        // Déjà pris en charge par un autre cycle
        continue;
      }

      processed++;
      const phoneResult = normalizeTunisianPhone(msg.parentPhone);

      // A. Numéro invalide
      if (!phoneResult.valid) {
        const errorMsg = phoneResult.error || "Numéro invalide (format 8 chiffres attendu)";
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : ${errorMsg}`,
            rawResponse: JSON.stringify({ phone: msg.parentPhone, normalized: phoneResult.normalized }),
          },
        });
        console.log(`[SmsWorker] SMS #${msg.id} échec : ${errorMsg}`);
        failed++;
        continue;
      }

      // B. Clé API non configurée en mode réel
      if (config.mode === "winsms" && (!config.apiKey || !config.apiKey.trim())) {
        const errorMsg = "Clé API WinSMS non configurée dans Paramètres";
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : ${errorMsg}`,
            rawResponse: JSON.stringify({ error: "Missing API Key" }),
          },
        });
        console.log(`[SmsWorker] SMS #${msg.id} échec : ${errorMsg}`);
        failed++;
        continue;
      }

      // C. Limite journalière d'envoi atteinte
      const sentTodayCount = await prisma.smsQueue.count({
        where: {
          status: "sent",
          sentAt: { gte: startOfTodayTunis },
        },
      });

      if (sentTodayCount >= dailyLimit) {
        const errorMsg = `Limite journalière d'envoi atteinte (${dailyLimit} SMS/jour)`;
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : ${errorMsg}`,
          },
        });
        console.log(`[SmsWorker] SMS #${msg.id} échec : ${errorMsg}`);
        failed++;
        continue;
      }

      // D. Seuil de crédit bas : AVERTISSEMENT SEULEMENT, JAMAIS DE BLOCAGE PAR LE SITE.
      // Le seul vrai blocage est une réponse explicite de WinSMS refusant l'envoi.
      if (
        config.mode === "winsms" &&
        statusRecord?.balance !== null &&
        statusRecord?.balance !== undefined &&
        statusRecord.balance <= threshold
      ) {
        console.log(
          `[SmsWorker] Avertissement solde bas (${statusRecord.balance} SMS <= seuil ${threshold}), envoi maintenu vers WinSMS.`
        );
      }

      // E. Anti-doublon strict (24h)
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
        const errorMsg = `Doublon détecté (SMS déjà envoyé avec réf: ${alreadySent.providerRef || "N/A"})`;
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: `Bloqué par le site : ${errorMsg}`,
          },
        });
        console.log(`[SmsWorker] SMS #${msg.id} échec : ${errorMsg}`);
        failed++;
        continue;
      }

      // F. Envoi réel via le fournisseur (WinSMS ou Mock)
      const result = await provider.send(phoneResult.normalized, msg.message, senderId);
      const sanitizedRawString = result.raw
        ? sanitizeApiKeyInString(JSON.stringify(result.raw))
        : null;

      // 1. Succès
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

        console.log(`[SmsWorker] SMS #${msg.id} envoyé (réf: ${result.reference || "N/A"})`);

        // Mise à jour immédiate du solde et de la licence si retournés
        const newBalance = typeof result.balance === "number" ? result.balance : statusRecord?.balance ?? null;
        const newLicence = result.licenceDate || statusRecord?.licenceDate || null;

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: {
            balance: newBalance,
            licenceDate: newLicence || undefined,
            lastCheckedAt: new Date(),
            lastSendStatus: "success",
            lastError: null,
          },
          create: {
            id: "singleton",
            balance: newBalance,
            licenceDate: newLicence || undefined,
            lastCheckedAt: new Date(),
            lastSendStatus: "success",
          },
        });
      }
      // 2. Statut incertain
      else if (result.isUncertain) {
        failed++;
        const errorMsg = result.error || "Statut incertain : réponse illisible de WinSMS";
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "uncertain",
            failReason: errorMsg,
            rawResponse: sanitizedRawString,
          },
        });

        console.log(`[SmsWorker] SMS #${msg.id} échec : ${errorMsg}`);

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: errorMsg },
          create: { id: "singleton", lastSendStatus: "error", lastError: errorMsg },
        });
      }
      // 3. Erreur réseau (retry avec backoff)
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
          console.log(`[SmsWorker] SMS #${msg.id} échec : Échec après 3 tentatives réseau (${cause})`);
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
          console.log(`[SmsWorker] SMS #${msg.id} échec : ${cause} (nouvelle tentative dans ${delay / 1000}s)`);
        }

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: cause },
          create: { id: "singleton", lastSendStatus: "error", lastError: cause },
        });
      }
      // 4. Refus définitif par WinSMS
      else {
        failed++;
        const errorMsg = result.error || "Refus par WinSMS";
        await prisma.smsQueue.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failReason: errorMsg,
            rawResponse: sanitizedRawString,
          },
        });

        console.log(`[SmsWorker] SMS #${msg.id} échec : ${errorMsg}`);

        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { lastSendStatus: "error", lastError: errorMsg },
          create: { id: "singleton", lastSendStatus: "error", lastError: errorMsg },
        });
      }

      // Délai configurable entre deux envois
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // 5. Rafraîchissement direct du solde après chaque lot traité
    if (processed > 0 && config.mode === "winsms") {
      await refreshBalanceIfNeeded(provider, true);
    }
  } catch (error: any) {
    console.error("[SmsWorker] Erreur cycle d'envoi :", error);
  } finally {
    isProcessing = false;
  }

  return { processed, sent, failed, requeued };
}

declare global {
  // eslint-disable-next-line no-var
  var __smsWorkerStarted: boolean | undefined;
}

/**
 * Démarre le worker de file SMS avec cycle régulier et gestionnaire de réveil
 */
export function startSmsWorker(intervalMs = 5000): void {
  if (globalThis.__smsWorkerStarted || workerInterval) {
    return;
  }
  globalThis.__smsWorkerStarted = true;

  // 0. Migration préventive des anciens soldes 0 non confirmés vers null
  migrateZeroBalanceToNull().catch(() => {});

  // 1. Récupération des SMS bloqués au boot
  recoverStuckSendingSms().catch((err) => {
    console.error("[SmsWorker] Erreur récupération SMS bloqués :", err);
  });

  // 2. Consultation du solde dès le démarrage du worker (forcée)
  getEffectiveSmsProvider()
    .then(({ provider }) => refreshBalanceIfNeeded(provider, true))
    .catch(() => {});

  // 3. Exécution initiale de la file
  processSmsQueueOnce().catch((err) => {
    console.error("[SmsWorker] Erreur cycle initial :", err);
  });

  // 4. Boucle récurrente
  workerInterval = setInterval(() => {
    processSmsQueueOnce().catch((err) => {
      console.error("[SmsWorker] Erreur boucle :", err);
    });
  }, intervalMs);

  // 5. Écoute du réveil immédiat via le fichier signal (inter-processus)
  try {
    const wakeFile = getWakeFilePath();
    const dir = path.dirname(wakeFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(wakeFile)) {
      fs.writeFileSync(wakeFile, Date.now().toString());
    }
    wakeFileWatcher = fs.watch(wakeFile, () => {
      processSmsQueueOnce().catch(() => {});
    });
  } catch {
    // Si fs.watch n'est pas supporté sur le montage
  }

  // 6. Écoute du réveil en mémoire
  registerWakeListener(() => {
    processSmsQueueOnce().catch(() => {});
  });
}

/**
 * Arrêt propre du worker et libération du verrou
 */
export function stopSmsWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  if (wakeFileWatcher) {
    wakeFileWatcher.close();
    wakeFileWatcher = null;
  }
  globalThis.__smsWorkerStarted = false;
  releaseWorkerLock().catch(() => {});
}
