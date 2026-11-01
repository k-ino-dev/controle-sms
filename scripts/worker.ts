import { startSmsWorker, stopSmsWorker } from "../src/lib/sms/worker";

console.log("==========================================================");
console.log("🚀 [SMS Worker] Worker SMS démarré (cycle de 5s)");
console.log("==========================================================");
startSmsWorker(5000);

const shutdown = () => {
  console.log("[SMS Worker Standalone] Arrêt propre du worker...");
  stopSmsWorker();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
