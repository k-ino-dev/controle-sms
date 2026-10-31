import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { studentSchema, cleanTunisianPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET: Fiche élève complète avec onglets Infos, Absences et Paiements
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        enrollments: {
          include: {
            class: true,
          },
        },
        absences: {
          include: {
            session: {
              include: {
                class: true,
              },
            },
          },
          orderBy: {
            session: {
              date: "desc",
            },
          },
        },
        payments: {
          orderBy: {
            paidAt: "desc",
          },
        },
        smsLogs: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error("Erreur fiche élève :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT: Modifier un élève
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const effectiveSection = ["2ème", "3ème", "Bac"].includes(level) ? (section || null) : null;
    const cleanedPhone = cleanTunisianPhone(parentPhone);

    // Vérifier la compatibilité de classe si une affectation est demandée
    if (classId) {
      const targetClass = await prisma.class.findUnique({ where: { id: classId } });
      if (!targetClass) {
        return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
      }
      if (targetClass.level !== level || targetClass.section !== effectiveSection) {
        return NextResponse.json(
          { error: "Le niveau ou la section de l'élève ne correspond pas à cette classe" },
          { status: 400 }
        );
      }
    }

    // Mettre à jour l'élève
    const updated = await prisma.student.update({
      where: { id: params.id },
      data: {
        firstName,
        lastName,
        parentPhone: cleanedPhone,
        level,
        section: effectiveSection,
      },
    });

    // Mettre à jour l'inscription de classe si spécifiée
    if (classId !== undefined) {
      // Supprimer l'ancienne inscription
      await prisma.enrollment.deleteMany({
        where: { studentId: params.id },
      });

      if (classId) {
        await prisma.enrollment.create({
          data: {
            studentId: params.id,
            classId,
          },
        });
      }
    } else {
      // Si classId non spécifié mais que le niveau ou la section a changé,
      // vérifier et retirer de toute classe devenue incompatible
      const existingEnrollments = await prisma.enrollment.findMany({
        where: { studentId: params.id },
        include: { class: true },
      });
      for (const en of existingEnrollments) {
        if (en.class.level !== level || en.class.section !== effectiveSection) {
          await prisma.enrollment.delete({ where: { id: en.id } });
        }
      }
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error("Erreur modification élève :", error);
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 });
  }
}

// DELETE: Supprimer définitivement un élève
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    await prisma.student.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression élève :", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
