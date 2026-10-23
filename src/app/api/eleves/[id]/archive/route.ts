import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const student = await prisma.student.findUnique({
      where: { id: params.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
    }

    const nextArchived = !student.isArchived;

    // Si on archive, on retire l'élève de sa classe actuelle pour libérer la classe,
    // mais on conserve l'historique de ses présences et paiements.
    if (nextArchived) {
      await prisma.enrollment.deleteMany({
        where: { studentId: params.id },
      });
    }

    const updated = await prisma.student.update({
      where: { id: params.id },
      data: { isArchived: nextArchived },
    });

    return NextResponse.json({
      success: true,
      isArchived: updated.isArchived,
      message: nextArchived
        ? "Élève archivé avec succès (sorti des classes, données conservées)"
        : "Élève restauré avec succès",
    });
  } catch (error) {
    console.error("Erreur archivage élève :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
