import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  SECTIONS,
  isValidSection,
  resolveClassRenameOnSectionChange,
  Section,
} from "@/lib/sections";

export const dynamic = "force-dynamic";

/**
 * GET: Récupère la liste et le décompte des élèves et classes ayant l'ancienne section "Sciences"
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const legacyClasses = await prisma.class.findMany({
      where: { section: "Sciences" },
      include: {
        enrollments: {
          include: { student: true },
        },
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    const legacyStudents = await prisma.student.findMany({
      where: { section: "Sciences" },
      include: {
        enrollments: {
          include: { class: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({
      success: true,
      hasLegacy: legacyClasses.length > 0 || legacyStudents.length > 0,
      classesCount: legacyClasses.length,
      studentsCount: legacyStudents.length,
      classes: legacyClasses,
      students: legacyStudents,
    });
  } catch (error) {
    console.error("Erreur récupération éléments Sciences :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST: Met à jour la section des classes et/ou élèves Sciences vers une nouvelle section autorisée
 * (Informatique, Lettres, Économie) de façon globale ou sélective, avec régénération automatique
 * des noms de classes si non personnalisés.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { targetSection, mode = "all", studentIds, classIds } = body;

    if (!targetSection || !isValidSection(targetSection)) {
      return NextResponse.json(
        {
          error: `Section cible invalide. Les sections autorisées sont : ${SECTIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const safeTargetSection = targetSection as Section;
    const isAll = mode === "all";

    // 1. Récupération des classes à mettre à jour
    const classesToUpdate = await prisma.class.findMany({
      where: isAll
        ? { section: "Sciences" }
        : {
            id: { in: Array.isArray(classIds) ? classIds : [] },
            section: "Sciences",
          },
    });

    const updatedClassesLog: Array<{ id: string; oldName: string; newName: string }> = [];

    // Mettre à jour chaque classe avec régénération séquentielle si nécessaire
    for (const cls of classesToUpdate) {
      // Récupérer les classes déjà existantes pour ce niveau et cette section cible (hors classe courante)
      const existingInTarget = await prisma.class.findMany({
        where: {
          level: cls.level,
          section: safeTargetSection,
          id: { not: cls.id },
        },
        select: { name: true },
      });

      const newClassName = resolveClassRenameOnSectionChange(
        cls.name,
        cls.level,
        cls.section,
        cls.level,
        safeTargetSection,
        existingInTarget.map((c) => c.name)
      );

      await prisma.class.update({
        where: { id: cls.id },
        data: {
          section: safeTargetSection,
          name: newClassName,
        },
      });

      updatedClassesLog.push({
        id: cls.id,
        oldName: cls.name,
        newName: newClassName,
      });
    }

    // 2. Récupération des élèves à mettre à jour
    const studentsWhere: any = isAll
      ? { section: "Sciences" }
      : {
          id: { in: Array.isArray(studentIds) ? studentIds : [] },
          section: "Sciences",
        };

    const updateStudentsResult = await prisma.student.updateMany({
      where: studentsWhere,
      data: {
        section: safeTargetSection,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Mise à jour réussie : ${updateStudentsResult.count} élève(s) et ${classesToUpdate.length} classe(s) mis à jour vers "${safeTargetSection}".`,
      updatedStudentsCount: updateStudentsResult.count,
      updatedClassesCount: classesToUpdate.length,
      updatedClasses: updatedClassesLog,
      targetSection: safeTargetSection,
    });
  } catch (error) {
    console.error("Erreur migration section Sciences :", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour des sections" }, { status: 500 });
  }
}
