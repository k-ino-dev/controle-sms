import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const targetSms = await prisma.smsQueue.findUnique({
      where: { id: params.id },
    });

    if (!targetSms) {
      return NextResponse.json({ error: "SMS introuvable" }, { status: 404 });
    }

    if (targetSms.status === "sent") {
      return NextResponse.json(
        { error: "Ce SMS a déjà été envoyé avec succès." },
        { status: 400 }
      );
    }

    // Anti-doublon : vérifier qu'un même SMS n'a pas déjà été marqué sent
    const alreadySent = await prisma.smsQueue.findFirst({
      where: {
        id: { not: targetSms.id },
        parentPhone: targetSms.parentPhone,
        message: targetSms.message,
        studentId: targetSms.studentId,
        status: "sent",
      },
    });

    if (alreadySent) {
      return NextResponse.json(
        {
          error: `Doublon détecté : un SMS identique a déjà été envoyé avec succès à ce parent (Réf : ${alreadySent.providerRef || "N/A"}). Renvoi annulé.`,
        },
        { status: 409 }
      );
    }

    // Remettre en file d'attente pour expédition
    const updated = await prisma.smsQueue.update({
      where: { id: params.id },
      data: {
        status: "pending",
        retryCount: 0,
        nextRetryAt: new Date(),
        failReason: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "SMS remis en file d'attente pour réexpédition",
      sms: updated,
    });
  } catch (error) {
    console.error("Erreur réexpédition SMS :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
