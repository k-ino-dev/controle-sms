import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { paymentSchema, schoolMonths } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET: Liste consolidée des paiements par élève avec la grille des 9 mois
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const classId = searchParams.get("classId") || "";
    const level = searchParams.get("level") || "";
    const section = searchParams.get("section") || "";

    // Récupérer les tarifs par niveau
    const tarifsSetting = await prisma.setting.findUnique({
      where: { key: "prices_by_level" },
    });
    const defaultTarifs: Record<string, number> = {
      "7ème": 100,
      "8ème": 100,
      "9ème": 100,
      "1ère": 105,
      "2ème": 105,
      "3ème": 110,
      "Bac": 180,
    };
    const tarifs = tarifsSetting ? JSON.parse(tarifsSetting.value) : defaultTarifs;

    const whereClause: any = {
      isArchived: false,
    };

    if (level) whereClause.level = level;
    if (section) whereClause.section = section;
    if (classId) {
      whereClause.enrollments = {
        some: { classId },
      };
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { parentPhone: { contains: search } },
      ];
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        enrollments: {
          include: {
            class: true,
          },
        },
        payments: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Formater la réponse pour chaque élève avec la grille des 9 mois
    const formatted = students.map((s) => {
      const monthlyTarif = tarifs[s.level] || 100;
      const annualTotal = monthlyTarif * 9;

      let totalPaid = 0;
      const monthsStatus: Record<string, { status: "paid" | "partial" | "unpaid"; paidAmount: number; dueAmount: number; date?: Date; notes?: string | null; paymentId?: string }> = {};

      schoolMonths.forEach((m) => {
        const p = s.payments.find((pm) => pm.month === m);
        if (!p || p.amount === 0) {
          monthsStatus[m] = {
            status: "unpaid",
            paidAmount: 0,
            dueAmount: monthlyTarif,
          };
        } else if (p.amount >= monthlyTarif) {
          totalPaid += p.amount;
          monthsStatus[m] = {
            status: "paid",
            paidAmount: p.amount,
            dueAmount: monthlyTarif,
            date: p.paidAt,
            notes: p.notes,
            paymentId: p.id,
          };
        } else {
          totalPaid += p.amount;
          monthsStatus[m] = {
            status: "partial",
            paidAmount: p.amount,
            dueAmount: monthlyTarif,
            date: p.paidAt,
            notes: p.notes,
            paymentId: p.id,
          };
        }
      });

      const remaining = Math.max(0, annualTotal - totalPaid);

      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        parentPhone: s.parentPhone,
        level: s.level,
        section: s.section,
        className: s.enrollments[0]?.class?.name || "Non affecté",
        classId: s.enrollments[0]?.classId,
        monthlyTarif,
        annualTotal,
        totalPaid,
        remaining,
        months: monthsStatus,
      };
    });

    return NextResponse.json({ success: true, students: formatted, tarifs });
  } catch (error) {
    console.error("Erreur paiements :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Enregistrer ou mettre à jour un paiement
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { studentId, month, amount, notes } = parsed.data;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
    }

    // Récupérer le tarif dû pour ce niveau
    const tarifsSetting = await prisma.setting.findUnique({
      where: { key: "prices_by_level" },
    });
    const defaultTarifs: Record<string, number> = {
      "7ème": 100,
      "8ème": 100,
      "9ème": 100,
      "1ère": 105,
      "2ème": 105,
      "3ème": 110,
      "Bac": 180,
    };
    const tarifs = tarifsSetting ? JSON.parse(tarifsSetting.value) : defaultTarifs;
    const dueAmount = tarifs[student.level] || 100;

    const payment = await prisma.payment.upsert({
      where: {
        studentId_month: {
          studentId,
          month,
        },
      },
      update: {
        amount,
        dueAmount,
        notes: notes || null,
        paidAt: new Date(),
      },
      create: {
        studentId,
        month,
        amount,
        dueAmount,
        notes: notes || null,
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      payment,
      isFullyPaid: amount >= dueAmount,
      remainingForMonth: Math.max(0, dueAmount - amount),
    });
  } catch (error) {
    console.error("Erreur enregistrement paiement :", error);
    return NextResponse.json({ error: "Erreur enregistrement" }, { status: 500 });
  }
}
