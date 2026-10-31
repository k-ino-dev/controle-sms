export interface SmsResult {
  success: boolean;
  messageId?: string;
  reference?: string; // Référence WinSMS officielle (ex: "5818303")
  balance?: number; // Solde mis à jour retourné par WinSMS
  licenceDate?: string; // Date de fin de licence retournée par WinSMS
  rawCode?: string; // Code brut de l'API (ex: "ok", "102")
  rawMessage?: string; // Message brut retourné (ex: "Successfully Send")
  error?: string; // Cause lisible en français
  isNetworkError?: boolean; // true UNIQUEMENT pour timeout, 5xx, ou échec réseau
  isUncertain?: boolean; // true si réponse HTTP reçue mais corps corrompu/invalide
  raw?: any; // Réponse brute retournée par l'API technique
}

export interface BalanceResult {
  success: boolean;
  balance: number | null; // Solde entier en SMS (null si non obtenu ou indisponible)
  licenceDate?: string | null; // Date de fin de licence/validité (ex: "2027-04-27")
  raw?: any; // Réponse brute (sanitisée)
  error?: string; // Erreur explicative si non disponible
}

export interface SmsProvider {
  /**
   * Envoi d'un SMS à un destinataire (au format normalisé 216XXXXXXXX)
   */
  send(to: string, text: string, senderId?: string): Promise<SmsResult>;

  /**
   * Récupération du solde réel et de la date de validité du pack
   */
  getBalance(): Promise<BalanceResult>;
}

