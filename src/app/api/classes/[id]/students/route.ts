import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Liste des élèves éligibles (même niveau, même section, non archivés, non encore dans cette classe)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const classItem = await prisma.class.findUnique({
      where: { id: params.id },
      include: {
        enrollments: {
          select: { studentId: true },
        },
      },
    });

    if (!classItem) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }

    const alreadyEnrolledIds = classItem.enrollments.map((e) => e.studentId);

    const eligibleStudents = await prisma.student.findMany({
      where: {
        level: classItem.level,
        section: classItem.section || null,
        isArchived: false,
        id: { notIn: alreadyEnrolledIds },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({ success: true, students: eligibleStudents });
  } catch (error) {
    console.error("Erreur élèves éligibles :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Ajouter un élève dans la classe
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId requis" }, { status: 400 });
    }

    // Vérifier la cohérence de niveau
    const classItem = await prisma.class.findUnique({ where: { id: params.id } });
    const student = await prisma.student.findUnique({ where: { id: studentId } });

    if (!classItem || !student) {
      return NextResponse.json({ error: "Classe ou élève introuvable" }, { status: 404 });
    }

    if (student.level !== classItem.level || student.section !== classItem.section) {
      return NextResponse.json(
        { error: "Le niveau ou la section de l'élève ne correspond pas à cette classe" },
        { status: 400 }
      );
    }

    // Retirer de toute classe existante préalable (un élève ne peut être que dans une classe)
    await prisma.enrollment.deleteMany({
      where: { studentId },
    });

    const enrollment = await prisma.enrollment.create({
      data: {
        classId: params.id,
        studentId,
      },
      include: {
        student: true,
      },
    });

    return NextResponse.json({ success: true, enrollment });
  } catch (error) {
    console.error("Erreur affectation élève :", error);
    return NextResponse.json({ error: "Erreur affectation" }, { status: 500 });
  }
}

// DELETE: Retirer un élève de la classe
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId requis" }, { status: 400 });
    }

    await prisma.enrollment.deleteMany({
      where: {
        classId: params.id,
        studentId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur retrait élève :", error);
    return NextResponse.json({ error: "Erreur retrait" }, { status: 500 });
  }
}
