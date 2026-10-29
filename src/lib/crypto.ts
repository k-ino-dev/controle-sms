import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommandé pour GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Dérive une clé de 32 octets à partir de ENCRYPTION_KEY (ou fallback JWT_SECRET)
 */
function getDerivedKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "controle_sms_fallback_salt_key_change_in_production_2026";

  // Dérivation de 32 octets via SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Chiffre une chaîne de caractères en AES-256-GCM.
 * Format de sortie : ivHex:authTagHex:cipherHex
 */
export function encryptText(plainText: string): string {
  if (!plainText) return "";

  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Déchiffre une chaîne chiffrée en AES-256-GCM.
 * Format attendu : ivHex:authTagHex:cipherHex
 */
export function decryptText(cipherText: string): string {
  if (!cipherText || !cipherText.includes(":")) return "";

  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return "";

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // Si la clé de chiffrement a changé ou si le format est invalide
    return "";
  }
}

/**
 * Masque une clé API pour l'affichage sécurisé :
 * - Si vide : ""
 * - Si <= 4 caractères : "****"
 * - Si > 4 caractères : "***XXXX" (conserve uniquement les 4 derniers caractères)
 */
export function maskApiKey(apiKey?: string | null): string {
  if (!apiKey || !apiKey.trim()) return "";
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "****";
  return `***${trimmed.slice(-4)}`;
}

/**
 * Nettoie toute chaîne (URL, message d'erreur, dump brut) pour s'assurer
 * qu'aucune clé API n'apparaît en clair dans les logs ou la base de données.
 * Remplace api_key=... par api_key=***
 */
export function sanitizeApiKeyInString(str: string): string {
  if (!str) return str;
  return str
    .replace(/([?&]api_key=)[^&"\s]+/gi, "$1***")
    .replace(/("api_key"\s*:\s*")[^"]+(")/gi, '$1***$2')
    .replace(/("apiKey"\s*:\s*")[^"]+(")/gi, '$1***$2');
}

/**
 * Nettoie un objet ou une valeur quelconque pour masquer récursivement les clés API
 */
export function sanitizeObjectForLogging<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeApiKeyInString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectForLogging(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (/api_?key/i.test(key) && typeof value === "string") {
        sanitized[key] = maskApiKey(value);
      } else {
        sanitized[key] = sanitizeObjectForLogging(value);
      }
    }
    return sanitized as unknown as T;
  }

  return obj;
}
