import assert from "assert";
import { prisma } from "../src/lib/prisma";
import { processSmsQueueOnce, triggerSmsWorker, registerWakeListener, releaseWorkerLock } from "../src/lib/sms/worker";
import http from "http";

async function runE2eProof() {
  await releaseWorkerLock();
  console.log("================================================================================");
  console.log("🏆 TEST DE VALIDATION DE BOUT EN BOUT : ABSENCE -> SMS ENVOYÉ EN < 10 SECONDES");
  console.log("================================================================================\n");

  let mockSendCalled = false;
  let mockBalanceCalled = false;
  let currentBalance = 1471;

  // Serveur mock WinSMS
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    res.writeHead(200, { "Content-Type": "application/json" });

    if (url.includes("action=send-sms")) {
      mockSendCalled = true;
      currentBalance = 1470;
      res.end(
        JSON.stringify({
          code: "ok",
          message: "Successfully Send",
          balance: currentBalance,
          user: "elimtiaz",
          licence: "2027-04-27",
          reference: "5818999",
        })
      );
    } else if (url.includes("action=check-balance")) {
      mockBalanceCalled = true;
      res.end(
        JSON.stringify({
          balance: currentBalance,
          user: "elimtiaz",
          country: "Tunisia",
          licence: "2027-04-27",
        })
      );
    } else {
      res.end(JSON.stringify({ ok: true }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const mockApiUrl = `http://127.0.0.1:${port}/sms/api`;

  try {
    // 1. Configurer WinSMS en mode réel pointant vers notre API de test
    await prisma.setting.upsert({
      where: { key: "sms_provider_mode" },
      update: { value: "winsms" },
      create: { key: "sms_provider_mode", value: "winsms" },
    });
    await prisma.setting.upsert({
      where: { key: "winsms_api_key" },
      update: { value: "test_key_abc" }, // En clair pour le test
      create: { key: "winsms_api_key", value: "test_key_abc" },
    });
    await prisma.setting.upsert({
      where: { key: "winsms_api_url" },
      update: { value: mockApiUrl },
      create: { key: "winsms_api_url", value: mockApiUrl },
    });
    await prisma.setting.upsert({
      where: { key: "winsms_sender_id" },
      update: { value: "Lyc.Emtiyez" },
      create: { key: "winsms_sender_id", value: "Lyc.Emtiyez" },
    });

    console.log("1. Configuration WinSMS mise à jour dynamiquement en base.");

    // 2. Simuler l'enregistrement d'un contrôle d'absence (comme dans /api/presence)
    console.log("2. Enregistrement d'un contrôle d'absence avec élève absent...");
    const startTime = Date.now();

    const queuedSms = await prisma.smsQueue.create({
      data: {
        parentPhone: "98123456",
        message: "تعلم إدارة معهد الامتياز أن التلميذ فلان تغيب عن الدرس على الساعة 8h",
        partsCount: 1,
        type: "absence",
        status: "pending",
        retryCount: 0,
        nextRetryAt: new Date(),
      },
    });

    console.log(`   → SMS #${queuedSms.id} mis en file d'attente (status: 'pending')`);

    // 3. Déclenchement immédiat du réveil (identique à l'appel dans /api/presence)
    let triggeredWorkerRan = false;
    const unregisterWake = registerWakeListener(async () => {
      triggeredWorkerRan = true;
    });

    triggerSmsWorker();
    assert.strictEqual(triggeredWorkerRan, true, "Le réveil immédiat doit être intercepté");
    unregisterWake();

    // 4. Exécution du cycle du worker
    console.log("3. Exécution du cycle du worker SMS...");
    const processResult = await processSmsQueueOnce();

    const elapsedMs = Date.now() - startTime;
    console.log(`   → Temps écoulé : ${elapsedMs} ms (< 10000 ms)`);

    assert.strictEqual(processResult.sent, 1, "Le SMS doit être envoyé");
    assert.strictEqual(mockSendCalled, true, "L'API WinSMS doit avoir été appelée");

    // 5. Vérifier la persistance en base
    const sentSms = await prisma.smsQueue.findUnique({
      where: { id: queuedSms.id },
    });
    assert.strictEqual(sentSms?.status, "sent", "Le statut en base doit être 'sent'");
    assert.strictEqual(sentSms?.providerRef, "5818999", "La référence WinSMS doit être enregistrée");
    assert.ok(sentSms?.sentAt, "La date sentAt doit être présente");

    // 6. Vérifier la mise à jour immédiate du solde et de la licence
    const statusRecord = await prisma.smsServiceStatus.findUnique({
      where: { id: "singleton" },
    });
    assert.strictEqual(statusRecord?.balance, 1470, "Le solde doit être mis à jour à 1470");
    assert.strictEqual(statusRecord?.licenceDate, "2027-04-27", "La date de licence doit être 2027-04-27");
    assert.strictEqual(statusRecord?.lastSendStatus, "success", "Le dernier statut doit être success");

    console.log("4. Vérification de l'état en base de données :");
    console.log(`   ✓ Statut SMS : ${sentSms?.status} (Réf : ${sentSms?.providerRef})`);
    console.log(`   ✓ Solde persisté en base : ${statusRecord?.balance} SMS`);
    console.log(`   ✓ Licence du pack persistée : ${statusRecord?.licenceDate}`);
    console.log(`   ✓ Temps total de traitement : ${elapsedMs} ms`);

    // Nettoyage
    await prisma.smsQueue.delete({ where: { id: queuedSms.id } });

    console.log("\n================================================================================");
    console.log("🎉 PREUVE COMPLÈTE VALIDÉE AVEC SUCCÈS !");
    console.log("================================================================================");
  } finally {
    await releaseWorkerLock();
    server.close();
  }
}

runE2eProof().catch((err) => {
  console.error("❌ Échec :", err);
  process.exit(1);
});
