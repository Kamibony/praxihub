const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const COLLECTION = "placements";
// Using a reliable Google Storage URL to avoid 403 Forbidden errors from external sites
const TEST_URL = "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf";

async function runTest() {
  console.log("🚀 Spúšťam vylepšený integračný test...");

  const docRef = db.collection(COLLECTION).doc();
  const testData = {
    contract_url: TEST_URL,
    status: "UPLOADED",
    created_at: new Date()
  };

  try {
    await docRef.set(testData);
    console.log(`📄 Dokument vytvorený: ${docRef.id}`);

    await docRef.update({ status: "ANALYZING" });
    console.log("⏳ Status zmenený na ANALYZING. Čakám na AI...");

    let attempts = 0;
    const maxAttempts = 30;

    const checkStatus = setInterval(async () => {
      attempts++;
      const snap = await docRef.get();

      if (!snap.exists) {
        clearInterval(checkStatus);
        console.error("❌ CHYBA: Dokument zmizol počas testu!");
        process.exit(1);
      }

      const data = snap.data();
      process.stdout.write(`\r... Pokus ${attempts}/${maxAttempts} | Status: ${data.status}   `);

      // 1. SCENÁR: ÚSPECH
      if (data.status === "COMPLETED") {
        clearInterval(checkStatus);
        console.log("\n\n✅ TEST ÚSPEŠNÝ!");
        console.log("------------------------------------------------");
        console.log("Výsledok analýzy:");
        console.log(`🏢 Firma: ${data.organization_name}`);
        console.log(`📅 Od: ${data.start_date}`);
        console.log(`📅 Do: ${data.end_date}`);
        console.log("------------------------------------------------");
        await cleanup(docRef);
      }
      // 2. SCENÁR: CHYBA BACKENDU (Toto chceme vidieť v logoch)
      else if (data.status === "ERROR_ANALYSIS") {
        clearInterval(checkStatus);
        console.error("\n\n❌ TEST ZLYHAL: Backend vrátil chybu.");
        console.error("================================================");
        console.error("CHYBOVÁ SPRÁVA Z DATABÁZY:");
        console.error(data.ai_error_message || "Žiadna chybová správa v poli 'ai_error_message'");
        console.error("================================================");
        process.exit(1);
      }
      // 3. SCENÁR: TIMEOUT
      else if (attempts >= maxAttempts) {
        clearInterval(checkStatus);
        console.error("\n\n⏰ TEST TIMEOUT: Žiadna odpoveď do 30 sekúnd.");
        process.exit(1);
      }
    }, 1000);

  } catch (error) {
    console.error("\n❌ KRITICKÁ CHYBA SKRIPTU:", error);
    process.exit(1);
  }
}

async function cleanup(docRef) {
  try {
    await docRef.delete();
    console.log("🧹 Testovacie dáta vymazané.");
    process.exit(0);
  } catch (e) {
    console.error("Chyba pri čistení:", e);
    process.exit(0);
  }
}

runTest();