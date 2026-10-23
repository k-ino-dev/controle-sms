import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0 DT";
  // Format standard tunisien (ex: 105 DT ou 105,5 DT)
  const isInteger = Number.isInteger(amount);
  return `${isInteger ? amount : amount.toFixed(1)} DT`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getCurrentTimeHHMM(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Tunis",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export const levelOrder: Record<string, number> = {
  "7ème": 1,
  "8ème": 2,
  "9ème": 3,
  "1ère": 4,
  "2ème": 5,
  "3ème": 6,
  "Bac": 7,
};

// Conversion d'un montant numérique en toutes lettres en français (ex: 105 -> "Cent cinq dinars")
export function numberToFrenchWords(n: number): string {
  if (n === 0) return "Zéro dinar";

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

  function convertUnder100(num: number): string {
    if (num < 10) return units[num];
    if (num >= 10 && num < 20) return teens[num - 10];
    const ten = Math.floor(num / 10);
    const unit = num % 10;

    if (ten === 7) {
      if (unit === 1) return "soixante et onze";
      return `soixante-${teens[unit]}`;
    }
    if (ten === 8) {
      if (unit === 0) return "quatre-vingts";
      return `quatre-vingt-${units[unit]}`;
    }
    if (ten === 9) {
      return `quatre-vingt-${teens[unit]}`;
    }
    if (unit === 1 && ten !== 8) {
      return `${tens[ten]} et un`;
    }
    if (unit === 0) return tens[ten];
    return `${tens[ten]}-${units[unit]}`;
  }

  function convertUnder1000(num: number): string {
    if (num < 100) return convertUnder100(num);
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    let prefix = hundred === 1 ? "cent" : `${units[hundred]} cent`;
    if (hundred > 1 && rest === 0) prefix += "s";
    if (rest === 0) return prefix;
    return `${prefix} ${convertUnder100(rest)}`;
  }

  function convert(num: number): string {
    if (num < 1000) return convertUnder1000(num);
    const thousand = Math.floor(num / 1000);
    const rest = num % 1000;
    let prefix = thousand === 1 ? "mille" : `${convertUnder1000(thousand)} mille`;
    if (rest === 0) return prefix;
    return `${prefix} ${convertUnder1000(rest)}`;
  }

  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 1000); // millimes éventuels

  let result = convert(intPart);
  result = result.charAt(0).toUpperCase() + result.slice(1);
  result += intPart > 1 ? " dinars" : " dinar";

  if (decPart > 0) {
    result += ` et ${convert(decPart).toLowerCase()} millimes`;
  }

  return result;
}

