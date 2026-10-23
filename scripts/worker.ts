import { startSmsWorker } from "../src/lib/sms/worker";

console.log("[SMS Worker Standalone] Démarrage du worker de file d'attente SMS...");
startSmsWorker(5000);

process.on("SIGTERM", () => {
  console.log("[SMS Worker Standalone] Arrêt propre...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[SMS Worker Standalone] Arrêt propre...");
  process.exit(0);
});
