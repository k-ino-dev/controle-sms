import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { studentSchema, cleanTunisianPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET: Liste des élèves filtrable et recherchable
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const level = searchParams.get("level") || "";
    const section = searchParams.get("section") || "";
    const archived = searchParams.get("archived") === "true";

    const whereClause: any = {
      isArchived: archived,
    };

    if (level) {
      whereClause.level = level;
    }

    if (section) {
      whereClause.section = section;
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { parentPhone: { contains: search } },
        {
          enrollments: {
            some: {
              class: {
                name: { contains: search },
              },
            },
          },
        },
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
        absences: {
          select: { id: true },
        },
        payments: {
          select: { amount: true, dueAmount: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({ success: true, students });
  } catch (error) {
    console.error("Erreur récupération élèves :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Ajouter un élève
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = studentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { firstName, lastName, parentPhone, level, section, classId } = parsed.data;
    const cleanedPhone = cleanTunisianPhone(parentPhone);

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        parentPhone: cleanedPhone,
        level,
        section: section || null,
        ...(classId
          ? {
              enrollments: {
                create: {
                  classId,
                },
              },
            }
          : {}),
      },
      include: {
        enrollments: {
          include: {
            class: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error("Erreur création élève :", error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}
