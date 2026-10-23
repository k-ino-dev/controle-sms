import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const dbPath = path.resolve(process.cwd(), "dev.db");
    const prismaDbPath = path.resolve(process.cwd(), "prisma", "dev.db");

    let sourcePath = dbPath;
    if (!fs.existsSync(dbPath) && fs.existsSync(prismaDbPath)) {
      sourcePath = prismaDbPath;
    }

    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({ error: "Fichier de base de données introuvable" }, { status: 404 });
    }

    const yearSetting = await prisma.setting.findUnique({ where: { key: "academic_year" } });
    const year = yearSetting?.value || "2026-2027";
    const filename = `ecole_${year}_export_${new Date().toISOString().slice(0, 10)}.db`;

    const fileBuffer = fs.readFileSync(sourcePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Erreur export archive :", error);
    return NextResponse.json({ error: "Erreur lors de l'export" }, { status: 500 });
  }
}
