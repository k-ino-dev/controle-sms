import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Début du peuplement de la base de données (Seed)...");

  // 1. Compte Directeur - Idempotent : Ne JAMAIS écraser un compte ou mot de passe déjà existant
  const existingDirector = await prisma.user.findFirst();

  if (!existingDirector) {
    const username = process.env.INITIAL_DIRECTOR_USERNAME || "directeur";
    const password = process.env.INITIAL_DIRECTOR_PASSWORD || "Admin1234!";
    const passwordHash = await bcrypt.hash(password, 10);

    const director = await prisma.user.create({
      data: {
        username,
        name: "Directeur de l'Établissement",
        passwordHash,
      },
    });
    console.log(`👤 Utilisateur directeur créé : ${director.username}`);
  } else {
    console.log(`👤 Compte directeur déjà configuré (${existingDirector.username}) : mot de passe préservé.`);
  }

  // 2. Paramètres généraux de l'école - Idempotent : Ne crée QUE les paramètres absents
  const defaultTarifs = {
    "7ème": 100,
    "8ème": 100,
    "9ème": 100,
    "1ère": 105,
    "2ème": 105,
    "3ème": 110,
    "Bac": 180,
  };

  const settingsToCreate = [
    { key: "school_name", value: "معهد الامتياز الخاص" },
    { key: "school_name_fr", value: "Institut Privé d'Excellence" },
    { key: "school_phone", value: "+216 71 888 999" },
    { key: "school_address", value: "Avenue Habib Bourguiba, Tunis" },
    { key: "school_logo", value: "" },
    { key: "prices_by_level", value: JSON.stringify(defaultTarifs) },
    {
      key: "sms_template_absence",
      value: "تعلم إدارة معهد الامتياز أن التلميذ [الاسم واللقب] تغيب عن الدرس على الساعة [الساعة]",
    },
    {
      key: "sms_template_payment_opt1",
      value: "تعلم إدارة معهد الامتياز أن التلميذ [الاسم واللقب] لم يخلص معلوم الدراسة",
    },
    {
      key: "sms_template_payment_opt2",
      value:
        "تعلم إدارة معهد الامتياز أن التلميذ [الاسم واللقب] لم يخلص معلوم الدراسة وسيتم إقصاؤه وفسخ اسمه من قائمة التلاميذ في صورة عدم الخلاص",
    },
    {
      key: "winsms_sender_id",
      value: process.env.WINSMS_SENDER_ID || "ELIMTIAZ",
    },
    {
      key: "winsms_api_key",
      value: process.env.WINSMS_API_KEY || "",
    },
    {
      key: "winsms_api_url",
      value: process.env.WINSMS_API_URL || "https://api.winsms.tn/v1",
    },
    { key: "sms_low_balance_threshold", value: "25" },
    { key: "sms_delay_between_sends", value: "1000" },
    { key: "sms_daily_limit", value: "500" },
    { key: "academic_year", value: "2026-2027" },
  ];

  for (const s of settingsToCreate) {
    const existing = await prisma.setting.findUnique({
      where: { key: s.key },
    });
    if (!existing) {
      await prisma.setting.create({ data: s });
    }
  }
  console.log("⚙️ Paramètres de l'établissement vérifiés et prêts.");

  // 3. Statut WinSMS Service (Singleton)
  const existingStatus = await prisma.smsServiceStatus.findUnique({
    where: { id: "singleton" },
  });
  if (!existingStatus) {
    await prisma.smsServiceStatus.create({
      data: {
        id: "singleton",
        balance: 500,
        lastSendStatus: "success",
      },
    });
    console.log("📡 Statut WinSMS initialisé.");
  }

  // 4. Données de démonstration : PAS en production sauf si SEED_DEMO_DATA=true
  const isProduction = process.env.NODE_ENV === "production";
  const shouldSeedDemo =
    process.env.SEED_DEMO_DATA === "true" ||
    (!isProduction && process.env.SEED_DEMO_DATA !== "false");

  if (!shouldSeedDemo) {
    console.log("ℹ️ Mode production : création des données de démonstration ignorée.");
    console.log("✅ Base de données prête pour la production !");
    return;
  }

  const existingStudentsCount = await prisma.student.count();
  if (existingStudentsCount > 0) {
    console.log("ℹ️ Données d'élèves déjà présentes. Démonstration non dupliquée.");
    console.log("✅ Seed terminé avec succès !");
    return;
  }

  console.log("📦 Mode développement : Génération des classes et élèves de test...");

  // Classes de démonstration
  const classesData = [
    { name: "7ème classe 1", level: "7ème", section: null },
    { name: "1ère classe 1", level: "1ère", section: null },
    { name: "2ème Économie classe 1", level: "2ème", section: "Économie" },
    { name: "Bac Informatique classe 1", level: "Bac", section: "Informatique" },
  ];

  const createdClasses = [];
  for (const c of classesData) {
    let existing = await prisma.class.findFirst({ where: { name: c.name } });
    if (!existing) {
      existing = await prisma.class.create({ data: c });
    }
    createdClasses.push(existing);
  }

  // Élèves de démonstration
  const studentsData = [
    { firstName: "Youssef", lastName: "Trabelsi", phone: "98112233", level: "7ème", section: null, classIdx: 0 },
    { firstName: "Amina", lastName: "Ben Salem", phone: "50445566", level: "7ème", section: null, classIdx: 0 },
    { firstName: "Mehdi", lastName: "Gharbi", phone: "22778899", level: "7ème", section: null, classIdx: 0 },
    { firstName: "Sarra", lastName: "Bouazizi", phone: "24123456", level: "7ème", section: null, classIdx: 0 },
    { firstName: "Aziz", lastName: "Khelifi", phone: "95667788", level: "7ème", section: null, classIdx: 0 },

    { firstName: "Nour", lastName: "Hammami", phone: "98223344", level: "1ère", section: null, classIdx: 1 },
    { firstName: "Rayen", lastName: "Mejri", phone: "52334455", level: "1ère", section: null, classIdx: 1 },
    { firstName: "Mariem", lastName: "Ayari", phone: "26445566", level: "1ère", section: null, classIdx: 1 },
    { firstName: "Ahmed", lastName: "Chahed", phone: "28556677", level: "1ère", section: null, classIdx: 1 },
    { firstName: "Salma", lastName: "Bouslama", phone: "99667788", level: "1ère", section: null, classIdx: 1 },

    { firstName: "Skander", lastName: "Dridi", phone: "97123456", level: "2ème", section: "Économie", classIdx: 2 },
    { firstName: "Ines", lastName: "Mansour", phone: "55789012", level: "2ème", section: "Économie", classIdx: 2 },
    { firstName: "Mohamed", lastName: "Jlassi", phone: "21345678", level: "2ème", section: "Économie", classIdx: 2 },
    { firstName: "Eya", lastName: "Riahi", phone: "29901234", level: "2ème", section: "Économie", classIdx: 2 },
    { firstName: "Farouk", lastName: "Karray", phone: "96543210", level: "2ème", section: "Économie", classIdx: 2 },

    { firstName: "Karim", lastName: "Zouari", phone: "98765432", level: "Bac", section: "Informatique", classIdx: 3 },
    { firstName: "Chaima", lastName: "Cherif", phone: "51234567", level: "Bac", section: "Informatique", classIdx: 3 },
    { firstName: "Bilel", lastName: "Sassi", phone: "23456789", level: "Bac", section: "Informatique", classIdx: 3 },
    { firstName: "Hiba", lastName: "Masmoudi", phone: "27890123", level: "Bac", section: "Informatique", classIdx: 3 },
    { firstName: "Taha", lastName: "Belhadj", phone: "94567890", level: "Bac", section: "Informatique", classIdx: 3 },
  ];

  const createdStudents = [];
  for (const s of studentsData) {
    let student = await prisma.student.findFirst({
      where: { firstName: s.firstName, lastName: s.lastName },
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          firstName: s.firstName,
          lastName: s.lastName,
          parentPhone: s.phone,
          level: s.level,
          section: s.section,
        },
      });

      const targetClass = createdClasses[s.classIdx];
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classId: targetClass.id,
        },
      });
    }
    createdStudents.push(student);
  }

  // Paiements de démonstration
  const tarifBac = 180;
  const tarif2eme = 105;
  const tarif1ere = 105;
  const tarif7eme = 100;

  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i];
    let due = tarif7eme;
    if (student.level === "1ère") due = tarif1ere;
    else if (student.level === "2ème") due = tarif2eme;
    else if (student.level === "Bac") due = tarifBac;

    let amountOct = due;
    if (i % 4 === 1) amountOct = due / 2;
    else if (i % 5 === 0) amountOct = 0;

    if (amountOct > 0) {
      const existingPayment = await prisma.payment.findUnique({
        where: { studentId_month: { studentId: student.id, month: "octobre" } },
      });
      if (!existingPayment) {
        const seq = 1000 + i + 1;
        await prisma.payment.create({
          data: {
            studentId: student.id,
            month: "octobre",
            amount: amountOct,
            dueAmount: due,
            receiptNo: `REC-2026-${String(seq).padStart(4, "0")}`,
            notes: amountOct < due ? "Acompte de 50%" : "Payé en totalité",
          },
        });
      }
    }
  }

  await prisma.setting.upsert({
    where: { key: "receipt_counter" },
    update: {},
    create: { key: "receipt_counter", value: "1025" },
  });

  console.log("✅ Seed terminé avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
