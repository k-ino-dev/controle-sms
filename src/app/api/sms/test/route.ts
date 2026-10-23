import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSmsProvider, normalizeTunisianPhone, calculateSmsSegments } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { phone, message } = await req.json();

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Veuillez fournir un numéro de téléphone valide." },
        { status: 400 }
      );
    }

    const normalized = normalizeTunisianPhone(phone);
    if (!normalized.valid) {
      return NextResponse.json(
        { error: normalized.error || "Numéro de téléphone invalide." },
        { status: 400 }
      );
    }

    const testMessage =
      message && message.trim()
        ? message.trim()
        : "رسالة تجريبية من معهد الامتياز الخاص. نظام المراقبة والإرسال WinSMS يعمل بنجاح.";

    // Sender ID
    const senderIdSetting = await prisma.setting.findUnique({
      where: { key: "winsms_sender_id" },
    });
    const senderId = senderIdSetting?.value || process.env.WINSMS_SENDER_ID || "ELIMTIAZ";

    const { segments } = calculateSmsSegments(testMessage);
    const provider = getSmsProvider();

    const result = await provider.send(normalized.normalized, testMessage, senderId);

    // Enregistrer dans la base de données pour l'historique
    await prisma.smsQueue.create({
      data: {
        parentPhone: normalized.normalized,
        message: testMessage,
        type: "test",
        status: result.success ? "sent" : "failed",
        sentAt: result.success ? new Date() : null,
        failReason: result.error || null,
        rawResponse: result.raw ? JSON.stringify(result.raw) : null,
        partsCount: segments,
        retryCount: 1,
      },
    });

    // Mettre à jour le solde
    let balance = 0;
    try {
      balance = await provider.getBalance();
      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          balance,
          lastCheckedAt: new Date(),
          lastSendStatus: result.success ? "success" : "error",
          lastError: result.error || null,
        },
        create: {
          id: "singleton",
          balance,
          lastCheckedAt: new Date(),
          lastSendStatus: result.success ? "success" : "error",
          lastError: result.error || null,
        },
      });
    } catch {
      // Ignorer
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Échec de l'envoi du SMS de test.",
          raw: result.raw,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "SMS de test envoyé avec succès !",
      phone: normalized.normalized,
      segments,
      balance,
    });
  } catch (error) {
    console.error("[API sms/test] Erreur :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
