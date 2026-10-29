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
 * Format officiel de l'API :
 * GET https://www.winsmspro.com/sms/sms/api?action=send-sms&api_key=<CLÉ>&to=216XXXXXXXX&from=<ENTETE>&sms=<TEXTE>
 * 
 * L'API détecte automatiquement Plain ou Unicode : l'arabe passe sans paramètre spécial.
 * Entête par défaut : Lyc.Emtiyez.
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
        error: "Erreur de configuration (clé API WinSMS absente)",
        raw: { error: "Missing WINSMS_API_KEY" },
      };
    }

    const effectiveSenderId = senderId || this.senderId || "Lyc.Emtiyez";

    // Normalisation stricte du numéro au format tunisien 216XXXXXXXX
    const phoneNorm = normalizeTunisianPhone(to);
    if (!phoneNorm.valid) {
      return {
        success: false,
        error: "Numéro de téléphone destinataire invalide",
        raw: { phone: to, error: phoneNorm.error },
      };
    }

    try {
      // Timeout strict de 15 secondes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Construction de l'URL avec URLSearchParams (encodage parfait pour l'arabe, espaces, &, #)
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
      try {
        rawData = JSON.parse(responseText);
      } catch {
        rawData = responseText;
      }

      // La clé API n'apparaît JAMAIS dans les données brutes ou les logs
      const sanitizedRaw = sanitizeObjectForLogging(rawData);

      // 1. Détection claire de succès
      if (response.ok && this.isConfirmedSuccess(rawData)) {
        const messageId = this.extractMessageId(rawData);
        return {
          success: true,
          messageId,
          raw: sanitizedRaw,
        };
      }

      // 2. Traduction des erreurs probables en français
      const frenchError = this.translateErrorCode(status, rawData);
      if (frenchError) {
        return {
          success: false,
          error: frenchError,
          raw: sanitizedRaw,
        };
      }

      // 3. Ni clairement un succès, ni une erreur reconnue -> Réponse inconnue
      return {
        success: false,
        error: "Réponse inconnue de WinSMS",
        raw: sanitizedRaw,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return {
          success: false,
          error: "Délai d'attente dépassé (timeout WinSMS)",
          raw: { error: "Network timeout after 15000ms" },
        };
      }

      return {
        success: false,
        error: "Service WinSMS indisponible",
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

  /**
   * Vérifie si la réponse confirme sans ambiguïté un succès
   */
  private isConfirmedSuccess(raw: any): boolean {
    if (!raw) return false;

    // Réponse objet JSON
    if (typeof raw === "object") {
      const statusStr = String(raw.status || "").toLowerCase();
      if (statusStr === "success" || statusStr === "ok" || statusStr === "sent") return true;
      if (raw.success === true) return true;
      if (raw.code === 200 || raw.code === "200") return true;
      if ((raw.message_id || raw.id || raw.msgId) && !raw.error) return true;
      return false;
    }

    // Réponse texte brut
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      const lower = trimmed.toLowerCase();

      // Si le texte contient des marqueurs d'erreur, ce n'est pas un succès
      if (
        lower.includes("error") ||
        lower.includes("err:") ||
        lower.includes("fail") ||
        lower.includes("invalid") ||
        lower.includes("refus") ||
        lower.includes("unauthorized")
      ) {
        return false;
      }

      // Cas 1 : "OK", "OK: 12345", "SUCCESS", "SMS SENT"
      if (/^(ok|success|sent)/i.test(trimmed)) return true;

      // Cas 2 : Identifiant numérique de message seul (ex: "12345678" ou "ID: 12345678")
      if (/^\d{3,}$/.test(trimmed) || /^id[:\s]+\d+/i.test(trimmed)) return true;
    }

    return false;
  }

  /**
   * Extrait ou génère un ID de message traçable
   */
  private extractMessageId(raw: any): string {
    if (typeof raw === "object" && raw !== null) {
      const id = raw.message_id || raw.id || raw.msgId || raw.sms_id;
      if (id) return String(id);
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      const match = trimmed.match(/\d{4,}/);
      if (match) return match[0];
    }
    return `WINSMS-${Date.now()}`;
  }

  /**
   * Traduit les erreurs connues en français clair
   */
  private translateErrorCode(status: number, raw: any): string | null {
    const rawStr =
      typeof raw === "string" ? raw.toLowerCase() : JSON.stringify(raw ?? {}).toLowerCase();

    // 1. IP non autorisée (vérifier d'abord si le corps mentionne explicitement l'IP)
    if (
      rawStr.includes("ip") &&
      (rawStr.includes("unauthorized") ||
        rawStr.includes("whitelist") ||
        rawStr.includes("not allowed") ||
        rawStr.includes("forbidden") ||
        rawStr.includes("interdite") ||
        rawStr.includes("address"))
    ) {
      return "Adresse IP du serveur non autorisée par WinSMS";
    }

    // 2. Crédit insuffisant
    if (
      status === 402 ||
      rawStr.includes("credit") ||
      rawStr.includes("solde") ||
      rawStr.includes("balance") ||
      rawStr.includes("no_fund") ||
      rawStr.includes("insufficient") ||
      rawStr.includes("epuise")
    ) {
      return "Crédit insuffisant sur votre compte WinSMS";
    }

    // 3. Numéro invalide
    if (
      status === 422 ||
      rawStr.includes("invalid_number") ||
      rawStr.includes("invalid number") ||
      rawStr.includes("phone") ||
      rawStr.includes("destination") ||
      rawStr.includes("numero") ||
      rawStr.includes("receiver") ||
      rawStr.includes("bad number")
    ) {
      return "Numéro de téléphone destinataire invalide";
    }

    // 4. Entête non autorisé
    if (
      rawStr.includes("sender") ||
      rawStr.includes("entete") ||
      rawStr.includes("header") ||
      rawStr.includes("sender_id") ||
      rawStr.includes("from")
    ) {
      return "Entête d'expéditeur non autorisé (Sender ID refusé)";
    }

    // 5. Clé API invalide
    if (
      status === 401 ||
      status === 403 ||
      rawStr.includes("invalid_api_key") ||
      rawStr.includes("invalid key") ||
      rawStr.includes("bad_key") ||
      rawStr.includes("key is invalid") ||
      rawStr.includes("auth") ||
      rawStr.includes("unauthorized_key") ||
      rawStr.includes("api key")
    ) {
      return "Clé API WinSMS invalide ou refusée";
    }

    // 6. Service indisponible / Erreur serveur WinSMS
    if (
      status >= 500 ||
      status === 408 ||
      rawStr.includes("service_unavailable") ||
      rawStr.includes("gateway") ||
      rawStr.includes("maintenance") ||
      rawStr.includes("timeout") ||
      rawStr.includes("down")
    ) {
      return "Service WinSMS indisponible";
    }

    return null;
  }
}
