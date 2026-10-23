import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { file: string } }
) {
  try {
    const rawFilename = params.file;

    // 1. Validation de sécurité : pas de path traversal, pas de chemin relatif ou absolu
    if (
      !rawFilename ||
      rawFilename.includes("..") ||
      rawFilename.includes("/") ||
      rawFilename.includes("\\") ||
      rawFilename.includes("%")
    ) {
      return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
    }

    // 2. Validation stricte du format et des extensions autorisées
    const safeRegex = /^[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|webp|svg)$/i;
    if (!safeRegex.test(rawFilename)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Formats acceptés : png, jpg, jpeg, webp, svg" },
        { status: 400 }
      );
    }

    const ext = path.extname(rawFilename).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    // 3. Résolution du chemin absolu sur le volume monté
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
    const filePath = path.join(uploadsDir, rawFilename);

    // Vérification supplémentaire anti-évasion de répertoire
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Erreur lecture upload :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
