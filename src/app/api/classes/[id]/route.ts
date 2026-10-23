import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

// PUT: Modifier le nom d'une classe
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Le nom de la classe est requis" }, { status: 400 });
    }

    const updated = await prisma.class.update({
      where: { id: params.id },
      data: { name: name.trim() },
    });

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
