const functions = require("firebase-functions");
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
    // ZMENA 1: Používame onWrite, aby sme zachytili vytvorenie AJ úpravu
    
    // Ak bol dokument vymazaný, nerob nič
    if (!change.after.exists) return null;

    const newData = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;

    // ZMENA 2: Logika spúšťania
    // Spusti ak:
    // A) Je to nový dokument (isNew) A status je 'ANALYZING'
    // B) Status sa zmenil na 'ANALYZING' (napr. pri reštarte procesu)
    
    const isNew = !previousData;
    const statusChanged = previousData && previousData.status !== "ANALYZING";
    const shouldRun = newData.status === "ANALYZING" && (isNew || statusChanged);

    if (shouldRun) {
      console.log(`🚀 Začínam analýzu pre: ${context.params.docId} (Model: gemini-2.5-pro)`);

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // ZMENA 3: Vrátená verzia podľa vášho želania
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const fileUrl = newData.contract_url;
        if (!fileUrl) throw new Error("Chýba URL zmluvy");

        // Stiahnutie súboru
        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const base64File = Buffer.from(response.data).toString("base64");
        
        // Detekcia typu súboru (PDF alebo Obrázok)
        const mimeType = fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg";

        const prompt = `
          Analyzuj túto zmluvu o praxi.
          Vráť IBA validný JSON objekt (bez markdown formátovania ```json) s kľúčmi:
          {
            "organization_name": "Názov firmy (String)",
            "start_date": "YYYY-MM-DD (String alebo null)",
            "end_date": "YYYY-MM-DD (String alebo null)"
          }
          Nájdi názov organizácie, dátum začiatku a konca praxe. Ak údaj chýba, daj null.
        `;

        const result = await model.generateContent([prompt, { inlineData: { data: base64File, mimeType: mimeType } }]);
        
        // Čistenie odpovede (odstránenie ```json a ``` ak tam sú)
        const textResponse = result.response.text();
        const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        
        console.log("Gemini odpoveď:", cleanJson);
        
        const extractedData = JSON.parse(cleanJson);

        // Zápis výsledku do databázy
        await change.after.ref.update({
          organization_name: extractedData.organization_name || "Neznáma firma",
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          status: "APPROVED", // Alebo COMPLETED, podľa toho ako to chcete v appke
          ai_analysis_result: cleanJson,
          is_verified: true
        });

        console.log(`✅ Analýza úspešná: ${extractedData.organization_name}`);

      } catch (error) {
        console.error("❌ Chyba pri analýze:", error);
        // Zapíšeme chybu do databázy, aby sme to videli v appke
        await change.after.ref.update({ 
            status: "REJECTED", 
            ai_error_message: error.message 
        });
      }
    } else {
        return null;
    }
  });
