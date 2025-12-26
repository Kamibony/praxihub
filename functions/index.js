const functions = require('firebase-functions/v1');
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// Inicializácia iba ak ešte nebeží
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.analyzeContract = functions.firestore
  .document("internships/{docId}")
  .onWrite(async (change, context) => { 
    
    // Ak bol dokument vymazaný, nerob nič
    if (!change.after.exists) return null;

    const newData = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;

    // Logika spúšťania:
    // Spusti funkciu LEN ak:
    // A) Dokument je úplne nový (isNew) A jeho status je 'ANALYZING'
    // ALEBO
    // B) Dokument už existoval, ale status sa ZMENIL na 'ANALYZING'
    
    const isNew = !previousData;
    const statusChanged = previousData && previousData.status !== "ANALYZING";
    const shouldRun = newData.status === "ANALYZING" && (isNew || statusChanged);

    if (shouldRun) {
      console.log(`🚀 Začínam analýzu pre: ${context.params.docId} (Model: gemini-2.5-pro)`);

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const fileUrl = newData.contract_url;
        if (!fileUrl) throw new Error("Chýba URL zmluvy");

        // Stiahnutie súboru
        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const base64File = Buffer.from(response.data).toString("base64");
        
        // Detekcia typu súboru
        const mimeType = fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg";

        // --- PROMPT S INŠTRUKCIOU PRE IČO ---
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
        
        // Čistenie odpovede (odstránenie markdown značiek ak tam náhodou sú)
        const textResponse = result.response.text();
        const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        
        console.log("Gemini odpoveď:", cleanJson);
        
        const extractedData = JSON.parse(cleanJson);

        // Zápis výsledku do databázy vrátane IČO
        await change.after.ref.update({
          organization_name: extractedData.organization_name || "Neznáma firma",
          organization_ico: extractedData.organization_ico || null, // Ukladáme IČO
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          status: "APPROVED", 
          ai_analysis_result: cleanJson,
          is_verified: true
        });

        console.log(`✅ Analýza úspešná: ${extractedData.organization_name} (IČO: ${extractedData.organization_ico})`);

      } catch (error) {
        console.error("❌ Chyba pri analýze:", error);
        await change.after.ref.update({ 
            status: "REJECTED", 
            ai_error_message: error.message 
        });
      }
    } else {
        return null;
    }
  });
