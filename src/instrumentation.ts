export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Si un service worker dédié est actif en production Docker, ignorer l'in-process
    if (process.env.ENABLE_EMBEDDED_WORKER === "false") {
      console.log("[Contrôle SMS] Worker SMS in-process désactivé (délégué au service worker dédié).");
      return;
    }

    try {
      const { startSmsWorker } = await import("./lib/sms/worker");
      startSmsWorker(5000);
      console.log("[Contrôle SMS] Worker SMS initialisé (cycle de 5s).");
    } catch (err) {
      console.error("[Contrôle SMS] Erreur démarrage worker SMS :", err);
    }
  }
}
