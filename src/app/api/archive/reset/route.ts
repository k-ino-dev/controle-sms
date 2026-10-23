import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { confirmationText, nextYearName } = body;

    if (confirmationText !== "ARCHIVER ET REINITIALISER") {
      return NextResponse.json(
        { error: 'Veuillez saisir exactement "ARCHIVER ET REINITIALISER" pour confirmer.' },
        { status: 400 }
      );
    }

    // 1. Sauvegarde automatique de sécurité avant réinitialisation
    const backupsDir = path.resolve(process.cwd(), "..", "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const dbPath = path.resolve(process.cwd(), "dev.db");
    const prismaDbPath = path.resolve(process.cwd(), "prisma", "dev.db");
    let sourcePath = dbPath;
    if (!fs.existsSync(dbPath) && fs.existsSync(prismaDbPath)) {
      sourcePath = prismaDbPath;
    }

    if (fs.existsSync(sourcePath)) {
      const backupTarget = path.join(
        backupsDir,
        `pre_reset_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.db`
      );
      fs.copyFileSync(sourcePath, backupTarget);
      console.log(`🛡️ Sauvegarde de sécurité créée : ${backupTarget}`);
    }

    // 2. Réinitialisation des tables élèves, classes, absences, paiements, sms
    // Dans une transaction pour garantir l'intégrité
    await prisma.$transaction(async (tx) => {
      await tx.absence.deleteMany();
      await tx.absenceSession.deleteMany();
      await tx.payment.deleteMany();
      await tx.smsQueue.deleteMany();
      await tx.enrollment.deleteMany();
      await tx.student.deleteMany();
      await tx.class.deleteMany();

      if (nextYearName && nextYearName.trim()) {
        await tx.setting.upsert({
          where: { key: "academic_year" },
          update: { value: nextYearName.trim() },
          create: { key: "academic_year", value: nextYearName.trim() },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Base réinitialisée avec succès pour la nouvelle année. Paramètres et tarifs conservés.",
    });
  } catch (error) {
    console.error("Erreur reset archive :", error);
    return NextResponse.json({ error: "Erreur lors de la réinitialisation" }, { status: 500 });
  }
}
