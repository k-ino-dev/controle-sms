import { startSmsWorker, stopSmsWorker } from "../src/lib/sms/worker";

console.log("[SMS Worker Standalone] Démarrage du worker de file d'attente SMS (cycle 5s)...");
startSmsWorker(5000);

const shutdown = () => {
  console.log("[SMS Worker Standalone] Arrêt propre du worker...");
  stopSmsWorker();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
