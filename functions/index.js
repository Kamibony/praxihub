const functions = require('firebase-functions/v1');
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

if (!admin.apps.length) { admin.initializeApp(); }

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
      console.log(`Starting analysis for: ${context.params.docId}`);
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); // Check model availability

        const fileUrl = newData.contract_url;
        if (!fileUrl) throw new Error("Missing Contract URL");

        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const base64File = Buffer.from(response.data).toString("base64");
        const mimeType = fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg";

        const prompt = `Analyze this internship contract. Return ONLY valid JSON with keys: {"organization_name": "String", "organization_ico": "String (numbers only)", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}. If ICO is missing, try to find an 8-digit ID number.`;

        const result = await model.generateContent([prompt, { inlineData: { data: base64File, mimeType: mimeType } }]);
        const cleanJson = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const extractedData = JSON.parse(cleanJson);

        await change.after.ref.update({
          organization_name: extractedData.organization_name || "Unknown",
          organization_ico: extractedData.organization_ico || null,
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          status: "APPROVED", 
          ai_analysis_result: cleanJson,
          is_verified: true
        });
      } catch (error) {
        console.error("Analysis failed:", error);
        await change.after.ref.update({ status: "REJECTED", ai_error_message: error.message });
      }
    }
    return null;
  });
