import { SmsProvider, SmsResult } from "./types";
import { normalizeTunisianPhone } from "./index";
import { sanitizeApiKeyInString, sanitizeObjectForLogging } from "@/lib/crypto";

export interface WinSmsConfigOptions {
  apiKey?: string;
  senderId?: string;
  apiUrl?: string;
}

/**
 * Implémentation du fournisseur SMS pour WinSMS Tunisie (winsmspro.com).
 * 
 * Format RÉEL observé :
 * GET https://www.winsmspro.com/sms/sms/api?action=send-sms&api_key=<CLÉ>&to=216XXXXXXXX&from=<ENTETE>&sms=<TEXTE>
 * 
 * - Succès (HTTP 200) :
 *   {"code":"ok","message":"Successfully Send","balance":1491,"user":"...","licence":"2027-04-27","reference":"5818303"}
 * - Clé invalide (HTTP 200) :
 *   {"code":"102","message":"Authentication Failed"}
 * 
 * La décision est prise UNIQUEMENT sur le champ `code`.
 */
export class WinSmsProvider implements SmsProvider {
  private apiKey: string;
  private senderId: string;
  private apiUrl: string;

  constructor(options?: WinSmsConfigOptions) {
    this.apiKey = options?.apiKey ?? (process.env.WINSMS_API_KEY || "");
    this.senderId = options?.senderId ?? (process.env.WINSMS_SENDER_ID || "Lyc.Emtiyez");
    this.apiUrl = options?.apiUrl ?? (process.env.WINSMS_API_URL || "https://www.winsmspro.com/sms/sms/api");
  }

  /**
   * Envoi d'un message SMS via l'API WinSMS (GET avec paramètres encodés)
   */
  async send(to: string, text: string, senderId?: string): Promise<SmsResult> {
    if (!this.apiKey || !this.apiKey.trim()) {
      return {
        success: false,
        isNetworkError: false,
        error: "Bloqué par le site : Clé API WinSMS non configurée",
        raw: { error: "Missing WINSMS_API_KEY" },
      };
    }

    const effectiveSenderId = senderId || this.senderId || "Lyc.Emtiyez";

    // Normalisation stricte du numéro au format tunisien 216XXXXXXXX
    const phoneNorm = normalizeTunisianPhone(to);
    if (!phoneNorm.valid) {
      return {
        success: false,
        isNetworkError: false,
        error: "Bloqué par le site : Numéro de téléphone destinataire invalide",
        raw: { phone: to, error: phoneNorm.error },
      };
    }

    try {
      // Timeout strict de 15 secondes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Construction de l'URL avec URLSearchParams (encodage complet de l'arabe, espaces, &, #)
      const url = new URL(this.apiUrl);
      url.searchParams.set("action", "send-sms");
      url.searchParams.set("api_key", this.apiKey);
      url.searchParams.set("to", phoneNorm.normalized);
      url.searchParams.set("from", effectiveSenderId);
      url.searchParams.set("sms", text);

      const requestUrl = url.toString();

      const response = await fetch(requestUrl, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;
      const responseText = await response.text();

      let rawData: any = null;
      let isJson = false;
      try {
        rawData = JSON.parse(responseText);
        isJson = typeof rawData === "object" && rawData !== null;
      } catch {
        isJson = false;
      }

      // La clé API n'apparaît JAMAIS dans les données brutes ou les logs
      const sanitizedRaw = sanitizeObjectForLogging(isJson ? rawData : responseText);

      // 1. Erreur serveur 5xx (erreur réseau/infrastructure WinSMS -> retry éligible)
      if (status >= 500) {
        return {
          success: false,
          isNetworkError: true,
          error: `Service WinSMS indisponible (Erreur HTTP ${status})`,
          raw: sanitizedRaw,
        };
      }

      // 2. Réponse ambiguë : reçue mais format non-JSON ou sans champ "code"
      if (!isJson || typeof rawData.code === "undefined") {
        return {
          success: false,
          isUncertain: true,
          isNetworkError: false,
          error: "Statut incertain : réponse reçue mais illisible de WinSMS",
          raw: sanitizedRaw,
        };
      }

      const rawCode = String(rawData.code).trim();
      const codeLower = rawCode.toLowerCase();
      const rawMessage = String(rawData.message || "").trim();

      // 3. RÈGLE 1 : code === "ok" (comparaison insensible à la casse avec trim) -> SUCCÈS
      if (codeLower === "ok") {
        const reference = rawData.reference ? String(rawData.reference).trim() : undefined;
        let balance: number | undefined = undefined;
        if (typeof rawData.balance === "number") {
          balance = rawData.balance;
        } else if (rawData.balance !== undefined && rawData.balance !== null) {
          const parsed = parseFloat(String(rawData.balance));
          if (!isNaN(parsed)) balance = parsed;
        }

        return {
          success: true,
          messageId: reference || `WINSMS-${Date.now()}`,
          reference,
          balance,
          rawCode,
          rawMessage,
          raw: sanitizedRaw,
        };
      }

      // 4. RÈGLE 2 : code === "102" -> Clé API invalide ou non activée (pas de retry)
      if (codeLower === "102") {
        return {
          success: false,
          isNetworkError: false,
          error: "Clé API invalide ou non activée",
          rawCode,
          rawMessage,
          raw: sanitizedRaw,
        };
      }

      // 5. RÈGLE 3 : TOUT AUTRE CODE -> Échec sans inventer de cause (pas de retry)
      const failReason = rawMessage
        ? `WinSMS a refusé le message (code ${rawCode} : ${rawMessage})`
        : `WinSMS a refusé le message (code ${rawCode})`;

      return {
        success: false,
        isNetworkError: false,
        error: failReason,
        rawCode,
        rawMessage,
        raw: sanitizedRaw,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return {
          success: false,
          isNetworkError: true, // Délai dépassé -> tentative réseau suivante permise
          error: "Délai d'attente dépassé (timeout WinSMS)",
          raw: { error: "Network timeout after 15000ms" },
        };
      }

      return {
        success: false,
        isNetworkError: true, // Coupure de connexion -> tentative réseau suivante permise
        error: "Connexion à WinSMS impossible (erreur réseau)",
        raw: { error: sanitizeApiKeyInString(err.message || String(err)) },
      };
    }
  }

  /**
   * Consultation du solde restant WinSMS
   */
  async getBalance(): Promise<number> {
    if (!this.apiKey || !this.apiKey.trim()) return 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = new URL(this.apiUrl);
      url.searchParams.set("action", "get-balance");
      url.searchParams.set("api_key", this.apiKey);

      const response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return 0;

      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      const balance = Number(
        data?.balance ?? data?.credits ?? data?.solde ?? data?.amount ?? (typeof data === "string" ? parseFloat(data) : 0)
      );
      return isNaN(balance) ? 0 : balance;
    } catch {
      return 0;
    }
  }
}
