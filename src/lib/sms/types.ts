export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string; // Cause lisible en français
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
