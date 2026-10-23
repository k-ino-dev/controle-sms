import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
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
