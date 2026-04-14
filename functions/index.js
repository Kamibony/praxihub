const functions = require('firebase-functions/v1');
const admin = require("firebase-admin");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
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
  console.log("Starting matchmaking for:", studentId);

  // Step 1: Auth & Data Fetch
  let userData;
  try {
    const userDoc = await admin.firestore().collection('users').doc(studentId).get();
    if (!userDoc.exists) {
       return { matches: [], message: "Profil uživatele nebyl nalezen. Kontaktujte podporu." };
    }
    userData = userDoc.data();

    // Step 1: Deep Logging (Debug)
    console.log("RAW User Data:", JSON.stringify(userData));
    console.log("RAW Skills Field:", userData.skills);
  } catch (err) {
    console.error("Firestore Fetch Error:", err);
    throw new functions.https.HttpsError('internal', "Failed to fetch user profile.");
  }

  // Step 2: Stricter Skill Validation
  let studentSkills = [];
  if (Array.isArray(userData.skills)) {
    studentSkills = userData.skills
      .map(s => String(s).trim())
      .filter(s => s.length > 1); // Filter out single chars or empty strings
  }
  console.log("VALIDATED Student Skills:", studentSkills);

  if (studentSkills.length === 0) {
    console.log("ABORT: No valid skills found.");
    return { matches: [], message: "Nemáte vyplněné žádné dovednosti. Pro získání doporučení si prosím doplňte profil." };
  }

  // Step 4: Env Validation
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment.");

  try {
    // Step 3: Company Validation
    const companiesSnapshot = await admin.firestore().collection('users')
      .orderBy('companyIco')
      .get();

    const companies = companiesSnapshot.docs.map(doc => {
      const d = doc.data();
      // Skip empty companies
      if (!d.companyIco) return null;
      if (!d.description && (!d.lookingFor || d.lookingFor.length === 0)) return null;

      return {
        id: doc.id,
        name: d.displayName || d.email || "Neznámá firma",
        lookingFor: d.lookingFor || [], // Array of strings
        description: d.description || "",
        email: d.email
      };
    }).filter(c => c !== null);

    if (companies.length === 0) {
      return { matches: [], message: "Zatím tu nejsou žádné firmy s popisem práce." };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      You are a strict matchmaking engine. use ONLY the provided JSON data. DO NOT invent or assume any skills or requirements not explicitly listed. If a profile is empty, ignore it.

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

    let matches;
    try {
        matches = JSON.parse(text);
    } catch (parseError) {
        console.error("AI JSON Parse Error. Raw text:", text);
        throw new Error("AI returned invalid JSON");
    }

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
    // Step 6: Transparent Error Handling
    console.error("Matchmaking Critical Fail:", error);
    throw new functions.https.HttpsError('internal', `System Error: ${error.message}`);
  }
});


// 6. STATE MACHINE TRANSITION
exports.transitionInternshipState = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  }

  // Define valid states to replace legacy string flags
  const validTransitions = {
    'DRAFT': ['PENDING_INSTITUTION'],
    'PENDING_INSTITUTION': ['CONTRACT_LOCKED', 'DRAFT'], // DRAFT allowed for rejection/corrections
    'CONTRACT_LOCKED': ['IN_PROGRESS', 'DRAFT'],
    'IN_PROGRESS': ['EVALUATION'],
    'EVALUATION': ['CLOSED']
  };

  const { internshipId, newState } = data;

  if (!internshipId || !newState) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing internshipId or newState.');
  }

  const db = admin.firestore();
  const internshipRef = db.collection('internships').doc(internshipId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(internshipRef);
      if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Internship not found.');
      }

      const currentData = doc.data();

      // Temporarily bypass strict state machine if the current status is a legacy flag,
      // mapping them roughly to the new states to avoid breaking everything at once.
      // E.g. 'PENDING_ORG_APPROVAL' -> 'PENDING_INSTITUTION'
      //      'ORG_APPROVED' -> 'CONTRACT_LOCKED'
      //      'ANALYZING' / 'NEEDS_REVIEW' / 'APPROVED' -> 'IN_PROGRESS'

      // However, for the first PR we just want to ensure the backend validates the exact requested state transition if the user is using the new flow.
      // But since we are incrementally rolling this out, we'll allow *any* transition IF the new state is part of the 6-step state machine
      // to act as a bridge.

      const currentState = currentData.status || 'DRAFT';

      const newValidStates = ['DRAFT', 'PENDING_INSTITUTION', 'CONTRACT_LOCKED', 'IN_PROGRESS', 'EVALUATION', 'CLOSED'];

      // If newState is NOT part of the new 6-step flow AND NOT a legacy state we still need, block it.
      // We will temporarily allow legacy states for backward compatibility while we refactor the frontend in the next phase.
      const allowedLegacyStates = ['PENDING_ORG_APPROVAL', 'ORG_APPROVED', 'ANALYZING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED'];

      if (!newValidStates.includes(newState) && !allowedLegacyStates.includes(newState)) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Invalid target state: ${newState}`
          );
      }

      // Add guardrails here for the new states
      if (newState === 'CONTRACT_LOCKED') {
          // ensure required fields exist
          if (!currentData.companyId) {
              throw new functions.https.HttpsError('failed-precondition', 'Missing required fields for CONTRACT_LOCKED.');
          }
      }

      transaction.update(internshipRef, {
        status: newState,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, oldState: currentState, newState };
    });

    return result;
  } catch (error) {
    console.error("Transition Error:", error);
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error during state transition.');
  }
});

// 7. ROSTER IMPORT WITH SAFEGUARD
const xlsx = require('xlsx');

exports.importRoster = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  }

  const { fileData, format } = data;
  if (!fileData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing file data.');
  }

  let workbook;
  try {
    const buffer = Buffer.from(fileData, 'base64');
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch (error) {
    console.error("Excel parse error:", error);
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Excel file.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const db = admin.firestore();

  let added = 0;
  let updated = 0;
  let ignored = 0;

  // Helper to normalize names
  const normalizeName = (name) => {
    if (!name) return '';
    return name
      .replace(/Bc\.|Mgr\.|Ing\.|Ph\.D\.|prof\.|doc\./gi, '')
      .replace(/,/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  };

  const processUser = async (userObj) => {
    if (!userObj.name) {
      ignored++;
      return;
    }

    const normalizedName = normalizeName(userObj.name);

    try {
      await db.runTransaction(async (transaction) => {
        const usersRef = db.collection('users');
        // Simple search by normalized name or ID for UPSERT. Note: Firestore queries inside transactions require care.
        // We do a simple get based on a where clause.
        const q = usersRef.where('normalizedName', '==', normalizedName).limit(1);
        const snapshot = await transaction.get(q);

        if (!snapshot.empty) {
          // Update existing
          const userDoc = snapshot.docs[0];
          transaction.update(userDoc.ref, {
            schoolId: userObj.schoolId || userDoc.data().schoolId,
            year: userObj.year || userDoc.data().year,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Ensure an initial internship record is created/updated for the imported student
          const internshipsRef = userDoc.ref.collection('internships').doc('current');
          transaction.set(internshipsRef, {
            status: 'DRAFT',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          updated++;
        } else {
          // Create new
          const newUserRef = usersRef.doc();
          transaction.set(newUserRef, {
            name: userObj.name,
            normalizedName: normalizedName,
            role: 'student',
            schoolId: userObj.schoolId || null,
            year: userObj.year || null,
            email: `${normalizedName.replace(/\s+/g, '.').toLowerCase()}@placeholder.com`, // Mock email
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Add default internships subcollection
          const internshipsRef = newUserRef.collection('internships').doc('current');
          transaction.set(internshipsRef, {
            status: 'DRAFT',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          added++;
        }
      });
    } catch (e) {
      console.error('Transaction failed for user', userObj.name, e);
      ignored++;
    }
  };

  if (format === 'UPV') {
    // Logic A: The "UPV" Format
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    let headerRowIdx = -1;
    let schoolColIdx = -1;
    let nameColIdx = -1;

    // Dynamically find the header row by searching for "Škola" and "1. týden"
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const hasSkola = row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('škola'));
      const hasTyden = row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('1. týden'));

      if (hasSkola && hasTyden) {
        headerRowIdx = i;
        schoolColIdx = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().includes('škola'));
        // Find where names start (simplified: assuming column before '1. týden')
        const tydenColIdx = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().includes('1. týden'));
        nameColIdx = tydenColIdx - 1;
        break;
      }
    }

    if (headerRowIdx !== -1 && schoolColIdx !== -1 && nameColIdx !== -1) {
      let activeSchoolId = null; // Rolling State for merged cells

      for (let i = headerRowIdx + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        // Carry down the last known school
        if (row[schoolColIdx]) {
          activeSchoolId = row[schoolColIdx];
        }

        const rawName = row[nameColIdx];
        if (rawName && typeof rawName === 'string') {
          await processUser({
            name: rawName.trim(),
            schoolId: activeSchoolId
          });
        }
      }
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Could not find required headers in UPV format.');
    }
  } else {
    // Logic B: The "KP" Format (Standard)
    const rows = xlsx.utils.sheet_to_json(worksheet);
    for (const row of rows) {
      const name = row['Name'] || row['Jméno'] || row['Student'];
      const year = row['Year'] || row['Ročník'];
      const schoolId = row['Location'] || row['Škola'] || row['Místo'];

      if (name) {
        await processUser({
          name: name.trim(),
          year: year,
          schoolId: schoolId
        });
      }
    }
  }

  return { added, updated, ignored };
});


exports.evaluateReflection = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni pro hodnocení reflexe."
    );
  }

  const { internshipId, reflectionText } = data;

  if (!internshipId || !reflectionText) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí povinné parametry: internshipId a reflectionText."
    );
  }

  const db = admin.firestore();
  const internshipRef = db.collection("internships").doc(internshipId);
  const internshipDoc = await internshipRef.get();

  if (!internshipDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Praxe nebyla nalezena."
    );
  }

  const internshipData = internshipDoc.data();

  if (internshipData.studentId !== context.auth.uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Nemáte oprávnění hodnotit tuto praxi."
    );
  }

  if (internshipData.status !== "EVALUATION") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Praxe není ve stavu hodnocení (EVALUATION)."
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            evaluation: {
              type: SchemaType.OBJECT,
              properties: {
                isPass: {
                  type: SchemaType.BOOLEAN,
                  description: "Zda reflexe celkově splňuje metodiku (MŠMT KRAU) pro úspěšné hodnocení."
                },
                didacticCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Oborově-předmětová a didaktická kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                },
                pedagogicalCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Pedagogická a psychologická kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                },
                socialCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Komunikativní a sociální kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                },
                reflectiveCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Profesní a sebereflektivní kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                }
              },
              required: ["isPass", "didacticCompetence", "pedagogicalCompetence", "socialCompetence", "reflectiveCompetence"]
            }
          },
          required: ["evaluation"]
        }
      }
    });

    // Fetch dynamic rules
    const krauDoc = await db.collection("system_configs").doc("ai_krau_rules").get();
    let krauRules = `Jste expertní hodnotitel studentských reflexí odborné praxe.
Hodnoťte text striktně podle 4 pilířů státní metodiky MŠMT KRAU:
1. Oborově-předmětová a didaktická kompetence (didacticCompetence) - Hodnocení cílů, SMART plánování a výukových materiálů.
2. Pedagogická a psychologická kompetence (pedagogicalCompetence) - Hodnocení průběhu hodiny, struktury a aktivizace studentů.
3. Komunikativní a sociální kompetence (socialCompetence) - Hodnocení osobnosti učitele, komunikace a klimatu třídy.
4. Profesní a sebereflektivní kompetence (reflectiveCompetence) - Hodnocení hloubky a kritického myšlení samotné reflexe.

Váš výstup musí být výhradně validní JSON objekt.
Veškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.`;

    if (krauDoc.exists) {
        krauRules = krauDoc.data().content + "\n\nVáš výstup musí být výhradně validní JSON objekt.\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";
    }

    const systemPrompt = krauRules;

    const result = await model.generateContent(`${systemPrompt}\n\nText reflexe:\n${reflectionText}`);
    const responseText = result.response.text();
    const evaluationData = JSON.parse(responseText);

    const evaluationResult = evaluationData.evaluation;

    const updateData = {
      evaluationResult: evaluationResult
    };

    if (evaluationResult.isPass) {
      updateData.status = "CLOSED";

      // 1. Create Snapshot Data
      const snapshotId = internshipRef.id + '_' + Date.now();
      const snapshotData = {
        ...internshipData,
        evaluationResult: evaluationResult,
        status: "CLOSED",
        snapshotCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        originalInternshipId: internshipRef.id,
      };

      // 2. Generate PDF with QR Code
      const { createCertificatePdf } = require('./pdf_logic');
      const pdfBytes = await createCertificatePdf(snapshotData, snapshotId);

      // 3. Upload to Storage
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "praxihub-app.firebasestorage.app";
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(`certificates/${snapshotId}.pdf`);
      await file.save(Buffer.from(pdfBytes), {
        metadata: { contentType: 'application/pdf' }
      });

      const certificateUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/certificates%2F${snapshotId}.pdf?alt=media`;
      snapshotData.certificateUrl = certificateUrl;
      updateData.certificateUrl = certificateUrl;
      updateData.snapshotId = snapshotId;

      // 4. Save to archived_internships
      await db.collection("archived_internships").doc(snapshotId).set(snapshotData);
    }

    await internshipRef.update(updateData);

    return evaluationData;
  } catch (error) {
    console.error("Chyba při hodnocení reflexe:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Nastala chyba při zpracování s AI: " + error.message
    );
  }
});

exports.signContract = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Musíte být přihlášeni.");
  }

  const { internshipId, role } = data;
  if (!internshipId || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Chybí internshipId nebo role.");
  }

  if (!['student', 'coordinator', 'company'].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Neplatná role.");
  }

  const db = admin.firestore();
  const internshipRef = db.collection("internships").doc(internshipId);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(internshipRef);
    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Praxe nebyla nalezena.");
    }

    const internshipData = doc.data();

    // Check permissions
    if (role === 'student' && internshipData.studentId !== context.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění podepsat za studenta.");
    }
    // Simplification: In a real app we would check if context.auth.uid is the actual coordinator or company user assigned.
    // For now, we trust the caller's role if it matches the general requirements. We could verify the user's role from the users collection.
    const userDoc = await transaction.get(db.collection("users").doc(context.auth.uid));
    const userData = userDoc.exists ? userDoc.data() : {};

    if (role === 'coordinator' && userData.role !== 'admin' && userData.role !== 'coordinator') {
      throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění podepsat za koordinátora.");
    }

    if (role === 'company' && userData.role !== 'company' && internshipData.companyId !== context.auth.uid && internshipData.mentorId !== context.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění podepsat za společnost.");
    }

    const ipAddress = context.rawRequest ? context.rawRequest.ip : 'unknown';
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    const signatureData = {
      userId: context.auth.uid,
      timestamp: serverTimestamp,
      ipAddress: ipAddress
    };

    const updateData = {};
    updateData[`signatures.${role}`] = signatureData;

    transaction.update(internshipRef, updateData);

    // Create audit log
    const auditLogRef = db.collection("audit_logs").doc();
    transaction.set(auditLogRef, {
      action: 'SIGN_CONTRACT',
      internshipId: internshipId,
      role: role,
      userId: context.auth.uid,
      ipAddress: ipAddress,
      timestamp: serverTimestamp
    });

    return { success: true, message: `Úspěšně podepsáno jako ${role}.` };
  });
});


// 10. PAYROLL REPORT (Mzdové výkazy)
exports.generatePayrollReport = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Musíte být přihlášeni.");
  }

  try {
    const mentorsData = {}; // mentorId -> { name, hours }

    // Fetch all mentors to get their names
    const usersSnapshot = await admin.firestore().collection('users').where('role', '==', 'mentor').get();
    const mentorNames = {};
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      mentorNames[doc.id] = userData.displayName || userData.email || 'Neznámý mentor';
    });

    // Use collection group query to get all approved time logs across all internships efficiently
    const timeLogsSnapshot = await admin.firestore()
      .collectionGroup('time_logs')
      .where('status', '==', 'approved')
      .get();

    timeLogsSnapshot.forEach(logDoc => {
      const logData = logDoc.data();
      const mentorId = logData.mentorId;
      const hours = logData.hours || 0;

      if (mentorId && hours > 0) {
        if (!mentorsData[mentorId]) {
          mentorsData[mentorId] = {
            mentorId: mentorId,
            mentorName: mentorNames[mentorId] || 'Neznámý mentor',
            totalHours: 0
          };
        }
        mentorsData[mentorId].totalHours += hours;
      }
    });

    return Object.values(mentorsData);
  } catch (error) {
    console.error("Error generating payroll report:", error);
    throw new functions.https.HttpsError("internal", "Nepodařilo se vygenerovat mzdový výkaz.");
  }
});

// --- 8. TEST AI REFLECTION EVALUATION (Admin Playground) ---
exports.testEvaluateReflection = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni."
    );
  }

  // Check admin role here
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().role !== 'coordinator')) {
    throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění.");
  }

  const { reflectionText, rulesText } = data;

  if (!reflectionText || !rulesText) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí povinné parametry: reflectionText a rulesText."
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            evaluation: {
              type: SchemaType.OBJECT,
              properties: {
                isPass: {
                  type: SchemaType.BOOLEAN,
                  description: "Zda reflexe celkově splňuje metodiku (MŠMT KRAU) pro úspěšné hodnocení."
                },
                didacticCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Oborově-předmětová a didaktická kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                },
                pedagogicalCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Pedagogická a psychologická kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                },
                socialCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Komunikativní a sociální kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                },
                reflectiveCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Profesní a sebereflektivní kompetence",
                  properties: {
                    score: { type: SchemaType.INTEGER, description: "Bodové hodnocení od 0 do 100." },
                    reasoning: { type: SchemaType.STRING, description: "Zdůvodnění v profesionální češtině." }
                  },
                  required: ["score", "reasoning"]
                }
              },
              required: ["isPass", "didacticCompetence", "pedagogicalCompetence", "socialCompetence", "reflectiveCompetence"]
            }
          },
          required: ["evaluation"]
        }
      }
    });

    let systemPrompt = rulesText + "\n\nVáš výstup musí být výhradně validní JSON objekt.\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";

    const result = await model.generateContent(`${systemPrompt}\n\nText reflexe:\n${reflectionText}`);
    const responseText = result.response.text();
    const evaluationData = JSON.parse(responseText);

    return evaluationData;
  } catch (error) {
    console.error("Chyba pri testovaní AI hodnocení:", error);
    throw new functions.https.HttpsError("internal", "Nepodařilo se ohodnotit reflexi", error.message);
  }
});

// --- 9. UPDATE SYSTEM CONFIG ---
exports.resolveLoginIdentifier = functions.https.onCall(async (data, context) => {
  const { identifier } = data;
  if (!identifier) {
    throw new functions.https.HttpsError('invalid-argument', 'Chybí e-mail nebo Univerzitní ID.');
  }

  // If identifier contains @, assume it's an email
  if (identifier.includes('@')) {
    const email = identifier.trim().toLowerCase();
    const querySnapshot = await db.collection("users").where("email", "==", email).get();
    if (querySnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Přístup odepřen. Váš e-mail není v systému registrován.');
    }
    return { email };
  } else {
    // Assume it's a University ID
    const universityId = identifier.trim();
    const querySnapshot = await db.collection("users").where("universityId", "==", universityId).get();

    if (querySnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Přístup odepřen. Vaše Univerzitní ID nebylo nalezeno.');
    }
    // Return the first match (should be unique)
    const userDoc = querySnapshot.docs[0];
    return { email: userDoc.data().email };
  }
});

exports.updateSystemConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Musíte být přihlášeni.");
  }

  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().role !== 'coordinator')) {
    throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění.");
  }

  const { docId, content, title, isCritical } = data;

  if (!docId || !content) {
    throw new functions.https.HttpsError("invalid-argument", "Chybí povinné parametry.");
  }

  try {
    await admin.firestore().collection('system_configs').doc(docId).set({
      id: docId,
      title: title || docId,
      content: content,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
      isCritical: isCritical || false
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating config:", error);
    throw new functions.https.HttpsError("internal", "Nepodařilo se uložit konfiguraci.", error.message);
  }
});
