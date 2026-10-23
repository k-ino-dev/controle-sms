import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier dépasse la taille maximale autorisée (5 Mo)" },
        { status: 400 }
      );
    }

    const rawExt = path.extname(file.name || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(rawExt)) {
      return NextResponse.json(
        { error: "Format non autorisé. Formats acceptés : PNG, JPG, WEBP, SVG" },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Type MIME non autorisé" },
        { status: 400 }
      );
    }

    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Nom de fichier unique et sécurisé
    const safeFilename = `logo_${Date.now()}_${Math.random().toString(36).substring(7)}${rawExt}`;
    const destinationPath = path.join(uploadsDir, safeFilename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destinationPath, buffer);

    const publicUrl = `/api/uploads/${safeFilename}`;

    // Mise à jour automatique du paramètre logo en base
    await prisma.setting.upsert({
      where: { key: "school_logo" },
      update: { value: publicUrl },
      create: { key: "school_logo", value: publicUrl },
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: safeFilename,
      message: "Logo téléversé et enregistré avec succès",
    });
  } catch (error) {
    console.error("Erreur téléversement logo :", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'enregistrement du fichier" },
      { status: 500 }
    );
  }
}
