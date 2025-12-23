const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

admin.initializeApp();

exports.analyzeContract = functions.firestore
  .document("internships/{docId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    // Spusti len ak sa stav zmenil na ANALYZING
    if (newData.status === "ANALYZING" && previousData.status !== "ANALYZING") {
      console.log(`Začínam analýzu pre: ${context.params.docId}`);

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
          Vráť IBA validný JSON objekt s kľúčmi:
          {
            "organization_name": "Názov firmy",
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD"
          }
          Ak údaj chýba, daj null.
        `;

        const result = await model.generateContent([prompt, { inlineData: { data: base64File, mimeType: mimeType } }]);
        const cleanJson = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const extractedData = JSON.parse(cleanJson);

        await change.after.ref.update({
          organization_name: extractedData.organization_name || "Neznáma firma",
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          status: "COMPLETED",
          ai_analysis_result: cleanJson
        });

      } catch (error) {
        console.error("Chyba:", error);
        await change.after.ref.update({ status: "ERROR_ANALYSIS", ai_error_message: error.message });
      }
    }
  });
