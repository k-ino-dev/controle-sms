export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Démarrage automatique du worker de file SMS côté serveur
    try {
      const { startSmsWorker } = await import("./lib/sms/worker");
      startSmsWorker(5000);
      console.log("[Contrôle SMS] Worker SMS initialisé (cycle de 5s).");
    } catch (err) {
      console.error("[Contrôle SMS] Erreur démarrage worker SMS :", err);
    }
  }
}
