const functions = require('firebase-functions/v1');
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const cors = require('cors')({origin: true});

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
   You are the intelligent assistant for PraxiHub, a university internship management platform.
   Your goal is to guide Students, Coordinators, and Companies through the app.
   You must answer in the user's language (mostly Czech/Slovak).

   KEY KNOWLEDGE BASE (SYSTEM FEATURES):

   1. GENERAL:
      - There is a "Manuál" page at \`/manual\` with detailed guides.
      - The app uses AI (Gemini) to validate contracts automatically.

   2. FOR STUDENTS:
      - Process: Request Company Approval -> Wait -> Generate Contract (PDF) -> Sign -> Upload -> Wait for Final Approval.
      - **New Feature:** If you made a mistake or need a new contract, use the "+ Nová smlouva / Opravit" button in the Header (always visible).
      - **Dashboard:** Shows a timeline. Green banner means success.

   3. FOR COORDINATORS (ADMINS):
      - **New Analytics:** The Dashboard now shows "Semester Progress" (Progress bar) and "Top Partners" at the top.
      - **Export:** There is an "Exportovat CSV" button in the header to download all data for reporting.
      - **Action:** You approve Companies first, then Contracts. Use the filter cards to see what needs attention ("Žádosti o schválení", "Čeká na kontrolu").

   4. FOR COMPANIES:
      - **Unified Detail:** Clicking a student row opens a Modal.
      - **Contracts:** In this Modal, you can download the student's contract (Blue button "Stáhnout smlouvu").
      - **Rating:** In the same Modal, you can rate the student (Stars + Review) at the end of the internship.

   BEHAVIOR:
   - Be concise and helpful.
   - If a user is stuck, suggest the specific button or page mentioned above.
   - If asked about reports, mention the "Exportovat CSV" feature.
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

// 4. GENERATE CONTRACT PDF
exports.createContractPDF = functions.runWith({ memory: '512MB', timeoutSeconds: 60 }).https.onRequest((req, res) => {
  cors(req, res, async () => {
    console.log("Starting createContractPDF");

    // Authenticate Request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send('Unauthorized');
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.error("Error verifying token:", e);
      return res.status(401).send('Unauthorized');
    }
    const uid = decodedToken.uid;

    const data = req.body.data || req.body;
    const { studentName, companyName, ico, startDate, endDate, position } = data;
    if (!studentName || !companyName || !ico || !startDate || !endDate || !position) {
      return res.status(400).send({ error: 'Missing required fields.' });
    }

    // Track execution step for better debugging
    let step = "Initialization";

    try {
      console.log("Loading dependencies (pdf-lib)...");
      const { PDFDocument, rgb } = require('pdf-lib');
      const fontkit = require('@pdf-lib/fontkit');
      console.log("Dependencies loaded.");

      // Fetch font supporting Latin-2 (Czech)
      const fontUrl = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.ttf';
      const fontResponse = await axios.get(fontUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      step = "PDF Creation";
      const pdfDoc = await PDFDocument.create();

      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontResponse.data);

      step = "Adding Page and Text";
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;

      const drawText = (text, x, y, size = fontSize) => {
          page.drawText(text, {
              x,
              y,
              size,
              font: customFont,
              color: rgb(0, 0, 0),
          });
      };

      let yPosition = height - 50;

      drawText('Smlouva o praxi', 50, yPosition, 20);
      yPosition -= 40;

      drawText(`Student: ${studentName}`, 50, yPosition);
      yPosition -= 20;
      drawText(`Společnost: ${companyName}`, 50, yPosition);
      yPosition -= 20;
      drawText(`IČO: ${ico}`, 50, yPosition);
      yPosition -= 20;
      drawText(`Pozice: ${position}`, 50, yPosition);
      yPosition -= 20;
      drawText(`Termín: ${startDate} - ${endDate}`, 50, yPosition);
      yPosition -= 40;

      drawText('Potvrzujeme, že student vykoná praxi ve výše uvedeném rozsahu.', 50, yPosition);
      yPosition -= 20;
      drawText('Tato smlouva je generována automaticky aplikací PraxiHub.', 50, yPosition);

      step = "PDF Serialization";
      const pdfBytes = await pdfDoc.save();
      console.log("PDF generated successfully.");

      // Upload to Firebase Storage
      step = "Storage Upload";
      console.log("Uploading to Storage...");
      const bucket = admin.storage().bucket("praxihub-app.firebasestorage.app");
      console.log("Bucket name:", bucket.name); // Debug log as requested

      const fileName = `generated_contract_${Date.now()}.pdf`;
      const filePath = `contracts/${uid}/${fileName}`;
      const file = bucket.file(filePath);

      await file.save(pdfBytes, {
        metadata: {
          contentType: 'application/pdf',
        },
      });
      console.log("PDF uploaded.");

      // Make the file publicly accessible via a long-lived download URL (token based)
      // Using the uuid approach for client SDK compatibility
      // We generate a random string for the token.
      const uuid = Math.random().toString(36).substring(2) + Date.now().toString(36);

      await file.setMetadata({
        metadata: {
          firebaseStorageDownloadTokens: uuid,
        },
      });

      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${uuid}`;
      console.log("Download URL generated:", downloadURL);

      // Return data in a format similar to what httpsCallable expects if possible, or just JSON
      // httpsCallable expects { data: ... }
      return res.status(200).json({ data: { downloadURL, fileName } });

    } catch (error) {
      console.error("Error generating PDF:", error);
      return res.status(500).json({
        error: "PDF Generation Failed",
        details: error.message,
        code: error.code // helpful for storage errors
      });
    }
  });
});

// 5. AI MATCHMAKING
exports.findMatches = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  }

  const studentId = context.auth.uid;

  try {
    const userDoc = await admin.firestore().collection('users').doc(studentId).get();
    const userData = userDoc.data();
    const studentSkills = userData.skills || []; // Array of strings

    if (!studentSkills.length) {
       return { matches: [], message: "Zatím nemáte vyplněné dovednosti. Přidejte je na svém profilu." };
    }

    // Fetch companies (users with companyIco)
    // Using orderBy filter to get docs where companyIco exists
    const companiesSnapshot = await admin.firestore().collection('users')
      .orderBy('companyIco')
      .get();

    const companies = [];
    companiesSnapshot.forEach(doc => {
      const d = doc.data();
      if (d.companyIco) {
        companies.push({
          id: doc.id,
          name: d.displayName || d.email || "Neznámá firma",
          lookingFor: d.lookingFor || [], // Array of strings
          description: d.description || "",
          email: d.email
        });
      }
    });

    if (companies.length === 0) {
      return { matches: [], message: "Zatím se neregistrovaly žádné firmy." };
    }

    // Prepare prompt for Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      Jsi expert na HR a párování uchazečů.

      Student má tyto dovednosti: ${studentSkills.join(", ")}.

      Zde je seznam firem a co hledají:
      ${JSON.stringify(companies.map(c => ({
        id: c.id,
        name: c.name,
        lookingFor: c.lookingFor
      })))}

      Úkol:
      Porovnej studentovy dovednosti s požadavky firem.
      Vrať JSON pole objektů (seřazené od nejlepší shody po nejhorší), kde každý objekt má:
      - companyId (ID firmy ze vstupu)
      - matchScore (číslo 0-100)
      - reasoning (stručné vysvětlení v češtině, proč se hodí/nehodí - max 2 věty)

      Vrať pouze čistý JSON, žádný markdown.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const matches = JSON.parse(text);

    // Merge back with company details
    const detailedMatches = matches.map(m => {
      const company = companies.find(c => c.id === m.companyId);
      return {
        ...m,
        companyName: company?.name || "Unknown",
        companyEmail: company?.email || "",
        lookingFor: company?.lookingFor || []
      };
    });

    return { matches: detailedMatches };

  } catch (error) {
    console.error("Matchmaking error:", error);
    // Even if AI fails, return empty list or error
    throw new functions.https.HttpsError('internal', 'Nepodařilo se provést AI párování.');
  }
});
