import { prisma } from "@/lib/prisma";
import { decryptText, maskApiKey } from "@/lib/crypto";
import { SmsProvider } from "./types";
import { WinSmsProvider } from "./winsms";
import { MockSmsProvider } from "./mock";

export interface ResolvedSmsConfig {
  mode: "winsms" | "mock";
  apiKey: string;
  senderId: string;
  apiUrl: string;
  isConfigured: boolean;
  maskedKey: string;
}

/**
 * Résout la configuration SMS selon la règle stricte de priorité :
 * 1. Paramètres en base de données (priorité maximale, clé chiffrée AES-256-GCM)
 * 2. Variables d'environnement (.env)
 * 3. Mode Simulation par défaut (sécurité hors ligne)
 */
export async function getEffectiveSmsConfig(): Promise<ResolvedSmsConfig> {
  const dbSettingsMap: Record<string, string> = {};

  try {
    const dbSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: ["sms_provider_mode", "winsms_api_key", "winsms_sender_id", "winsms_api_url"],
        },
      },
    });
    dbSettings.forEach((s) => {
      dbSettingsMap[s.key] = s.value;
    });
  } catch {
    // Si la base est inaccessible temporairement
  }

  // 1. Clé API : Base (déchiffrée) > .env > ""
  let apiKey = "";
  if (dbSettingsMap["winsms_api_key"] && dbSettingsMap["winsms_api_key"].trim()) {
    const decrypted = decryptText(dbSettingsMap["winsms_api_key"].trim());
    if (decrypted) {
      apiKey = decrypted;
    }
  }
  if (!apiKey && process.env.WINSMS_API_KEY && process.env.WINSMS_API_KEY.trim()) {
    apiKey = process.env.WINSMS_API_KEY.trim();
  }

  // 2. Sender ID : Base > .env > "Lyc.Emtiyez"
  const senderId =
    dbSettingsMap["winsms_sender_id"]?.trim() ||
    process.env.WINSMS_SENDER_ID?.trim() ||
    "Lyc.Emtiyez";

  // 3. API URL : Base > .env > "https://www.winsmspro.com/sms/sms/api"
  const apiUrl =
    dbSettingsMap["winsms_api_url"]?.trim() ||
    process.env.WINSMS_API_URL?.trim() ||
    "https://www.winsmspro.com/sms/sms/api";

  // 4. Mode : Base > .env > simulation ("mock")
  let mode: "winsms" | "mock" = "mock";
  const dbMode = dbSettingsMap["sms_provider_mode"]?.toLowerCase().trim();
  const envMode = process.env.SMS_PROVIDER?.toLowerCase().trim();

  if (dbMode === "winsms" || dbMode === "real") {
    mode = "winsms";
  } else if (dbMode === "mock" || dbMode === "simulation") {
    mode = "mock";
  } else if (envMode === "winsms") {
    mode = "winsms";
  } else {
    mode = "mock";
  }

  const isConfigured = Boolean(apiKey);
  const maskedKey = maskApiKey(apiKey);

  return {
    mode,
    apiKey,
    senderId,
    apiUrl,
    isConfigured,
    maskedKey,
  };
}

/**
 * Retourne le fournisseur SMS approprié (WinSMS ou Mock) configuré avec
 * les paramètres effectifs (Base > Env > Défauts)
 */
export async function getEffectiveSmsProvider(): Promise<{
  provider: SmsProvider;
  config: ResolvedSmsConfig;
}> {
  const config = await getEffectiveSmsConfig();

  if (config.mode === "winsms") {
    const provider = new WinSmsProvider({
      apiKey: config.apiKey,
      senderId: config.senderId,
      apiUrl: config.apiUrl,
    });
    return { provider, config };
  }

  return { provider: new MockSmsProvider(), config };
}
