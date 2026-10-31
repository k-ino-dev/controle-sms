import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  levelHasSection,
  isValidSection,
  resolveClassRenameOnSectionChange,
} from "@/lib/sections";

export const dynamic = "force-dynamic";

// GET: Détails d'une classe et élèves inscrits
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
          include: {
            student: true,
          },
          orderBy: {
            student: {
              lastName: "asc",
            },
          },
        },
      },
    });

    if (!classItem) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true, class: classItem });
  } catch (error) {
    console.error("Erreur détails classe :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT: Modifier une classe (nom, niveau, section avec régénération du nom automatique)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const existingClass = await prisma.class.findUnique({
      where: { id: params.id },
      include: {
        enrollments: true,
      },
    });

    if (!existingClass) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }

    const body = await req.json();

    const targetLevel = body.level !== undefined ? body.level : existingClass.level;
    const targetSection = body.section !== undefined ? (body.section || null) : existingClass.section;

    // Validation du niveau et de la section
    const hasSection = levelHasSection(targetLevel);
    if (hasSection) {
      if (!targetSection) {
        return NextResponse.json(
          { error: "La section est obligatoire pour la 2ème, 3ème et le Bac (choix : Informatique, Lettres, Économie)" },
          { status: 400 }
        );
      }
      if (!isValidSection(targetSection)) {
        return NextResponse.json(
          { error: "Section invalide. Les sections autorisées sont : Informatique, Lettres et Économie." },
          { status: 400 }
        );
      }
    } else {
      if (targetSection) {
        return NextResponse.json(
          { error: "Les sections ne sont pas autorisées pour les niveaux 7ème, 8ème, 9ème et 1ère." },
          { status: 400 }
        );
      }
    }

    // Détermination du nom de la classe
    let finalName = existingClass.name;

    if (body.name && body.name.trim() && body.name.trim() !== existingClass.name) {
      // Le directeur a fourni un nom personnalisé explicite
      finalName = body.name.trim();
    } else if (targetSection !== existingClass.section || targetLevel !== existingClass.level) {
      // La section ou le niveau a changé : régénérer automatiquement si non personnalisé
      const existingTargetClasses = await prisma.class.findMany({
        where: {
          level: targetLevel,
          section: targetSection || null,
          id: { not: params.id },
        },
        select: { name: true },
      });

      finalName = resolveClassRenameOnSectionChange(
        existingClass.name,
        existingClass.level,
        existingClass.section,
        targetLevel,
        targetSection,
        existingTargetClasses.map((c) => c.name)
      );
    } else if (body.name !== undefined && body.name.trim()) {
      finalName = body.name.trim();
    }

    // Mettre à jour la classe
    const updated = await prisma.class.update({
      where: { id: params.id },
      data: {
        name: finalName,
        level: targetLevel,
        section: targetSection,
      },
      include: {
        enrollments: {
          include: { student: true },
        },
      },
    });

    // Si la section a changé et qu'il y a des élèves inscrits, synchroniser leur section
    if (
      body.updateStudents !== false &&
      targetSection !== existingClass.section &&
      existingClass.enrollments.length > 0
    ) {
      const studentIds = existingClass.enrollments.map((e) => e.studentId);
      await prisma.student.updateMany({
        where: { id: { in: studentIds } },
        data: { section: targetSection },
      });
    }

    return NextResponse.json({ success: true, class: updated });
  } catch (error) {
    console.error("Erreur modification classe :", error);
    return NextResponse.json({ error: "Erreur modification" }, { status: 500 });
  }
}

// DELETE: Supprimer une classe
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    await prisma.class.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression classe :", error);
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 });
  }
}
