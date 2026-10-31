import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { classSchema } from "@/lib/validation";
import { generateDefaultClassName, getNextAvailableClassNumber } from "@/lib/sections";

export const dynamic = "force-dynamic";

// GET: Liste des classes avec effectifs
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "";
    const section = searchParams.get("section") || "";

    const whereClause: any = {};
    if (level) whereClause.level = level;
    if (section) {
      if (section === "needs_update" || section === "Sciences") {
        whereClause.section = "Sciences";
      } else {
        whereClause.section = section;
      }
    }

    const classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        enrollments: {
          where: {
            student: {
              isArchived: false,
            },
          },
          include: {
            student: true,
          },
        },
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, classes });
  } catch (error) {
    console.error("Erreur récupération classes :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Ajouter une classe avec nom séquentiel automatique
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = classSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { level, section, name } = parsed.data;

    let finalName = name?.trim();

    // Si aucun nom personnalisé n'est fourni, générer séquentiellement par combinaison niveau + section :
    // Ex: "1ère classe 1", "2ème Économie classe 1", "Bac Informatique classe 2"
    if (!finalName) {
      const existingClasses = await prisma.class.findMany({
        where: {
          level,
          section: section || null,
        },
        select: { name: true },
      });

      const nextNum = getNextAvailableClassNumber(
        existingClasses.map((c) => c.name),
        level,
        section
      );
      finalName = generateDefaultClassName(level, section, nextNum);
    }

    const newClass = await prisma.class.create({
      data: {
        name: finalName,
        level,
        section: section || null,
      },
    });

    return NextResponse.json({ success: true, class: newClass });
  } catch (error) {
    console.error("Erreur création classe :", error);
    return NextResponse.json({ error: "Erreur lors de la création de la classe" }, { status: 500 });
  }
}
