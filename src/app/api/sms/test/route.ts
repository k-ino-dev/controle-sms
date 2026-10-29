import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveSmsProvider, normalizeTunisianPhone, calculateSmsSegments } from "@/lib/sms";
import { sanitizeApiKeyInString } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Vérification stricte des droits : seul le directeur authentifié peut tester la connexion
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
        { error: normalized.error || "Numéro de téléphone invalide (8 chiffres attendus)." },
        { status: 400 }
      );
    }

    // Message par défaut en arabe officiel
    const testMessage =
      message && message.trim()
        ? message.trim()
        : "رسالة اختبارية من معهد الامتياز - خدمة الرسائل القصيرة تعمل بنجاح";

    // Résolution du fournisseur selon l'ordre de priorité (Base > Env > Simulation)
    const { provider, config } = await getEffectiveSmsProvider();
    const senderId = config.senderId || "Lyc.Emtiyez";

    const { segments } = calculateSmsSegments(testMessage);

    // Envoi via le provider
    const result = await provider.send(normalized.normalized, testMessage, senderId);

    // Masquage absolu de la clé API pour l'historique en base
    const sanitizedRaw = result.raw
      ? sanitizeApiKeyInString(JSON.stringify(result.raw))
      : null;

    // Statut en base : "sent", "uncertain" ou "failed"
    const queueStatus = result.success ? "sent" : result.isUncertain ? "uncertain" : "failed";

    // Enregistrement dans l'historique
    await prisma.smsQueue.create({
      data: {
        parentPhone: normalized.normalized,
        message: testMessage,
        type: "test",
        status: queueStatus,
        sentAt: result.success ? new Date() : null,
        providerRef: result.reference || null,
        failReason: result.error || null,
        rawResponse: sanitizedRaw,
        partsCount: segments,
        retryCount: 1,
      },
    });

    // Mise à jour immédiate du solde affiché si retourné par WinSMS
    if (result.success && typeof result.balance === "number") {
      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          balance: result.balance,
          lastCheckedAt: new Date(),
          lastSendStatus: "success",
          lastError: null,
        },
        create: {
          id: "singleton",
          balance: result.balance,
          lastCheckedAt: new Date(),
          lastSendStatus: "success",
        },
      });
    } else if (!result.success) {
      await prisma.smsServiceStatus.upsert({
        where: { id: "singleton" },
        update: {
          lastSendStatus: "error",
          lastError: result.error || null,
        },
        create: {
          id: "singleton",
          lastSendStatus: "error",
          lastError: result.error || null,
        },
      });
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Échec de l'envoi du SMS de test.",
          rawCode: result.rawCode,
          rawMessage: result.rawMessage,
          mode: config.mode,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "SMS de test envoyé avec succès !",
      phone: normalized.normalized,
      segments,
      balance: result.balance,
      providerRef: result.reference,
      rawCode: result.rawCode,
      rawMessage: result.rawMessage,
      mode: config.mode,
      senderId,
    });
  } catch (error) {
    console.error("[API sms/test] Erreur :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
