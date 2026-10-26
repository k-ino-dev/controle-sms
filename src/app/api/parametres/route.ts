import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DEFAULT_TEMPLATES } from "@/lib/sms/templates";

export const dynamic = "force-dynamic";

// GET: Récupérer tous les paramètres
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    // Tarifs par défaut
    const defaultTarifs = {
      "7ème": 100,
      "8ème": 100,
      "9ème": 100,
      "1ère": 105,
      "2ème": 105,
      "3ème": 110,
      "Bac": 180,
    };

    const pricesByLevel = settingsMap["prices_by_level"]
      ? JSON.parse(settingsMap["prices_by_level"])
      : defaultTarifs;

    let smsTemplateAbsence =
      settingsMap["sms_template_absence"] || DEFAULT_TEMPLATES.sms_template_absence;

    if (smsTemplateAbsence.includes("[HH:MM]")) {
      smsTemplateAbsence = smsTemplateAbsence.replaceAll("[HH:MM]", "[الساعة]");
      await prisma.setting.upsert({
        where: { key: "sms_template_absence" },
        update: { value: smsTemplateAbsence },
        create: { key: "sms_template_absence", value: smsTemplateAbsence },
      });
    }

    let smsTemplatePaymentOpt1 =
      settingsMap["sms_template_payment_opt1"] ||
      settingsMap["sms_template_payment"] ||
      DEFAULT_TEMPLATES.sms_template_payment_opt1;

    let smsTemplatePaymentOpt2 =
      settingsMap["sms_template_payment_opt2"] || DEFAULT_TEMPLATES.sms_template_payment_opt2;

    const oldOpt1 =
      "تذكير من معهد الامتياز: يرجى تسوية معلوم دراسة شهر [الشهر] الخاص بالتلميذ [الاسم واللقب] (المبلغ: [المبلغ] د.ت). شكراً لتفهمكم.";
    const oldOpt2 =
      "تنبيه هام من إدارة معهد الامتياز: نعلمكم أنه لم يتم تسوية معاليم دراسة التلميذ [الاسم واللقب] لشهر [الشهر]. يُرجى الاتصال بالإدارة فوراً تفادياً لتعليق الدروس.";

    if (smsTemplatePaymentOpt1 === oldOpt1) {
      smsTemplatePaymentOpt1 = DEFAULT_TEMPLATES.sms_template_payment_opt1;
      await prisma.setting.upsert({
        where: { key: "sms_template_payment_opt1" },
        update: { value: smsTemplatePaymentOpt1 },
        create: { key: "sms_template_payment_opt1", value: smsTemplatePaymentOpt1 },
      });
    }

    if (smsTemplatePaymentOpt2 === oldOpt2) {
      smsTemplatePaymentOpt2 = DEFAULT_TEMPLATES.sms_template_payment_opt2;
      await prisma.setting.upsert({
        where: { key: "sms_template_payment_opt2" },
        update: { value: smsTemplatePaymentOpt2 },
        create: { key: "sms_template_payment_opt2", value: smsTemplatePaymentOpt2 },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        school_name: settingsMap["school_name"] || "معهد الامتياز الخاص",
        school_name_fr: settingsMap["school_name_fr"] || "Institut Privé d'Excellence",
        school_phone: settingsMap["school_phone"] || "+216 71 888 999",
        school_address: settingsMap["school_address"] || "Avenue Habib Bourguiba, Tunis",
        school_logo: settingsMap["school_logo"] || "",
        prices_by_level: pricesByLevel,
        sms_template_absence: smsTemplateAbsence,
        sms_template_payment_opt1: smsTemplatePaymentOpt1,
        sms_template_payment_opt2: smsTemplatePaymentOpt2,
        winsms_sender_id:
          settingsMap["winsms_sender_id"] || process.env.WINSMS_SENDER_ID || "ELIMTIAZ",
        winsms_api_key:
          settingsMap["winsms_api_key"] || process.env.WINSMS_API_KEY || "",
        winsms_api_url:
          settingsMap["winsms_api_url"] || process.env.WINSMS_API_URL || "https://api.winsms.tn/v1",
        sms_low_balance_threshold: settingsMap["sms_low_balance_threshold"]
          ? parseInt(settingsMap["sms_low_balance_threshold"], 10)
          : 25,
        sms_delay_between_sends: settingsMap["sms_delay_between_sends"]
          ? parseInt(settingsMap["sms_delay_between_sends"], 10)
          : 1000,
        sms_daily_limit: settingsMap["sms_daily_limit"]
          ? parseInt(settingsMap["sms_daily_limit"], 10)
          : 500,
        academic_year: settingsMap["academic_year"] || "2026-2027",
      },
    });
  } catch (error) {
    console.error("Erreur lecture paramètres :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Enregistrer les paramètres
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();

    const allowedKeys = [
      "school_name",
      "school_name_fr",
      "school_phone",
      "school_address",
      "school_logo",
      "sms_template_absence",
      "sms_template_payment_opt1",
      "sms_template_payment_opt2",
      "winsms_sender_id",
      "winsms_api_key",
      "winsms_api_url",
      "sms_low_balance_threshold",
      "sms_delay_between_sends",
      "sms_daily_limit",
      "academic_year",
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        });
      }
    }

    // Tarifs par niveau
    if (body.prices_by_level && typeof body.prices_by_level === "object") {
      await prisma.setting.upsert({
        where: { key: "prices_by_level" },
        update: { value: JSON.stringify(body.prices_by_level) },
        create: { key: "prices_by_level", value: JSON.stringify(body.prices_by_level) },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Paramètres enregistrés avec succès",
    });
  } catch (error) {
    console.error("Erreur sauvegarde paramètres :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
