import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cleanTunisianPhone, tunisianPhoneRegex } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !tunisianPhoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "Numéro de téléphone tunisien invalide (ex: 98123456 ou +21698123456)" },
        { status: 400 }
      );
    }

    const testMsg = message?.trim() || "رسالة تجريبية من منظومة المعهد: المودم يعمل بنجاح";
    const cleanedPhone = cleanTunisianPhone(phone);
    const charCount = testMsg.length;
    const partsCount = charCount <= 70 ? 1 : Math.ceil(charCount / 67);

    const sms = await prisma.smsQueue.create({
      data: {
        parentPhone: cleanedPhone,
        message: testMsg,
        partsCount,
        type: "test",
        status: "pending",
        retryCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: `SMS de test envoyé vers la file d'attente pour le numéro ${cleanedPhone}`,
      sms,
    });
  } catch (error) {
    console.error("Erreur test SMS :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
