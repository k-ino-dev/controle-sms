import { SmsProvider, SmsResult } from "./types";

let mockBalance = 500; // Solde initial simulé de 500 SMS

export class MockSmsProvider implements SmsProvider {
  async send(to: string, text: string, senderId?: string): Promise<SmsResult> {
    // Petit délai simulant l'appel HTTP réseau
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Simulation de cas d'erreur de test (ex: numéro vide ou avec que des 0)
    if (!to || to.endsWith("00000000")) {
      return {
        success: false,
        error: "Numéro invalide",
        raw: { status: "ERR", code: 400, message: "Invalid destination phone number" },
      };
    }

    if (mockBalance <= 0) {
      return {
        success: false,
        error: "Crédit insuffisant",
        raw: { status: "ERR", code: 402, message: "Out of credits" },
      };
    }

    // Déduction du crédit simulé
    mockBalance = Math.max(0, mockBalance - 1);

    const messageId = `MOCK-SMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return {
      success: true,
      messageId,
      raw: {
        status: "OK",
        code: 200,
        messageId,
        destination: to,
        senderId: senderId || "WinSMS",
        balanceRemaining: mockBalance,
      },
    };
  }

  async getBalance(): Promise<{
    success: boolean;
    balance: number | null;
    licenceDate?: string | null;
    raw?: any;
    error?: string;
  }> {
    return {
      success: true,
      balance: mockBalance,
      licenceDate: "2027-12-31",
      raw: { mock: true, balance: mockBalance },
    };
  }
}
