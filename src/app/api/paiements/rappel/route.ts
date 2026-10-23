import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizeTunisianPhone, calculateSmsSegments, formatSmsMessage } from "@/lib/sms";
import { DEFAULT_TEMPLATES } from "@/lib/sms/templates";

export const dynamic = "force-dynamic";

// GET: Vérifie si un SMS de paiement a déjà été envoyé à cet élève aujourd'hui (anti-doublon)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    if (!studentId) {
      return NextResponse.json({ error: "studentId requis" }, { status: 400 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingSms = await prisma.smsQueue.findFirst({
      where: {
        studentId,
        type: { startsWith: "paiement" },
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingSms) {
      const timeStr = new Date(existingSms.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return NextResponse.json({
        sentToday: true,
        lastSentAt: timeStr,
        type: existingSms.type,
      });
    }

    return NextResponse.json({ sentToday: false, lastSentAt: null, type: null });
  } catch (error) {
    console.error("Erreur vérification doublon SMS paiement :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Envoie (met en file) un SMS de paiement avec Option 1 ou Option 2
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { studentId, option, month, amount } = body;

    if (!studentId || !option || (option !== 1 && option !== 2)) {
      return NextResponse.json(
        { error: "studentId et option (1 ou 2) requis." },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève introuvable." }, { status: 404 });
    }

    const norm = normalizeTunisianPhone(student.parentPhone);
    if (!norm.valid) {
      return NextResponse.json(
        { error: `Numéro du parent invalide (${student.parentPhone}) : ${norm.error}` },
        { status: 400 }
      );
    }

    // Récupérer le modèle configuré dans les Paramètres
    const settingKey = option === 1 ? "sms_template_payment_opt1" : "sms_template_payment_opt2";
    const templateSetting = await prisma.setting.findUnique({
      where: { key: settingKey },
    });

    const template =
      templateSetting?.value ||
      (option === 1
        ? DEFAULT_TEMPLATES.sms_template_payment_opt1
        : DEFAULT_TEMPLATES.sms_template_payment_opt2);

    const studentFullName = `${student.firstName} ${student.lastName}`;
    const selectedMonth = month || "أكتوبر";
    const dueAmount = amount !== undefined ? String(amount) : "105";

    const personalizedMsg = formatSmsMessage(template, {
      studentName: studentFullName,
      month: selectedMonth,
      amount: dueAmount,
    });

    const { segments, charCount } = calculateSmsSegments(personalizedMsg);
    const smsType = option === 1 ? "paiement - option 1" : "paiement - option 2";

    const sms = await prisma.smsQueue.create({
      data: {
        studentId: student.id,
        parentPhone: norm.normalized,
        message: personalizedMsg,
        partsCount: segments,
        type: smsType,
        status: "pending",
        retryCount: 0,
        nextRetryAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      sms,
      message: `SMS (${smsType}) mis en file d'attente pour le parent de ${studentFullName}`,
      segments,
      charCount,
    });
  } catch (error) {
    console.error("Erreur envoi SMS paiement :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
