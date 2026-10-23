import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Historique des SMS avec filtres
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const search = searchParams.get("search")?.trim() || "";
    const dateStr = searchParams.get("date") || ""; // YYYY-MM-DD

    const whereClause: any = {};

    if (status) whereClause.status = status;
    if (type) whereClause.type = { contains: type };

    if (search) {
      whereClause.OR = [
        { parentPhone: { contains: search } },
        { message: { contains: search } },
        {
          student: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          },
        },
      ];
    }

    if (dateStr) {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const logs = await prisma.smsQueue.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            level: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Statistiques rapides pour le haut de page
    const totalCount = await prisma.smsQueue.count();
    const sentCount = await prisma.smsQueue.count({ where: { status: "sent" } });
    const pendingCount = await prisma.smsQueue.count({ where: { status: "pending" } });
    const failedCount = await prisma.smsQueue.count({ where: { status: "failed" } });

    return NextResponse.json({
      success: true,
      logs,
      stats: { totalCount, sentCount, pendingCount, failedCount },
    });
  } catch (error) {
    console.error("Erreur historique SMS :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
