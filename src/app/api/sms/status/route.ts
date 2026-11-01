import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEffectiveSmsProvider } from "@/lib/sms";
import { sanitizeApiKeyInString } from "@/lib/crypto";
import { migrateZeroBalanceToNull } from "@/lib/sms/worker";

export const dynamic = "force-dynamic";

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Jamais vérifié";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
}

function parseDaysUntilExpiry(licenceDateStr?: string | null): number | null {
  if (!licenceDateStr) return null;
  const parts = licenceDateStr.trim().split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const expiry = new Date(year, month, day, 23, 59, 59);
    if (!isNaN(expiry.getTime())) {
      const diffMs = expiry.getTime() - Date.now();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Migration préventive des anciens soldes 0
  await migrateZeroBalanceToNull();

  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const { provider, config } = await getEffectiveSmsProvider();

    let statusRecord = await prisma.smsServiceStatus.findUnique({
      where: { id: "singleton" },
    });

    const lowBalanceThresholdSetting = await prisma.setting.findUnique({
      where: { key: "sms_low_balance_threshold" },
    });
    const lowBalanceThreshold = lowBalanceThresholdSetting
      ? parseInt(lowBalanceThresholdSetting.value, 10)
      : 500;

    // Si rafraîchissement demandé explicitement (ex: clic sur "Rafraîchir")
    if (forceRefresh && config.mode === "winsms" && config.apiKey) {
      try {
        const balResult = await provider.getBalance();
        if (balResult.success && balResult.balance !== null) {
          statusRecord = await prisma.smsServiceStatus.upsert({
            where: { id: "singleton" },
            update: {
              balance: balResult.balance,
              licenceDate: balResult.licenceDate || undefined,
              lastCheckedAt: new Date(),
              lastError: null,
              rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
            },
            create: {
              id: "singleton",
              balance: balResult.balance,
              licenceDate: balResult.licenceDate || undefined,
              lastCheckedAt: new Date(),
              lastSendStatus: "success",
              rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
            },
          });
        } else if (balResult.error) {
          statusRecord = await prisma.smsServiceStatus.upsert({
            where: { id: "singleton" },
            update: {
              lastCheckedAt: new Date(),
              lastError: balResult.error,
              rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
            },
            create: {
              id: "singleton",
              balance: null,
              lastCheckedAt: new Date(),
              lastError: balResult.error,
              rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
            },
          });
        }
      } catch (err: any) {
        console.error("[API sms/status] Erreur refresh manuel solde :", err);
      }
    }

    const balance = statusRecord?.balance ?? null;
    const licenceDate = statusRecord?.licenceDate ?? null;
    const lastCheckedAt = statusRecord?.lastCheckedAt ? new Date(statusRecord.lastCheckedAt) : null;
    const lastCheckedRelative = formatRelativeTime(lastCheckedAt);

    const daysUntilExpiry = parseDaysUntilExpiry(licenceDate);
    const licenceExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;

    const isLowBalance = balance !== null && balance <= lowBalanceThreshold;

    // Vérification de l'activité réelle sur les dernières 24 heures
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failed24hCount = await prisma.smsQueue.count({
      where: {
        status: { in: ["failed", "uncertain"] },
        createdAt: { gte: oneDayAgo },
      },
    });

    // Dernier SMS tenté dans les 24h
    const lastRecentSms = await prisma.smsQueue.findFirst({
      where: {
        createdAt: { gte: oneDayAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    const lastRecentFailed = await prisma.smsQueue.findFirst({
      where: {
        status: { in: ["failed", "uncertain"] },
        createdAt: { gte: oneDayAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    // Détermination dynamique de l'état du voyant
    let serviceState: "green" | "orange" | "red" = "green";
    let stateReason: string | null = null;

    const balanceError =
      config.isKeyUnreadable
        ? "Clé illisible : ressaisissez-la"
        : (!config.apiKey
        ? "Clé API non configurée"
        : (statusRecord?.lastError || "En attente de consultation"));

    if (lastRecentSms && (lastRecentSms.status === "failed" || lastRecentSms.status === "uncertain")) {
      // Le dernier envoi a échoué
      serviceState = "red";
      stateReason = lastRecentSms.failReason || "Le dernier SMS tenté a échoué";
    } else if (statusRecord?.lastSendStatus === "error" && (!lastRecentSms || lastRecentSms.status !== "sent")) {
      serviceState = "red";
      stateReason = statusRecord.lastError || "Erreur récente sur le service SMS";
    } else if (isLowBalance) {
      serviceState = "orange";
      stateReason = `Solde bas : ${balance} SMS restant(s) (seuil de ${lowBalanceThreshold})`;
    } else if (licenceExpiringSoon) {
      serviceState = "orange";
      stateReason = `Pack WinSMS expirant bientôt (${daysUntilExpiry} jour${daysUntilExpiry && daysUntilExpiry > 1 ? "s" : ""} restant${daysUntilExpiry && daysUntilExpiry > 1 ? "s" : ""})`;
    } else if (balance === null && config.mode === "winsms") {
      serviceState = "orange";
      stateReason = `Solde indisponible (${balanceError})`;
    }

    // Formatage français de la date de licence
    let formattedLicenceDate: string | null = null;
    if (licenceDate) {
      const parts = licenceDate.split("-");
      if (parts.length === 3) {
        formattedLicenceDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedLicenceDate = licenceDate;
      }
    }

    return NextResponse.json({
      success: true,
      serviceState, // "green" | "orange" | "red"
      stateReason,
      balance, // number | null
      balanceAvailable: balance !== null,
      balanceFormatted: balance !== null ? `${balance} SMS` : "Solde indisponible",
      balanceError: balance === null ? balanceError : null,
      isLowBalance,
      lowBalanceThreshold,
      licenceDate,
      licenceDateFormatted: formattedLicenceDate,
      licenceFormatted: formattedLicenceDate ? `Jusqu'au ${formattedLicenceDate}` : "Validité : indisponible",
      daysUntilExpiry,
      licenceExpiringSoon,
      lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
      lastCheckedRelative,
      lastSendStatus: statusRecord?.lastSendStatus || "success",
      lastError: statusRecord?.lastError || lastRecentFailed?.failReason || null,
      failed24hCount,
      provider: config.mode, // "winsms" | "mock"
      isConfigured: config.isConfigured,
      isKeyUnreadable: config.isKeyUnreadable,
      senderId: config.senderId,
    });
  } catch (error) {
    console.error("[API sms/status] Erreur :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Déclencher un rafraîchissement direct du solde
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  await migrateZeroBalanceToNull();

  try {
    const { provider, config } = await getEffectiveSmsProvider();
    if (config.mode === "mock") {
      const balResult = await provider.getBalance();
      return NextResponse.json({
        success: true,
        balance: balResult.balance,
        licenceDate: balResult.licenceDate,
      });
    }

    const balResult = await provider.getBalance();
    if (balResult.success && balResult.balance !== null) {
      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          balance: balResult.balance,
          licenceDate: balResult.licenceDate || undefined,
          lastCheckedAt: new Date(),
          lastError: null,
          rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
        },
        create: {
          id: "singleton",
          balance: balResult.balance,
          licenceDate: balResult.licenceDate || undefined,
          lastCheckedAt: new Date(),
          lastSendStatus: "success",
          rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
        },
      });

      return NextResponse.json({
        success: true,
        balance: balResult.balance,
        licenceDate: balResult.licenceDate,
      });
    } else {
      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          lastCheckedAt: new Date(),
          lastError: balResult.error || "Solde indisponible",
          rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
        },
        create: {
          id: "singleton",
          balance: null,
          lastCheckedAt: new Date(),
          lastError: balResult.error || "Solde indisponible",
          rawResponse: balResult.raw ? sanitizeApiKeyInString(JSON.stringify(balResult.raw)) : undefined,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: balResult.error || "Impossible d'obtenir le solde WinSMS",
          balance: null,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("[API sms/status POST] Erreur :", err);
    return NextResponse.json({ error: "Erreur lors du rafraîchissement" }, { status: 500 });
  }
}
