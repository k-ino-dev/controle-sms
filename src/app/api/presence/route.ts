import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { absenceSubmissionSchema } from "@/lib/validation";
import {
  normalizeTunisianPhone,
  calculateSmsSegments,
  formatSmsMessage,
  formatTunisHourFloor,
  getTunisTimeHHMM,
  DEFAULT_TEMPLATES,
} from "@/lib/sms";
import { triggerSmsWorker } from "@/lib/sms/worker";

export const dynamic = "force-dynamic";

// GET: Historique récent des contrôles d'absence
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const sessions = await prisma.absenceSession.findMany({
      include: {
        class: true,
        absences: {
          include: {
            student: true,
          },
        },
      },
      orderBy: { date: "desc" },
      take: 30,
    });

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error("Erreur historique présence :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Enregistrer un contrôle d'absence avec idempotence et génération de SMS
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = absenceSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { classId, idempotencyKey, recordedAtTime, absentStudentIds } = parsed.data;

    // 1. Protection Idempotence : si cette requête a déjà été traitée, ne pas doubler les SMS
    const existingSession = await prisma.absenceSession.findUnique({
      where: { idempotencyKey },
      include: {
        absences: {
          include: { student: true },
        },
      },
    });

    if (existingSession) {
      return NextResponse.json({
        success: true,
        session: existingSession,
        message: "Contrôle déjà enregistré (idempotence respectée)",
        smsQueued: 0,
      });
    }

    // 2. Récupérer le modèle de SMS dans les paramètres avec migration automatique [HH:MM] -> [الساعة]
    const templateSetting = await prisma.setting.findUnique({
      where: { key: "sms_template_absence" },
    });
    let template =
      templateSetting?.value ||
      DEFAULT_TEMPLATES.sms_template_absence;

    // Migration transparente si l'ancien tag [HH:MM] est encore présent
    if (template.includes("[HH:MM]")) {
      template = template.replaceAll("[HH:MM]", "[الساعة]");
      await prisma.setting.upsert({
        where: { key: "sms_template_absence" },
        update: { value: template },
        create: { key: "sms_template_absence", value: template },
      });
    }

    // 3. Récupérer les informations des élèves absents
    const absentStudents = await prisma.student.findMany({
      where: {
        id: { in: absentStudentIds },
        isArchived: false,
      },
    });

    // 4. Créer la session et les enregistrements d'absence dans une transaction
    // Conserver l'heure EXACTE (avec minutes) en base
    const sessionDate = new Date();
    const exactRecordedTime = recordedAtTime || getTunisTimeHHMM(sessionDate);

    const newSession = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.absenceSession.create({
        data: {
          classId,
          idempotencyKey,
          recordedAtTime: exactRecordedTime,
          date: sessionDate,
        },
      });

      const smsQueueItems = [];

      for (const student of absentStudents) {
        // Enregistrer l'absence
        await tx.absence.create({
          data: {
            sessionId: createdSession.id,
            studentId: student.id,
            smsSent: true,
          },
        });

        // Construire le message arabe personnalisé :
        // L'heure n'affiche que l'HEURE, sans minutes, arrondie vers le BAS (ex: "8h", "13h", "0h")
        // en fuseau Africa/Tunis, sans affecter l'heure exacte conservée en base
        const studentFullName = `${student.firstName} ${student.lastName}`;
        const personalizedMsg = formatSmsMessage(template, {
          studentName: studentFullName,
          time: exactRecordedTime,
        });

        const { segments } = calculateSmsSegments(personalizedMsg);
        const norm = normalizeTunisianPhone(student.parentPhone);

        smsQueueItems.push({
          studentId: student.id,
          parentPhone: norm.normalized || student.parentPhone,
          message: personalizedMsg,
          partsCount: segments,
          type: "absence",
          status: "pending",
          retryCount: 0,
        });
      }

      // Insérer dans la file d'attente SMS
      if (smsQueueItems.length > 0) {
        await tx.smsQueue.createMany({
          data: smsQueueItems,
        });
      }

      return createdSession;
    });

    // Réveil immédiat du worker pour que le parent reçoive le SMS dans les 10 secondes
    if (absentStudents.length > 0) {
      try {
        triggerSmsWorker();
      } catch (err) {
        console.error("Erreur déclenchement immédiat worker :", err);
      }
    }

    return NextResponse.json({
      success: true,
      session: newSession,
      smsQueued: absentStudents.length,
      message: `Contrôle enregistré avec succès. ${absentStudents.length} SMS mis en file d'attente.`,
    });
  } catch (error) {
    console.error("Erreur enregistrement contrôle :", error);
    return NextResponse.json({ error: "Erreur serveur lors de l'enregistrement" }, { status: 500 });
  }
}
