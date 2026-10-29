export interface SmsResult {
  success: boolean;
  messageId?: string;
  reference?: string; // Référence WinSMS officielle (ex: "5818303")
  balance?: number; // Solde mis à jour retourné par WinSMS
  rawCode?: string; // Code brut de l'API (ex: "ok", "102")
  rawMessage?: string; // Message brut retourné (ex: "Successfully Send")
  error?: string; // Cause lisible en français
  isNetworkError?: boolean; // true UNIQUEMENT pour timeout, 5xx, ou échec réseau
  isUncertain?: boolean; // true si réponse HTTP reçue mais corps corrompu/invalide
  raw?: any; // Réponse brute retournée par l'API technique
}

export interface SmsProvider {
  /**
   * Envoi d'un SMS à un destinataire (au format normalisé 216XXXXXXXX)
   */
  send(to: string, text: string, senderId?: string): Promise<SmsResult>;

  /**
   * Récupération du solde (nombre de SMS restants ou montant en DT)
   */
  getBalance(): Promise<number>;
}
