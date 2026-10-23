import { SmsProvider, SmsResult } from "./types";

/**
 * Implémentation du fournisseur SMS pour WinSMS Tunisie (winsms.tn).
 * 
 * NOTE IMPORTANTE :
 * Tous les endpoints HTTP, les noms de paramètres (ex: key, to, msg, sender)
 * et le formatage des réponses (JSON ou texte brut) sont clairement balisés
 * "À ADAPTER SELON LA DOC WINSMS". Dès réception de la documentation officielle,
 * ajustez simplement les fonctions de sérialisation et de parsing ci-dessous.
 */
export class WinSmsProvider implements SmsProvider {
  private apiKey: string;
  private senderId: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.WINSMS_API_KEY || "";
    this.senderId = process.env.WINSMS_SENDER_ID || "IMTIYAZ";
    this.apiUrl = process.env.WINSMS_API_URL || "https://api.winsms.tn";
  }

  /* ==================== À ADAPTER SELON LA DOC WINSMS ==================== */
  // 1. Envoi de SMS
  async send(to: string, text: string, senderId?: string): Promise<SmsResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Erreur de configuration (clé API WinSMS absente)",
        raw: { error: "Missing WINSMS_API_KEY in environment" },
      };
    }

    const effectiveSenderId = senderId || this.senderId;

    try {
      // Configuration de timeout réseau (10 secondes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // --- À ADAPTER SELON LA DOC WINSMS (Endpoint & payload) ---
      // Schéma standard type WinSMS / passerelle SMS tunisienne :
      // URL usuelle : POST/GET https://api.winsms.tn/send ou https://api.winsms.tn/api/v1/sms/send
      const endpoint = `${this.apiUrl.replace(/\/$/, "")}/sms/send`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "application/json",
        },
        body: JSON.stringify({
          // Paramètres typiques WinSMS :
          apiKey: this.apiKey,
          sender: effectiveSenderId,
          receiver: to, // Format 216XXXXXXXX
          message: text,
          encoding: "unicode", // Pour l'arabe
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;
      let rawData: any = null;
      try {
        rawData = await response.json();
      } catch {
        rawData = await response.text();
      }

      // --- À ADAPTER SELON LA DOC WINSMS (Parsing de la réponse de succès) ---
      // Exemples courants : { success: true, id: "..." } ou { code: 200, message_id: "..." }
      if (response.ok && (rawData?.success === true || rawData?.code === 200 || rawData?.status === "OK" || (typeof rawData === "string" && rawData.toLowerCase().includes("ok")))) {
        const messageId = String(rawData?.message_id || rawData?.id || rawData?.msgId || `WINSMS-${Date.now()}`);
        return {
          success: true,
          messageId,
          raw: rawData,
        };
      }

      // Traduction de l'erreur en cause lisible en français
      const frenchError = this.translateErrorCode(status, rawData);

      return {
        success: false,
        error: frenchError,
        raw: rawData,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return {
          success: false,
          error: "Délai d'attente dépassé (timeout WinSMS)",
          raw: { error: "Network timeout after 10000ms" },
        };
      }

      return {
        success: false,
        error: "Service WinSMS indisponible",
        raw: { error: err.message || String(err) },
      };
    }
  }

  /* ==================== À ADAPTER SELON LA DOC WINSMS ==================== */
  // 2. Consultation du solde / crédit restant
  async getBalance(): Promise<number> {
    if (!this.apiKey) return 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      // Endpoint type pour WinSMS (ex: /sms/balance ou /api/v1/balance)
      const endpoint = `${this.apiUrl.replace(/\/$/, "")}/sms/balance?apiKey=${encodeURIComponent(this.apiKey)}`;

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return 0;

      const data = await response.json();
      // Exemple typique : { balance: 350 } ou { credits: 350 } ou { solde: 350 }
      const balance = Number(data?.balance ?? data?.credits ?? data?.solde ?? data?.amount ?? 0);
      return isNaN(balance) ? 0 : balance;
    } catch (err) {
      console.error("[WinSMS] Erreur lecture solde :", err);
      return 0;
    }
  }

  /* ==================== TRADUCTION DES ERREURS EN FRANÇAIS ==================== */
  private translateErrorCode(status: number, raw: any): string {
    const rawStr = typeof raw === "string" ? raw.toLowerCase() : JSON.stringify(raw).toLowerCase();

    if (status === 402 || rawStr.includes("credit") || rawStr.includes("solde") || rawStr.includes("balance") || rawStr.includes("no_fund")) {
      return "Crédit insuffisant";
    }

    if (rawStr.includes("invalid_number") || rawStr.includes("phone") || rawStr.includes("destination") || rawStr.includes("numero") || status === 422) {
      return "Numéro invalide";
    }

    if (rawStr.includes("sender") || rawStr.includes("entete") || rawStr.includes("header") || rawStr.includes("sender_id")) {
      return "Entête refusé";
    }

    if (status >= 500 || rawStr.includes("service_unavailable") || rawStr.includes("gateway")) {
      return "Service indisponible";
    }

    if (status === 408 || rawStr.includes("timeout")) {
      return "Délai d'attente dépassé (timeout)";
    }

    if (status === 401 || status === 403 || rawStr.includes("auth") || rawStr.includes("key")) {
      return "Clé API invalide ou refusée";
    }

    return "Erreur inconnue de la passerelle SMS";
  }
}
