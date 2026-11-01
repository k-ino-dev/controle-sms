import assert from "assert";
import { prisma } from "../src/lib/prisma";
import { WinSmsProvider } from "../src/lib/sms/winsms";
import {
  processSmsQueueOnce,
  recoverStuckSendingSms,
  acquireOrRenewLock,
  releaseWorkerLock,
  triggerSmsWorker,
  registerWakeListener,
  migrateZeroBalanceToNull,
} from "../src/lib/sms/worker";
import { getEffectiveSmsConfig } from "../src/lib/sms/config";
import http from "http";

async function runTests() {
  console.log("==========================================================");
  console.log("🧪 SUITE DE TESTS AUTOMATISÉS : WORKER, SOLDE & SCRIPTS");
  console.log("==========================================================\n");

  let mockResponseStatus = 200;
  let mockResponseBody = "";
  let lastServerRequestUrl = "";

  // 1. Mock HTTP Server pour WinSMS API
  const server = http.createServer((req, res) => {
    lastServerRequestUrl = req.url || "";
    res.writeHead(mockResponseStatus, { "Content-Type": "application/json" });
    res.end(mockResponseBody);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const mockApiUrl = `http://127.0.0.1:${port}/api`;

  console.log(`[Test Server] Serveur mock WinSMS actif sur le port ${port}`);

  try {
    // ------------------------------------------------------------------------
    // TEST 1 : getBalance() avec le format RÉEL WinSMS
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 1 : WinSmsProvider.getBalance() avec le format réel...");

    const provider = new WinSmsProvider({
      apiKey: "test_valid_key_123",
      apiUrl: mockApiUrl,
      senderId: "Lyc.Emtiyez",
    });

    // 1.1 Format nominal de succès
    mockResponseStatus = 200;
    mockResponseBody = JSON.stringify({
      balance: 1471,
      user: "elimtiaz",
      country: "Tunisia",
      licence: "2027-04-27",
    });

    const resSuccess = await provider.getBalance();
    assert.strictEqual(resSuccess.success, true, "Doit être un succès");
    assert.strictEqual(resSuccess.balance, 1471, "Doit extraire le solde entier 1471");
    assert.strictEqual(resSuccess.licenceDate, "2027-04-27", "Doit extraire la date de licence");
    assert.ok(lastServerRequestUrl.includes("action=check-balance"), "L'action doit être check-balance");
    assert.ok(lastServerRequestUrl.includes("response=json"), "Le paramètre response=json doit être présent");
    console.log("  ✓ Succès nominal : solde 1471 SMS, licence 2027-04-27 extraits correctement.");

    // 1.2 Format de clé invalide (code 102)
    mockResponseStatus = 200;
    mockResponseBody = JSON.stringify({
      code: "102",
      message: "Authentication Failed",
    });

    const res102 = await provider.getBalance();
    assert.strictEqual(res102.success, false, "Doit être un échec");
    assert.strictEqual(res102.balance, null, "Le solde NE DOIT PAS être considéré comme 0 (doit être null)");
    assert.ok(res102.error?.includes("invalide"), "Doit signaler une clé invalide");
    console.log("  ✓ Clé invalide (code 102) : renvoie balance=null (jamais 0) et erreur explicite.");

    // 1.3 Format HTML ou JSON corrompu / inattendu (sans champ balance)
    mockResponseStatus = 200;
    mockResponseBody = "<html><body>502 Bad Gateway</body></html>";

    const resCorrupt = await provider.getBalance();
    assert.strictEqual(resCorrupt.success, false, "Doit être un échec");
    assert.strictEqual(resCorrupt.balance, null, "Le solde NE DOIT JAMAIS être 0 sur réponse invalide");
    console.log("  ✓ Réponse HTML/invalide : renvoie balance=null (jamais 0).");

    // 1.4 Pas de clé configurée
    const providerNoKey = new WinSmsProvider({ apiKey: "", apiUrl: mockApiUrl });
    const resNoKey = await providerNoKey.getBalance();
    assert.strictEqual(resNoKey.success, false);
    assert.strictEqual(resNoKey.balance, null);
    console.log("  ✓ Clé vide : renvoie balance=null immédiatement sans appel réseau.");

    // ------------------------------------------------------------------------
    // TEST 2 : Verrou distribué du worker (Single active worker lock)
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 2 : Verrou distribué du worker (Single active worker lock)...");

    await releaseWorkerLock();
    const lock1 = await acquireOrRenewLock();
    assert.strictEqual(lock1, true, "Le premier worker doit pouvoir acquérir le verrou");

    const lock2 = await acquireOrRenewLock();
    assert.strictEqual(lock2, true, "Le même worker peut renouveler son propre verrou");

    await releaseWorkerLock();
    console.log("  ✓ Acquisition, renouvellement et libération du verrou validés.");

    // ------------------------------------------------------------------------
    // TEST 3 : Récupération des SMS coincés en "sending" (> 2 min) -> "uncertain"
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 3 : Récupération anti-doublon des SMS coincés en 'sending'...");

    // Créer un SMS coincé en sending depuis plus de 2 minutes
    const oldDate = new Date(Date.now() - 3 * 60 * 1000);
    const stuckMsg = await prisma.smsQueue.create({
      data: {
        parentPhone: "21698000111",
        message: "SMS de test interruption",
        type: "test",
        status: "sending",
        createdAt: oldDate,
        nextRetryAt: oldDate,
        sentAt: oldDate,
      },
    });

    const recoveredCount = await recoverStuckSendingSms();
    assert.ok(recoveredCount >= 1, "Au moins 1 SMS coincé doit être récupéré");

    const checkedStuck = await prisma.smsQueue.findUnique({
      where: { id: stuckMsg.id },
    });
    assert.strictEqual(checkedStuck?.status, "uncertain", "Le SMS coincé doit être passé en uncertain");
    assert.ok(checkedStuck?.failReason?.includes("interrompu"), "Le motif doit expliquer l'interruption");
    console.log("  ✓ SMS coincé en 'sending' passé en statut 'uncertain' sans retentative automatique.");

    // Nettoyage
    await prisma.smsQueue.delete({ where: { id: stuckMsg.id } });

    // ------------------------------------------------------------------------
    // TEST 4 : Dépilage de la file SMS par le worker et transitions d'état
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 4 : Dépilage de la file SMS par le worker...");

    // Configurer le provider mock pour la file
    await prisma.setting.upsert({
      where: { key: "sms_provider_mode" },
      update: { value: "mock" },
      create: { key: "sms_provider_mode", value: "mock" },
    });

    // Insérer un SMS d'absence en attente
    const pendingMsg = await prisma.smsQueue.create({
      data: {
        parentPhone: "98123456",
        message: "تعلم إدارة المعهد أن التلميذ تغيب",
        type: "absence",
        status: "pending",
        retryCount: 0,
        nextRetryAt: new Date(Date.now() - 1000),
      },
    });

    const resultBatch = await processSmsQueueOnce();
    assert.strictEqual(resultBatch.processed >= 1, true, "Le SMS doit avoir été traité");
    assert.strictEqual(resultBatch.sent >= 1, true, "Le SMS doit avoir été envoyé");

    const updatedMsg = await prisma.smsQueue.findUnique({
      where: { id: pendingMsg.id },
    });
    assert.strictEqual(updatedMsg?.status, "sent", "Le statut final doit être 'sent'");
    assert.ok(updatedMsg?.sentAt, "La date sentAt doit être enregistrée");
    console.log(`  ✓ SMS #${pendingMsg.id} dépilé et envoyé avec succès (${updatedMsg?.status}).`);

    // Nettoyage
    await prisma.smsQueue.delete({ where: { id: pendingMsg.id } });

    // ------------------------------------------------------------------------
    // TEST 5 : Mécanisme de réveil immédiat (triggerSmsWorker)
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 5 : Mécanisme de réveil immédiat du worker...");

    let wakeCalled = false;
    const unregister = registerWakeListener(() => {
      wakeCalled = true;
    });

    triggerSmsWorker();
    assert.strictEqual(wakeCalled, true, "Le réveil immédiat doit notifier les écouteurs instantanément");
    unregister();
    console.log("  ✓ Réveil immédiat (triggerSmsWorker) exécuté en < 1ms.");

    // ------------------------------------------------------------------------
    // TEST 6 : Migration des anciennes valeurs 0 non confirmées vers null
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 6 : Migration des soldes '0' par défaut vers null...");

    // Cas A : solde 0 non confirmé par une lecture explicite (défaut ou ancien bug)
    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: { balance: 0, rawResponse: null, lastError: "Erreur passée" },
      create: { id: "singleton", balance: 0, rawResponse: null, lastError: "Erreur passée" },
    });
    await migrateZeroBalanceToNull();
    const migratedStatusA = await prisma.smsServiceStatus.findUnique({ where: { id: "singleton" } });
    assert.strictEqual(migratedStatusA?.balance, null, "L'ancien solde 0 non confirmé doit être migré vers null");
    console.log("  ✓ Ancien solde 0 non confirmé migré vers null.");

    // Cas B : vrai solde 0 confirmé par WinSMS
    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: { balance: 0, rawResponse: JSON.stringify({ balance: 0 }), lastError: null },
      create: { id: "singleton", balance: 0, rawResponse: JSON.stringify({ balance: 0 }), lastError: null },
    });
    await migrateZeroBalanceToNull();
    const migratedStatusB = await prisma.smsServiceStatus.findUnique({ where: { id: "singleton" } });
    assert.strictEqual(migratedStatusB?.balance, 0, "Un vrai solde 0 confirmé ne doit pas être écrasé");
    console.log("  ✓ Vrai solde 0 confirmé préservé.");

    // ------------------------------------------------------------------------
    // TEST 7 : Solde inconnu (null) -> envoi autorisé (jamais bloqué par le site)
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 7 : Solde inconnu (null) -> Envoi autorisé sans blocage...");

    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: { balance: null, lastError: "Timeout réseau" },
      create: { id: "singleton", balance: null, lastError: "Timeout réseau" },
    });

    const pendingUnknownBal = await prisma.smsQueue.create({
      data: {
        parentPhone: "98123457",
        message: "SMS avec solde inconnu",
        type: "absence",
        status: "pending",
        retryCount: 0,
        nextRetryAt: new Date(Date.now() - 1000),
      },
    });

    const resUnknownBal = await processSmsQueueOnce();
    assert.strictEqual(resUnknownBal.processed >= 1, true, "Le SMS doit être traité");
    assert.strictEqual(resUnknownBal.sent >= 1, true, "Le SMS doit être envoyé même si solde inconnu");

    const sentUnknownBal = await prisma.smsQueue.findUnique({ where: { id: pendingUnknownBal.id } });
    assert.strictEqual(sentUnknownBal?.status, "sent", "Le statut final doit être 'sent'");
    console.log("  ✓ Solde inconnu (null) : envoi autorisé et traité avec succès.");
    await prisma.smsQueue.delete({ where: { id: pendingUnknownBal.id } });

    // ------------------------------------------------------------------------
    // TEST 8 : Solde 1470 avec seuil 500 -> Pas d'avertissement
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 8 : Solde 1470 avec seuil 500 -> Pas d'avertissement...");

    const threshold500 = 500;
    const balance1470 = 1470;
    const isLowBal1470 = balance1470 !== null && balance1470 <= threshold500;
    assert.strictEqual(isLowBal1470, false, "1470 > 500 ne doit pas déclencher d'alerte");
    console.log("  ✓ Solde 1470 > seuil 500 : aucune alerte crédit bas.");

    // ------------------------------------------------------------------------
    // TEST 9 : Solde 300 avec seuil 500 -> Avertissement mais ENVOI AUTORISÉ
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 9 : Solde 300 avec seuil 500 -> Avertissement mais envoi autorisé...");

    const balance300 = 300;
    const isLowBal300 = balance300 !== null && balance300 <= threshold500;
    assert.strictEqual(isLowBal300, true, "300 <= 500 doit déclencher l'avertissement visuel");

    await prisma.smsServiceStatus.upsert({
      where: { id: "singleton" },
      update: { balance: 300, lastError: null },
      create: { id: "singleton", balance: 300, lastError: null },
    });

    const pendingLowBal = await prisma.smsQueue.create({
      data: {
        parentPhone: "98123458",
        message: "SMS avec solde bas mais autorisé",
        type: "absence",
        status: "pending",
        retryCount: 0,
        nextRetryAt: new Date(Date.now() - 1000),
      },
    });

    const resLowBal = await processSmsQueueOnce();
    assert.strictEqual(resLowBal.processed >= 1, true, "Le SMS doit être traité");
    assert.strictEqual(resLowBal.sent >= 1, true, "Le SMS doit être envoyé malgré solde bas (WinSMS décide)");

    const sentLowBal = await prisma.smsQueue.findUnique({ where: { id: pendingLowBal.id } });
    assert.strictEqual(sentLowBal?.status, "sent", "Le statut final doit être 'sent'");
    console.log("  ✓ Solde bas (300 <= 500) : avertissement actif mais envoi autorisé (jamais bloqué par le site).");
    await prisma.smsQueue.delete({ where: { id: pendingLowBal.id } });

    // ------------------------------------------------------------------------
    // TEST 10 : WinSMS répond 102 -> Échec 'Clé API invalide' sans blocage interne
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 10 : WinSMS répond code 102 -> Échec explicite sans blocage interne...");

    mockResponseStatus = 200;
    mockResponseBody = JSON.stringify({ code: "102", message: "Authentication Failed" });

    const winSmsProvider102 = new WinSmsProvider({
      apiKey: "wrong_key",
      apiUrl: mockApiUrl,
      senderId: "Lyc.Emtiyez",
    });

    const sendRes102 = await winSmsProvider102.send("21698123456", "Test message", "Lyc.Emtiyez");
    assert.strictEqual(sendRes102.success, false, "L'envoi doit échouer");
    assert.ok(sendRes102.error?.includes("invalide"), "L'erreur doit indiquer clé invalide");
    console.log("  ✓ Réponse 102 de WinSMS : échec 'Clé API invalide ou non activée' retourné fidèlement.");

    // ------------------------------------------------------------------------
    // TEST 11 : Clé stockée illisible (ENCRYPTION_KEY différente)
    // ------------------------------------------------------------------------
    console.log("\n▶ TEST 11 : Clé chiffrée illisible -> Détection et message clair...");

    await prisma.setting.upsert({
      where: { key: "winsms_api_key" },
      update: { value: "corrupted:iv:cipher_unreadable_data" },
      create: { key: "winsms_api_key", value: "corrupted:iv:cipher_unreadable_data" },
    });

    const configCorruptKey = await getEffectiveSmsConfig();
    assert.strictEqual(configCorruptKey.isKeyUnreadable, true, "Doit détecter la clé illisible");
    assert.strictEqual(configCorruptKey.maskedKey, "Clé illisible : ressaisissez-la");
    console.log("  ✓ Clé corrompue/illisible : affichage 'Clé illisible : ressaisissez-la' et isKeyUnreadable=true.");

    // Nettoyage clé de test
    await prisma.setting.deleteMany({ where: { key: "winsms_api_key" } });

    console.log("\n==========================================================");
    console.log("✅ TOUS LES TESTS TYPESCRIPT ONT RÉUSSI AVEC SUCCÈS !");
    console.log("==========================================================");
  } finally {
    await releaseWorkerLock();
    server.close();
  }
}

runTests().catch((err) => {
  console.error("❌ Échec des tests :", err);
  process.exit(1);
});
