const functions = require('firebase-functions/v1');
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

// 1. AI ANALÝZA ZMLUVY
exports.analyzeContract = functions.firestore
  .document("internships/{docId}")
  .onWrite(async (change, context) => { 
    if (!change.after.exists) return null;

    const newData = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;

    const isNew = !previousData;
    const statusChanged = previousData && previousData.status !== "ANALYZING";
    const shouldRun = newData.status === "ANALYZING" && (isNew || statusChanged);

    if (shouldRun) {
      console.log(`🚀 Začínam analýzu pre: ${context.params.docId}`);

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const fileUrl = newData.contract_url;
        if (!fileUrl) throw new Error("Chýba URL zmluvy");

        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const base64File = Buffer.from(response.data).toString("base64");
        const mimeType = fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg";

        const prompt = `
          Analyzuj túto zmluvu o praxi.
          Vráť IBA validný JSON objekt (čistý text bez formátovania kódu) s kľúčmi:
          {
            "organization_name": "Názov firmy (String)",
            "organization_ico": "IČO firmy (String - iba čísla, bez medzier)",
            "start_date": "YYYY-MM-DD (String alebo null)",
            "end_date": "YYYY-MM-DD (String alebo null)"
          }
          Nájdi názov organizácie, jej IČO (identifikačné číslo), dátum začiatku a konca praxe. 
          Ak IČO nevieš nájsť, skús hľadať 8-miestne číslo označené ako IČO. Ak údaj chýba, daj null.
        `;

        const result = await model.generateContent([prompt, { inlineData: { data: base64File, mimeType: mimeType } }]);
        const cleanJson = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const extractedData = JSON.parse(cleanJson);

        // Zmena: Nastavíme status na NEEDS_REVIEW, aby to študent skontroloval
        await change.after.ref.update({
          organization_name: extractedData.organization_name || "Neznáma firma",
          organization_ico: extractedData.organization_ico || null,
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          status: "NEEDS_REVIEW", 
          ai_analysis_result: cleanJson,
          is_verified: false
        });

      } catch (error) {
        console.error("❌ Chyba pri analýze:", error);
        await change.after.ref.update({ 
            status: "REJECTED", 
            ai_error_message: error.message 
        });
      }
    }
    return null;
  });

// 2. NOTIFIKÁCIE (Vyžaduje Firebase Extension: Trigger Email)
exports.sendEmailNotification = functions.firestore
  .document("internships/{docId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    if (newData.status !== previousData.status) {
      const emailDoc = {
        to: newData.studentEmail,
        message: {
          subject: `PraxiHub: Zmena stavu zmluvy na ${newData.status}`,
          text: `Ahoj, stav tvojej zmluvy sa zmenil na: ${newData.status}. Skontroluj si dashboard.`,
          html: `<p>Ahoj,</p><p>stav tvojej zmluvy sa zmenil na: <strong>${newData.status}</strong>.</p><p><a href="https://praxihub-app.web.app">Prejsť na Dashboard</a></p>`
        }
      };

      // Zapíšeme do kolekcie 'mail', ktorú sleduje rozšírenie
      await admin.firestore().collection("mail").add(emailDoc);
      console.log(`📧 E-mail požiadavka vytvorená pre: ${newData.studentEmail}`);
    }
    return null;
  });
