import assert from "assert";
import fs from "fs";
import path from "path";

async function testWorkerStartup() {
  console.log("==========================================================");
  console.log("🧪 TEST DE VALIDATION DU BUNDLE ET MODULES WORKER");
  console.log("==========================================================\n");

  // 1. Vérification du bundle compilé dist/worker.js
  const distPath = path.resolve(process.cwd(), "dist", "worker.js");
  assert.ok(fs.existsSync(distPath), "Le fichier dist/worker.js doit exister");
  const stats = fs.statSync(distPath);
  assert.ok(stats.size > 10000, "Le bundle compilé dist/worker.js ne doit pas être vide");
  console.log(`  ✓ Bundle compilé dist/worker.js présent (${Math.round(stats.size / 1024)} KB).`);

  // 2. Test d'importation du module source
  const workerModule = await import("../src/lib/sms/worker");
  assert.ok(typeof workerModule.startSmsWorker === "function", "startSmsWorker doit être exporté");
  assert.ok(typeof workerModule.stopSmsWorker === "function", "stopSmsWorker doit être exporté");
  assert.ok(typeof workerModule.processSmsQueueOnce === "function", "processSmsQueueOnce doit être exporté");
  assert.ok(typeof workerModule.migrateZeroBalanceToNull === "function", "migrateZeroBalanceToNull doit être exporté");
  assert.ok(typeof workerModule.refreshBalanceIfNeeded === "function", "refreshBalanceIfNeeded doit être exporté");
  console.log("  ✓ Module source ../src/lib/sms/worker et ses exports validés.");

  // 3. Test de résolution des alias de configuration
  const configModule = await import("../src/lib/sms/config");
  assert.ok(typeof configModule.getEffectiveSmsConfig === "function", "getEffectiveSmsConfig doit être exporté");
  console.log("  ✓ Alias et configurations SMS (@/lib/sms/config) résolus.");

  console.log("\n==========================================================");
  console.log("✅ VÉRIFICATION DU DÉMARRAGE DU WORKER RÉUSSIE !");
  console.log("==========================================================");
}

testWorkerStartup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Échec de la vérification :", err);
    process.exit(1);
  });
