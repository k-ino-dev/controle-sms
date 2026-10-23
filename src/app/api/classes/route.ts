import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { classSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET: Liste des classes avec effectifs
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const classes = await prisma.class.findMany({
      include: {
        enrollments: {
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

    // Si aucun nom personnalisé n'est fourni, générer séquentiellement :
    // Ex: "1ère classe 1", "1ère classe 2", "2ème Lettres classe 1"
    if (!finalName) {
      const existingCount = await prisma.class.count({
        where: {
          level,
          section: section || null,
        },
      });

      const nextNum = existingCount + 1;
      const sectionPart = section ? `${section} ` : "";
      finalName = `${level} ${sectionPart}classe ${nextNum}`;
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
