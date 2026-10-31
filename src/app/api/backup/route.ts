import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

function getBackupsDirectory(): string {
  if (process.env.BACKUPS_DIR && fs.existsSync(process.env.BACKUPS_DIR)) {
    return process.env.BACKUPS_DIR;
  }
  const inData = path.resolve(process.cwd(), "data", "backups");
  if (!fs.existsSync(inData)) {
    try {
      fs.mkdirSync(inData, { recursive: true });
    } catch {
      // Ignore
    }
  }
  return inData;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Ko";
  const k = 1024;
  const sizes = ["Octets", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
}

function getLatestBackupInfo() {
  const dir = getBackupsDirectory();
  if (!fs.existsSync(dir)) {
    return { latest: null, count: 0, isOver48h: true };
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("ecole_backup_") && f.endsWith(".db"))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        mtime: stat.mtime,
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) {
    return { latest: null, count: 0, isOver48h: true };
  }

  const latest = files[0];
  const ageHours = (Date.now() - latest.mtime.getTime()) / (1000 * 60 * 60);
  const isOver48h = ageHours > 48;

  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Tunis",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    latest: {
      name: latest.name,
      sizeBytes: latest.sizeBytes,
      sizeFormatted: latest.sizeFormatted,
      mtime: latest.mtime.toISOString(),
      formattedDate: formatter.format(latest.mtime),
      relativeTime: formatRelativeTime(latest.mtime),
    },
    count: files.length,
    isOver48h,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const info = getLatestBackupInfo();
    return NextResponse.json({
      success: true,
      ...info,
    });
  } catch (error) {
    console.error("[API backup GET] Erreur :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const scriptPath = path.resolve(process.cwd(), "scripts", "backup.sh");
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: "Script de sauvegarde scripts/backup.sh introuvable" },
        { status: 500 }
      );
    }

    // Exécution du script POSIX de sauvegarde avec sh
    const env = {
      ...process.env,
      BACKUPS_DIR: getBackupsDirectory(),
    };

    const { stdout, stderr } = await execFileAsync("sh", [scriptPath], {
      env,
      cwd: process.cwd(),
      timeout: 30000,
    });

    console.log("[API backup POST] Résultat backup.sh :", stdout);
    if (stderr) {
      console.warn("[API backup POST] Warning backup.sh :", stderr);
    }

    const info = getLatestBackupInfo();

    return NextResponse.json({
      success: true,
      message: "Sauvegarde créée avec succès et intégrité vérifiée.",
      ...info,
    });
  } catch (error: any) {
    console.error("[API backup POST] Erreur lors de l'exécution du backup :", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la sauvegarde : " + (error.message || String(error)),
      },
      { status: 500 }
    );
  }
}
