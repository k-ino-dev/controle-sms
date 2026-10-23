import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSmsProvider } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const statusRecord = await prisma.smsServiceStatus.findUnique({
      where: { id: "singleton" },
    });

    const lowBalanceThresholdSetting = await prisma.setting.findUnique({
      where: { key: "sms_low_balance_threshold" },
    });
    const lowBalanceThreshold = lowBalanceThresholdSetting ? parseInt(lowBalanceThresholdSetting.value, 10) : 25;

    // Si le solde n'a jamais été lu ou est ancien de plus de 5 minutes, le rafraîchir en direct
    let balance = statusRecord?.balance ?? 0;
    const shouldRefresh = !statusRecord || Date.now() - new Date(statusRecord.lastCheckedAt).getTime() > 300000;

    if (shouldRefresh) {
      try {
        const provider = getSmsProvider();
        balance = await provider.getBalance();
        await prisma.smsServiceStatus.upsert({
          where: { id: "singleton" },
          update: { balance, lastCheckedAt: new Date() },
          create: { id: "singleton", balance, lastCheckedAt: new Date() },
        });
      } catch (err) {
        console.error("[API sms/status] Erreur refresh solde :", err);
      }
    }

    const isLowBalance = balance <= lowBalanceThreshold;
    const lastSendStatus = statusRecord?.lastSendStatus || "success";

    // Calculer le statut global du service
    let serviceState: "green" | "orange" | "red" = "green";
    if (lastSendStatus === "error") {
      serviceState = "red";
    } else if (isLowBalance) {
      serviceState = "orange";
    }

    return NextResponse.json({
      success: true,
      serviceState, // "green" | "orange" | "red"
      balance,
      isLowBalance,
      lowBalanceThreshold,
      lastSendStatus,
      lastError: statusRecord?.lastError || null,
      provider: (process.env.SMS_PROVIDER || "mock").toLowerCase(),
    });
  } catch (error) {
    console.error("[API sms/status] Erreur :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
