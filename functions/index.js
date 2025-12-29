const functions = require('firebase-functions/v1');
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

// 1. AI ANALÝZA ZMLUVY
// Spustí sa, keď sa vytvorí/upraví dokument a status je 'ANALYZING'
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
        // Používame gemini-1.5-pro alebo 2.0-flash podľa dostupnosti, tu je 2.5-pro z promptu
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const fileUrl = newData.contract_url;
        if (!fileUrl) throw new Error("Chýba URL zmluvy");

        // Stiahnutie súboru
        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const base64File = Buffer.from(response.data).toString("base64");
        const mimeType = fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg";

        // Prompt pre Gemini
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

        // Nastavíme status na NEEDS_REVIEW, aby to študent skontroloval
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
// Sleduje zmeny statusov a posiela e-maily
exports.sendEmailNotification = functions.firestore
  .document("internships/{docId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    // Ak sa zmenil status, pošleme mail
    if (newData.status !== previousData.status) {
      const emailDoc = {
        to: newData.studentEmail,
        message: {
          subject: `PraxiHub: Zmena stavu zmluvy na ${newData.status}`,
          text: `Ahoj, stav tvojej zmluvy sa zmenil na: ${newData.status}. Skontroluj si dashboard.`,
          html: `<p>Ahoj,</p><p>stav tvojej zmluvy sa zmenil na: <strong>${newData.status}</strong>.</p><p><a href="https://praxihub-app.web.app">Prejsť na Dashboard</a></p>`
        }
      };

      // Zapíšeme do kolekcie 'mail', ktorú sleduje rozšírenie Trigger Email
      await admin.firestore().collection("mail").add(emailDoc);
      console.log(`📧 E-mail požiadavka vytvorená pre: ${newData.studentEmail}`);
    }
    return null;
  });

// 3. AI CHATBOT (Sprievodca)
// Volateľná funkcia z frontendu (Webu)
exports.chatWithAI = functions.https.onCall(async (data, context) => {
  // data obsahuje: { message: "Otázka užívateľa", role: "student/company/..." }
  
  const userMessage = data.message;
  const userRole = data.role || "visitor"; 

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Systémové inštrukcie pre Chatbota
    const systemPrompt = `
      Jsi nápověda a virtuální asistent pro aplikaci PraxiHub. Odpovídej stručně, mile a v češtině.
      
      Tvoje role: Pomáhat uživatelům pochopit, jak systém funguje.
      Aktuální uživatel je: ${userRole === 'student' ? 'Student' : userRole === 'company' ? 'Firma' : userRole === 'coordinator' ? 'Koordinátor' : 'Návštěvník webu'}.

      Znalostní báze PraxiHub:
      1. PRO STUDENTY:
         - Mohou se zaregistrovat a nahrát smlouvu o praxi (PDF nebo fotku).
         - AI automaticky přečte údaje ze smlouvy.
         - Student musí zkontrolovat údaje a potvrdit je (stav 'NEEDS_REVIEW' -> 'APPROVED').
         - Vidí stav schválení na svém dashboardu.
      
      2. PRO FIRMY:
         - Přihlašují se a zadají své IČO.
         - Vidí seznam všech studentů, kteří u nich mají schválenou praxi (párování probíhá automaticky přes IČO).
         - Mohou si zobrazit detaily a stáhnout smlouvy.
      
      3. PRO KOORDINÁTORY (ŠKOLA):
         - Mají přehled o všech praxích.
         - Vidí, které smlouvy jsou schválené a které zamítnuté.
         - Mohou řešit problémy.

      Pokud se uživatel zeptá na technický problém, poraď mu kontaktovat podporu na podpora@praxihub.cz.
      Nikdy si nevymýšlej funkce, které systém nemá.
    `;

    // Spustenie chatu
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "Rozumím. Jsem připraven pomáhat uživatelům PraxiHubu v češtině." }],
        },
      ],
    });

    const result = await chat.sendMessage(userMessage);
    return { response: result.response.text() };

  } catch (error) {
    console.error("Chatbot Error:", error);
    // Vrátime chybu frontend klientovi
    throw new functions.https.HttpsError('internal', 'AI momentálně neodpovídá.');
  }
});
