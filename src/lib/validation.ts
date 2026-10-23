import { z } from "zod";

// Nettoyer et normaliser le numéro de téléphone tunisien en 8 chiffres purs
export function cleanTunisianPhone(raw: string): string {
  let cleaned = raw.replace(/\s+/g, "").replace(/-/g, "").replace(/\./g, "");
  if (cleaned.startsWith("+216")) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith("00216")) {
    cleaned = cleaned.substring(5);
  } else if (cleaned.startsWith("216") && cleaned.length === 11) {
    cleaned = cleaned.substring(3);
  }
  return cleaned;
}

export const tunisianPhoneRegex = /^(\+216|00216)?[234579]\d{7}$/;

export const validLevels = [
  "7ème",
  "8ème",
  "9ème",
  "1ère",
  "2ème",
  "3ème",
  "Bac",
] as const;

export const validSections = [
  "Informatique",
  "Sciences",
  "Lettres",
] as const;

export const schoolMonths = [
  "octobre",
  "novembre",
  "décembre",
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
] as const;

export const loginSchema = z.object({
  username: z.string().min(2, "Nom d'utilisateur requis"),
  password: z.string().min(3, "Mot de passe requis"),
});

export const studentSchema = z
  .object({
    firstName: z.string().min(2, "Le prénom doit comporter au moins 2 caractères"),
    lastName: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
    parentPhone: z
      .string()
      .regex(
        tunisianPhoneRegex,
        "Numéro invalide. Format attendu : 8 chiffres (ex: 98123456 ou +21698123456)"
      ),
    level: z.enum(validLevels, {
      errorMap: () => ({ message: "Veuillez sélectionner un niveau valide" }),
    }),
    section: z.enum(validSections).nullable().optional(),
    classId: z.string().optional(),
  })
  .refine(
    (data) => {
      // Les sections ne sont autorisées/obligatoires que pour 2ème, 3ème et Bac
      const requiresSection = ["2ème", "3ème", "Bac"].includes(data.level);
      if (requiresSection) {
        return !!data.section;
      }
      return true;
    },
    {
      message: "La section est obligatoire pour la 2ème, 3ème et le Bac",
      path: ["section"],
    }
  );

export const classSchema = z
  .object({
    name: z.string().optional(),
    level: z.enum(validLevels, {
      errorMap: () => ({ message: "Veuillez sélectionner un niveau valide" }),
    }),
    section: z.enum(validSections).nullable().optional(),
  })
  .refine(
    (data) => {
      const requiresSection = ["2ème", "3ème", "Bac"].includes(data.level);
      if (requiresSection) {
        return !!data.section;
      }
      return true;
    },
    {
      message: "La section est obligatoire pour la 2ème, 3ème et le Bac",
      path: ["section"],
    }
  );

export const absenceSubmissionSchema = z.object({
  classId: z.string().min(1, "Classe requise"),
  idempotencyKey: z.string().min(5, "Clé d'idempotence requise"),
  recordedAtTime: z.string().regex(/^\d{2}:\d{2}$/, "Format heure HH:MM requis"),
  absentStudentIds: z.array(z.string()),
});

export const paymentSchema = z.object({
  studentId: z.string().min(1, "Élève requis"),
  month: z.enum(schoolMonths, {
    errorMap: () => ({ message: "Mois invalide" }),
  }),
  amount: z.number().min(0, "Le montant ne peut pas être négatif"),
  notes: z.string().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(4, "Le nouveau mot de passe doit comporter au moins 4 caractères"),
});
