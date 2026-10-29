import { SmsProvider } from "./types";
import { WinSmsProvider } from "./winsms";
import { MockSmsProvider } from "./mock";

export * from "./types";
export * from "./winsms";
export * from "./mock";
export * from "./templates";
export * from "./config";

// Instance de secours synchrone du fournisseur SMS
let providerInstance: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (providerInstance) return providerInstance;

  const providerType = (process.env.SMS_PROVIDER || "mock").toLowerCase().trim();

  if (providerType === "winsms") {
    providerInstance = new WinSmsProvider();
  } else {
    providerInstance = new MockSmsProvider();
  }

  return providerInstance;
}

/**
 * Normalisation stricte du numéro de téléphone au format tunisien WinSMS : 216XXXXXXXX
 * Accepte : +216 98 123 456, 0021698123456, 98 123 456, 98123456
 */
export function normalizeTunisianPhone(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (!raw || !raw.trim()) {
    return { valid: false, normalized: "", error: "Numéro de téléphone manquant" };
  }

  // Supprimer espaces, tirets, parenthèses et points
  let clean = raw.replace(/[\s\-\(\)\.]/g, "");

  // Supprimer préfixe international + ou 00
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("00")) clean = clean.slice(2);

  // Si commence déjà par 216 et a 11 chiffres
  if (clean.startsWith("216") && clean.length === 11 && /^\d{11}$/.test(clean)) {
    return { valid: true, normalized: clean };
  }

  // Si a 8 chiffres (numéro local tunisien standard)
  if (clean.length === 8 && /^\d{8}$/.test(clean)) {
    return { valid: true, normalized: `216${clean}` };
  }

  return {
    valid: false,
    normalized: clean,
    error: "Format invalide : 8 chiffres tunisiens attendus (ex: 98123456)",
  };
}

/**
 * Calcul exact du nombre de segments SMS pour l'alphabet Unicode / Arabe :
 * - 1 segment : jusqu'à 70 caractères
 * - Concaténé (multi-segments) : 67 caractères par segment (en-tête UDH de 6 octets réservé)
 */
export function calculateSmsSegments(text: string): {
  charCount: number;
  segments: number;
  segmentsCount: number;
  charsPerSegment: number;
} {
  if (!text) {
    return { charCount: 0, segments: 1, segmentsCount: 1, charsPerSegment: 70 };
  }

  const charCount = text.length;

  if (charCount === 0) {
    return { charCount: 0, segments: 1, segmentsCount: 1, charsPerSegment: 70 };
  }

  if (charCount <= 70) {
    return { charCount, segments: 1, segmentsCount: 1, charsPerSegment: 70 };
  }

  const segments = Math.ceil(charCount / 67);
  return { charCount, segments, segmentsCount: segments, charsPerSegment: 67 };
}

/**
 * Fuseau horaire officiel de l'établissement : Africa/Tunis (UTC+1, pas d'heure d'été)
 */
export const TUNIS_TIMEZONE = "Africa/Tunis";

/**
 * Obtenir l'heure exacte HH:MM en fuseau Africa/Tunis côté serveur (ex: "08:15")
 */
export function getTunisTimeHHMM(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TUNIS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts;
}

/**
 * Formate l'heure pour le SMS d'absence :
 * - Uniquement l'HEURE, sans minutes, arrondie vers le BAS (on retire simplement les minutes)
 * - Fuseau horaire Africa/Tunis (côté serveur), pas celui du navigateur ni du serveur
 * - Format : nombre sans zéro devant, suivi de "h" (ex: "8h", "13h", "0h", "23h")
 * - Pas d'arrondi à l'heure suivante, jamais.
 */
export function formatTunisHourFloor(timeOrDate?: string | Date | null): string {
  let hour: number;

  if (timeOrDate instanceof Date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TUNIS_TIMEZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(timeOrDate);
    hour = parseInt(parts, 10);
    if (hour === 24) hour = 0;
  } else if (typeof timeOrDate === "string") {
    const trimmed = timeOrDate.trim();
    // Si c'est une chaîne ISO complète ou date convertible
    if (trimmed.includes("T") || (trimmed.length > 5 && !/^\d{1,2}:\d{2}$/.test(trimmed))) {
      const parsedDate = new Date(trimmed);
      if (!isNaN(parsedDate.getTime())) {
        return formatTunisHourFloor(parsedDate);
      }
    }
    // Si format "HH:MM" ou "H:MM" (ex: "08:15" -> 8, "00:05" -> 0, "13:59" -> 13)
    const [h] = trimmed.split(":");
    hour = parseInt(h, 10);
  } else {
    // Par défaut, l'heure courante en fuseau Africa/Tunis
    return formatTunisHourFloor(new Date());
  }

  if (isNaN(hour)) {
    hour = 8;
  }

  return `${hour}h`;
}

/**
 * Mois de l'année scolaire en arabe tunisien
 */
export const ARABIC_MONTHS = [
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
  "جانفي",
  "فيفري",
  "مارس",
  "أفريل",
  "ماي",
  "جوان",
] as const;

export const MONTHS_MAP: { fr: string; ar: string; label: string }[] = [
  { fr: "octobre", ar: "أكتوبر", label: "Octobre" },
  { fr: "novembre", ar: "نوفمبر", label: "Novembre" },
  { fr: "décembre", ar: "ديسمبر", label: "Décembre" },
  { fr: "janvier", ar: "جانفي", label: "Janvier" },
  { fr: "février", ar: "فيفري", label: "Février" },
  { fr: "mars", ar: "مارس", label: "Mars" },
  { fr: "avril", ar: "أفريل", label: "Avril" },
  { fr: "mai", ar: "ماي", label: "Mai" },
  { fr: "juin", ar: "جوان", label: "Juin" },
];

export const FR_TO_AR_MONTH: Record<string, string> = {
  octobre: "أكتوبر",
  novembre: "نوفمبر",
  décembre: "ديسمبر",
  janvier: "جانفي",
  février: "فيفري",
  mars: "مارس",
  avril: "أفريل",
  mai: "ماي",
  juin: "جوان",
};

/**
 * Convertit tout nom de mois (français ou arabe) en son nom officiel arabe
 */
export function toArabicMonth(month?: string | null): string {
  if (!month) return "أكتوبر";
  const trimmed = month.trim();
  const lower = trimmed.toLowerCase();
  if (FR_TO_AR_MONTH[lower]) return FR_TO_AR_MONTH[lower];
  for (const item of MONTHS_MAP) {
    if (item.ar === trimmed || item.fr === lower) return item.ar;
  }
  return trimmed;
}

/**
 * Remplacement des variables dans un modèle de message arabe
 * Prend en charge [الاسم واللقب], [الساعة] (et legacy [HH:MM]), [الشهر], [المبلغ]
 * N'ajoute AUCUN texte supplémentaire non présent dans le modèle.
 */
export function formatSmsMessage(
  template: string,
  variables: {
    studentName?: string;
    time?: string | Date;
    hour?: string | Date;
    month?: string;
    amount?: string | number;
  }
): string {
  let result = template || "";

  if (variables.studentName) {
    result = result.replaceAll("[الاسم واللقب]", variables.studentName);
  }

  const timeVal = variables.hour !== undefined ? variables.hour : variables.time;
  if (timeVal !== undefined && timeVal !== null) {
    const formattedHour = formatTunisHourFloor(timeVal);
    result = result
      .replaceAll("[الساعة]", formattedHour)
      .replaceAll("[HH:MM]", formattedHour);
  }

  if (variables.month) {
    const arabicMonth = toArabicMonth(variables.month);
    result = result.replaceAll("[الشهر]", arabicMonth);
  }

  if (variables.amount !== undefined) {
    result = result.replaceAll("[المبلغ]", String(variables.amount));
  }

  return result;
}


