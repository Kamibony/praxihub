const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const axios = require("axios");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

// 1. AI ANALÝZA ZMLUVY
// Spustí sa, keď sa vytvorí/upraví dokument a status je 'ANALYZING'
exports.analyzeContract = functions.firestore
  .document("placements/{docId}")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;

    const newData = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;

    const isNew = !previousData;
    const statusChanged = previousData && previousData.status !== "ANALYZING";
    const shouldRun =
      newData.status === "ANALYZING" && (isNew || statusChanged);

    if (shouldRun) {
      console.log(`🚀 Začínam analýzu pre: ${context.params.docId}`);

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Používame gemini-1.5-pro alebo 2.0-flash podľa dostupnosti, tu je 2.5-pro z promptu
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const fileUrl = newData.contract_url;
        if (!fileUrl) throw new Error("Chýba URL zmluvy");

        // Stiahnutie súboru
        const response = await axios.get(fileUrl, {
          responseType: "arraybuffer",
        });
        const base64File = Buffer.from(response.data).toString("base64");
        const mimeType = fileUrl.toLowerCase().includes(".pdf")
          ? "application/pdf"
          : "image/jpeg";

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

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64File, mimeType: mimeType } },
        ]);
        const cleanJson = result.response
          .text()
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const extractedData = JSON.parse(cleanJson);

        // Nastavíme status na NEEDS_REVIEW, aby to študent skontroloval
        await change.after.ref.update({
          organization_name: extractedData.organization_name || "Neznáma firma",
          organization_ico: extractedData.organization_ico || null,
          start_date: extractedData.start_date,
          end_date: extractedData.end_date,
          status: "NEEDS_REVIEW",
          ai_analysis_result: cleanJson,
          is_verified: false,
        });
      } catch (error) {
        console.error("❌ Chyba pri analýze:", error);
        await change.after.ref.update({
          status: "REJECTED",
          ai_error_message: error.message,
        });
      }
    }
    return null;
  });

// 2. NOTIFIKÁCIE (Vyžaduje Firebase Extension: Trigger Email)
// Sleduje zmeny statusov a posiela e-maily
exports.sendEmailNotification = functions.firestore
  .document("placements/{docId}")
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
          html: `<p>Ahoj,</p><p>stav tvojej zmluvy sa zmenil na: <strong>${newData.status}</strong>.</p><p><a href="https://praxihub-app.web.app">Prejsť na Dashboard</a></p>`,
        },
      };

      // Zapíšeme do kolekcie 'mail', ktorú sleduje rozšírenie Trigger Email
      await admin.firestore().collection("mail").add(emailDoc);
      console.log(
        `📧 E-mail požiadavka vytvorená pre: ${newData.studentEmail}`,
      );
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
   You are the intelligent assistant for PraxiHub, a university placement management platform.
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
      - **Rating:** In the same Modal, you can rate the student (Stars + Review) at the end of the placement.

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
          parts: [
            {
              text: "Rozumím. Jsem připraven pomáhat uživatelům PraxiHubu v češtině.",
            },
          ],
        },
      ],
    });

    const result = await chat.sendMessage(userMessage);
    return { response: result.response.text() };
  } catch (error) {
    console.error("Chatbot Error:", error);
    // Vrátime chybu frontend klientovi
    throw new functions.https.HttpsError(
      "internal",
      "AI momentálně neodpovídá.",
    );
  }
});

// 4. GENERATE CONTRACT PDF
exports.createContractPDF = functions
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      console.log("Starting createContractPDF");

      // Authenticate Request
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Unauthorized");
      }
      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (e) {
        console.error("Error verifying token:", e);
        return res.status(401).send("Unauthorized");
      }
      const uid = decodedToken.uid;

      const data = req.body.data || req.body;
      const { studentName, companyName, ico, startDate, endDate, position } =
        data;
      if (
        !studentName ||
        !companyName ||
        !ico ||
        !startDate ||
        !endDate ||
        !position
      ) {
        return res.status(400).send({ error: "Missing required fields." });
      }

      // Track execution step for better debugging
      let step = "Initialization";

      try {
        console.log("Loading dependencies (pdf-lib)...");
        const { PDFDocument, rgb } = require("pdf-lib");
        const fontkit = require("@pdf-lib/fontkit");
        console.log("Dependencies loaded.");

        // Fetch font supporting Latin-2 (Czech)
        const fontUrl =
          "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.ttf";
        const fontResponse = await axios.get(fontUrl, {
          responseType: "arraybuffer",
          headers: { "User-Agent": "Mozilla/5.0" },
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

        drawText("Smlouva o praxi", 50, yPosition, 20);
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

        drawText(
          "Potvrzujeme, že student vykoná praxi ve výše uvedeném rozsahu.",
          50,
          yPosition,
        );
        yPosition -= 20;
        drawText(
          "Tato smlouva je generována automaticky aplikací PraxiHub.",
          50,
          yPosition,
        );

        step = "PDF Serialization";
        const pdfBytes = await pdfDoc.save();
        console.log("PDF generated successfully.");

        // Upload to Firebase Storage
        step = "Storage Upload";
        console.log("Uploading to Storage...");
        const bucket = admin
          .storage()
          .bucket("praxihub-app.firebasestorage.app");
        console.log("Bucket name:", bucket.name); // Debug log as requested

        const fileName = `generated_contract_${Date.now()}.pdf`;
        const filePath = `contracts/${uid}/${fileName}`;
        const file = bucket.file(filePath);

        await file.save(pdfBytes, {
          metadata: {
            contentType: "application/pdf",
          },
        });
        console.log("PDF uploaded.");

        // Make the file publicly accessible via a long-lived download URL (token based)
        // Using the uuid approach for client SDK compatibility
        // We generate a random string for the token.
        const uuid =
          Math.random().toString(36).substring(2) + Date.now().toString(36);

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
          code: error.code, // helpful for storage errors
        });
      }
    });
  });

// 5. AI MATCHMAKING
exports.findMatches = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in.",
    );
  }

  const studentId = context.auth.uid;
  console.log("Starting matchmaking for:", studentId);

  // Step 1: Auth & Data Fetch
  let userData;
  try {
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(studentId)
      .get();
    if (!userDoc.exists) {
      return {
        matches: [],
        message: "Profil uživatele nebyl nalezen. Kontaktujte podporu.",
      };
    }
    userData = userDoc.data();

    // Step 1: Deep Logging (Debug)
    console.log("RAW User Data:", JSON.stringify(userData));
    console.log("RAW Skills Field:", userData.skills);
  } catch (err) {
    console.error("Firestore Fetch Error:", err);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to fetch user profile.",
    );
  }

  // Step 2: Stricter Skill Validation
  let studentSkills = [];
  if (Array.isArray(userData.skills)) {
    studentSkills = userData.skills
      .map((s) => String(s).trim())
      .filter((s) => s.length > 1); // Filter out single chars or empty strings
  }
  console.log("VALIDATED Student Skills:", studentSkills);

  if (studentSkills.length === 0) {
    console.log("ABORT: No valid skills found.");
    return {
      matches: [],
      message:
        "Nemáte vyplněné žádné dovednosti. Pro získání doporučení si prosím doplňte profil.",
    };
  }

  // Step 4: Env Validation
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment.");

  try {
    // Step 3: Company Validation
    const companiesSnapshot = await admin
      .firestore()
      .collection("users")
      .orderBy("companyIco")
      .get();

    const companies = companiesSnapshot.docs
      .map((doc) => {
        const d = doc.data();
        // Skip empty companies
        if (!d.companyIco) return null;
        if (!d.description && (!d.lookingFor || d.lookingFor.length === 0))
          return null;

        return {
          id: doc.id,
          name: d.displayName || d.email || "Neznámá firma",
          lookingFor: d.lookingFor || [], // Array of strings
          description: d.description || "",
          email: d.email,
        };
      })
      .filter((c) => c !== null);

    if (companies.length === 0) {
      return {
        matches: [],
        message: "Zatím tu nejsou žádné firmy s popisem práce.",
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      You are a strict matchmaking engine. use ONLY the provided JSON data. DO NOT invent or assume any skills or requirements not explicitly listed. If a profile is empty, ignore it.

      Student má tyto dovednosti: ${studentSkills.join(", ")}.

      Zde je seznam firem a co hledají:
      ${JSON.stringify(
        companies.map((c) => ({
          id: c.id,
          name: c.name,
          lookingFor: c.lookingFor,
        })),
      )}

      Úkol:
      Porovnej studentovy dovednosti s požadavky firem.
      Vrať JSON pole objektů (seřazené od nejlepší shody po nejhorší), kde každý objekt má:
      - organizationId (ID firmy ze vstupu)
      - matchScore (číslo 0-100)
      - reasoning (stručné vysvětlení v češtině, proč se hodí/nehodí - max 2 věty)

      Vrať pouze čistý JSON, žádný markdown.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let matches;
    try {
      matches = JSON.parse(text);
    } catch (parseError) {
      console.error("AI JSON Parse Error. Raw text:", text);
      throw new Error("AI returned invalid JSON");
    }

    // Merge back with company details
    const detailedMatches = matches.map((m) => {
      const company = companies.find((c) => c.id === m.organizationId);
      return {
        ...m,
        companyName: company?.name || "Unknown",
        companyEmail: company?.email || "",
        lookingFor: company?.lookingFor || [],
      };
    });

    return { matches: detailedMatches };
  } catch (error) {
    // Step 6: Transparent Error Handling
    console.error("Matchmaking Critical Fail:", error);
    throw new functions.https.HttpsError(
      "internal",
      `System Error: ${error.message}`,
    );
  }
});

// 6. STATE MACHINE TRANSITION
exports.transitionPlacementState = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in.",
      );
    }

    // Define valid states to replace legacy string flags
    const validTransitions = {
      DRAFT: ["PENDING_INSTITUTION"],
      PENDING_INSTITUTION: ["CONTRACT_LOCKED", "DRAFT"], // DRAFT allowed for rejection/corrections
      CONTRACT_LOCKED: ["IN_PROGRESS", "DRAFT"],
      IN_PROGRESS: ["EVALUATION"],
      EVALUATION: ["CLOSED"],
      CLOSED: ["FINAL_EXAM"],
    };

    const { placementId, newState } = data;

    if (!placementId || !newState) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing placementId or newState.",
      );
    }

    const db = admin.firestore();
    const placementRef = db.collection("placements").doc(placementId);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(placementRef);
        if (!doc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Placement not found.",
          );
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

        const currentState = currentData.status || "DRAFT";

        const newValidStates = [
          "DRAFT",
          "PENDING_INSTITUTION",
          "CONTRACT_LOCKED",
          "IN_PROGRESS",
          "EVALUATION",
          "CLOSED",
          "FINAL_EXAM",
        ];

        // If newState is NOT part of the new flow AND NOT a legacy state we still need, block it.
        // We will temporarily allow legacy states for backward compatibility while we refactor the frontend in the next phase.
        const allowedLegacyStates = [
          "PENDING_ORG_APPROVAL",
          "ORG_APPROVED",
          "ANALYZING",
          "NEEDS_REVIEW",
          "APPROVED",
          "REJECTED",
        ];

        if (
          !newValidStates.includes(newState) &&
          !allowedLegacyStates.includes(newState)
        ) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Invalid target state: ${newState}`,
          );
        }

        // Add guardrails here for the new states
        if (newState === "CONTRACT_LOCKED") {
          // ensure required fields exist
          if (!currentData.organizationId) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              "Missing required fields for CONTRACT_LOCKED.",
            );
          }

          const major = currentData.studentMajor || currentData.major || "UPV";
          if (major === "KPV") {
            const orgDoc = await transaction.get(
              db.collection("users").doc(currentData.organizationId),
            );
            if (!orgDoc.exists) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "Organizace nenalezena.",
              );
            }
            const orgData = orgDoc.data();
            const expirationStr = orgData.frameworkAgreementExpiration;

            if (!expirationStr) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "Organizace nemá platnou rámcovou smlouvu (chybí datum).",
              );
            }

            const expDate = new Date(expirationStr);
            if (isNaN(expDate.getTime()) || expDate <= new Date()) {
              throw new functions.https.HttpsError(
                "failed-precondition",
                "Organizace nemá platnou rámcovou smlouvu (vypršela).",
              );
            }
          }
        }

        // Implement FINAL_EXAM promotion logic
        // READ operations must come before WRITE operations in a transaction
        let principalName = "Neznámý ředitel";
        if (newState === "FINAL_EXAM") {
          const organizationId = currentData.organizationId;
          if (organizationId) {
            const orgDoc = await transaction.get(
              db.collection("organizations").doc(organizationId),
            );
            if (orgDoc.exists) {
              principalName = orgDoc.data().principalName || "Neznámý ředitel";
            }
          }
        }

        transaction.update(placementRef, {
          status: newState,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (newState === "FINAL_EXAM") {
          const commissionRef = db.collection("commissions").doc();
          transaction.set(commissionRef, {
            placementId: placementId,
            studentId: currentData.studentId,
            mentorId: currentData.mentorId,
            organizationId: currentData.organizationId,
            principalName: principalName,
            status: "PENDING",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        return { success: true, oldState: currentState, newState };
      });

      return result;
    } catch (error) {
      console.error("Transition Error:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Error during state transition.",
      );
    }
  },
);

// 7. ROSTER IMPORT WITH SAFEGUARD
const xlsx = require("xlsx");

exports.importRoster = functions
  .runWith({ timeoutSeconds: 300, memory: "1GB" })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in.",
    );
  }

  const { mappedData } = data;
  if (!mappedData || !Array.isArray(mappedData)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing mapped data array.",
    );
  }

  const db = admin.firestore();

  let added = 0;
  let updated = 0;
  let ignored = 0;

  // Helper to normalize names
  const normalizeName = (name) => {
    if (!name) return "";
    return name
      .replace(/Bc\.|Mgr\.|Ing\.|Ph\.D\.|prof\.|doc\./gi, "")
      .replace(/,/g, "")
      .trim()
      .replace(/\s+/g, " ");
  };

  const processUser = async (userObj) => {
    let fullName =
      userObj.name ||
      [userObj.firstName, userObj.lastName].filter(Boolean).join(" ");
    if (!fullName) {
      ignored++;
      return;
    }

    const normalizedName = normalizeName(fullName);

    try {
      await db.runTransaction(async (transaction) => {
        const usersRef = db.collection("users");

        let existingUserDoc = null;

        // 1. ALL READS FIRST

        if (userObj.uid) {
            // Priority 1: Match by explicit UID
            const docRef = usersRef.doc(String(userObj.uid));
            const docSnapshot = await transaction.get(docRef);
            if (docSnapshot.exists) {
                existingUserDoc = docSnapshot;
            }
        }

        if (!existingUserDoc) {
            // Priority 2: Fallback to normalized name search
            const q = usersRef
              .where("normalizedName", "==", normalizedName)
              .limit(1);
            const snapshot = await transaction.get(q);

            if (!snapshot.empty) {
              existingUserDoc = snapshot.docs[0];
            }
        }

        const orgsRef = db.collection("organizations");
        let existingOrgDoc = null;
        let orgName = null;
        if (userObj.organizationId) {
          orgName = String(userObj.organizationId).trim();
          const orgQ = orgsRef.where("name", "==", orgName).limit(1);
          const orgSnapshot = await transaction.get(orgQ);
          if (!orgSnapshot.empty) {
            existingOrgDoc = orgSnapshot.docs[0];
          }
        }

        let userId = existingUserDoc ? existingUserDoc.id : (userObj.uid ? String(userObj.uid) : usersRef.doc().id);

        const placementsRef = db.collection("placements");
        const placementQ = placementsRef
          .where("studentId", "==", userId)
          .limit(1);
        const placementSnapshot = await transaction.get(placementQ);
        let existingPlacementDoc = null;
        if (!placementSnapshot.empty) {
          existingPlacementDoc = placementSnapshot.docs[0];
        }

        // 2. ALL WRITES SECOND

        if (existingUserDoc) {
          transaction.update(existingUserDoc.ref, {
            organizationId:
              userObj.organizationId || existingUserDoc.data().organizationId,
            year: userObj.year || existingUserDoc.data().year,
            major: userObj.major || existingUserDoc.data().major || null,
            email:
              userObj.email ||
              existingUserDoc.data().email ||
              `${normalizedName.replace(/\s+/g, ".").toLowerCase()}@placeholder.com`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          updated++;
        } else {
          const newUserRef = usersRef.doc(userId);
          transaction.set(newUserRef, {
            name: fullName,
            normalizedName: normalizedName,
            role: "student",
            organizationId: userObj.organizationId || null,
            year: userObj.year || null,
            major: userObj.major || null,
            email: userObj.email || `${normalizedName.replace(/\s+/g, ".").toLowerCase()}@placeholder.com`, // Mock email
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          added++;
        }

        let orgId = null;
        if (orgName) {
          if (existingOrgDoc) {
            orgId = existingOrgDoc.id;
          } else {
            const newOrgRef = orgsRef.doc();
            orgId = newOrgRef.id;
            transaction.set(newOrgRef, {
              name: orgName,
              role: "institution",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        if (existingPlacementDoc) {
          transaction.update(existingPlacementDoc.ref, {
            organizationId: orgId || existingPlacementDoc.data().organizationId,
            migratedHours: Number(userObj.migratedHours) || existingPlacementDoc.data().migratedHours || 0,
            targetHours: Number(userObj.targetHours) || existingPlacementDoc.data().targetHours || 15,
            studentMajor: userObj.major || existingPlacementDoc.data().studentMajor || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          const newPlacementRef = placementsRef.doc();
          transaction.set(newPlacementRef, {
            studentId: userId,
            organizationId: orgId,
            status: "DRAFT",
            migratedHours: Number(userObj.migratedHours) || 0,
            targetHours: Number(userObj.targetHours) || 15,
            studentMajor: userObj.major || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (e) {
      console.error("Transaction failed for user", fullName, e);
      ignored++;
    }
  };

  // Execute processUser in parallel using Promise.all to improve batch import performance
  await Promise.all(mappedData.map(row => processUser(row)));

  return { added, updated, ignored };
});

exports.evaluateReflection = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni pro hodnocení reflexe.",
    );
  }

  const { placementId, reflectionText } = data;

  if (!placementId || !reflectionText) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí povinné parametry: placementId a reflectionText.",
    );
  }

  const db = admin.firestore();
  const placementRef = db.collection("placements").doc(placementId);
  const placementDoc = await placementRef.get();

  if (!placementDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Praxe nebyla nalezena.");
  }

  const placementData = placementDoc.data();

  if (placementData.studentId !== context.auth.uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Nemáte oprávnění hodnotit tuto praxi.",
    );
  }

  if (placementData.status !== "EVALUATION") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Praxe není ve stavu hodnocení (EVALUATION).",
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
                  description:
                    "Zda reflexe celkově splňuje metodiku (MŠMT KRAU) pro úspěšné hodnocení.",
                },
                didacticCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Oborově-předmětová a didaktická kompetence",
                  properties: {
                    score: {
                      type: SchemaType.INTEGER,
                      description: "Bodové hodnocení od 0 do 100.",
                    },
                    reasoning: {
                      type: SchemaType.STRING,
                      description: "Zdůvodnění v profesionální češtině.",
                    },
                  },
                  required: ["score", "reasoning"],
                },
                pedagogicalCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Pedagogická a psychologická kompetence",
                  properties: {
                    score: {
                      type: SchemaType.INTEGER,
                      description: "Bodové hodnocení od 0 do 100.",
                    },
                    reasoning: {
                      type: SchemaType.STRING,
                      description: "Zdůvodnění v profesionální češtině.",
                    },
                  },
                  required: ["score", "reasoning"],
                },
                socialCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Komunikativní a sociální kompetence",
                  properties: {
                    score: {
                      type: SchemaType.INTEGER,
                      description: "Bodové hodnocení od 0 do 100.",
                    },
                    reasoning: {
                      type: SchemaType.STRING,
                      description: "Zdůvodnění v profesionální češtině.",
                    },
                  },
                  required: ["score", "reasoning"],
                },
                reflectiveCompetence: {
                  type: SchemaType.OBJECT,
                  description: "Profesní a sebereflektivní kompetence",
                  properties: {
                    score: {
                      type: SchemaType.INTEGER,
                      description: "Bodové hodnocení od 0 do 100.",
                    },
                    reasoning: {
                      type: SchemaType.STRING,
                      description: "Zdůvodnění v profesionální češtině.",
                    },
                  },
                  required: ["score", "reasoning"],
                },
              },
              required: [
                "isPass",
                "didacticCompetence",
                "pedagogicalCompetence",
                "socialCompetence",
                "reflectiveCompetence",
              ],
            },
          },
          required: ["evaluation"],
        },
      },
    });

    // Fetch dynamic rules based on major
    const major = placementData.studentMajor || "UPV";
    const configDocId = major === "KPV" ? "ai_rules_kpv" : "ai_rules_upv";

    let krauDoc = await db.collection("system_rules").doc(configDocId).get();

    // Fallback to legacy rules if UPV rules not set yet
    if (!krauDoc.exists && major === "UPV") {
      krauDoc = await db.collection("system_rules").doc("ai_krau_rules").get();
    }

    let rulesContent = `Jste expertní hodnotitel studentských reflexí odborné praxe.
Hodnoťte text striktně podle 4 pilířů metodiky:
1. Oborově-předmětová a didaktická kompetence (didacticCompetence)
2. Pedagogická a psychologická kompetence (pedagogicalCompetence)
3. Komunikativní a sociální kompetence (socialCompetence)
4. Profesní a sebereflektivní kompetence (reflectiveCompetence)

Váš výstup musí být výhradně validní JSON objekt.
Veškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.`;

    if (krauDoc.exists) {
      rulesContent =
        krauDoc.data().content +
        "\n\nVáš výstup musí být výhradně validní JSON objekt.\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";
    }

    const systemPrompt = rulesContent;

    const result = await model.generateContent(
      `${systemPrompt}\n\nText reflexe:\n${reflectionText}`,
    );
    const responseText = result.response.text();
    const evaluationData = JSON.parse(responseText);

    const evaluationResult = evaluationData.evaluation;

    const updateData = {
      evaluationResult: evaluationResult,
    };

    if (evaluationResult.isPass) {
      updateData.status = "CLOSED";

      // 1. Create Snapshot Data
      const snapshotId = placementRef.id + "_" + Date.now();
      const snapshotData = {
        ...placementData,
        evaluationResult: evaluationResult,
        status: "CLOSED",
        snapshotCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        originalPlacementId: placementRef.id,
      };

      // 2. Generate PDF with QR Code
      const { createCertificatePdf } = require("./pdf_logic");
      const pdfBytes = await createCertificatePdf(snapshotData, snapshotId);

      // 3. Upload to Storage
      const bucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        "praxihub-app.firebasestorage.app";
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(`certificates/${snapshotId}.pdf`);
      await file.save(Buffer.from(pdfBytes), {
        metadata: { contentType: "application/pdf" },
      });

      const certificateUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/certificates%2F${snapshotId}.pdf?alt=media`;
      snapshotData.certificateUrl = certificateUrl;
      updateData.certificateUrl = certificateUrl;
      updateData.snapshotId = snapshotId;

      // 4. Save to archived_placements
      await db
        .collection("archived_placements")
        .doc(snapshotId)
        .set(snapshotData);
    }

    await placementRef.update(updateData);

    return evaluationData;
  } catch (error) {
    console.error("Chyba při hodnocení reflexe:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Nastala chyba při zpracování s AI: " + error.message,
    );
  }
});

exports.signContract = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni.",
    );
  }

  const { placementId, role } = data;
  if (!placementId || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí placementId nebo role.",
    );
  }

  if (!["student", "coordinator", "company"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Neplatná role.");
  }

  const db = admin.firestore();
  const placementRef = db.collection("placements").doc(placementId);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(placementRef);
    if (!doc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Praxe nebyla nalezena.",
      );
    }

    const placementData = doc.data();

    // Check permissions
    if (role === "student" && placementData.studentId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Nemáte oprávnění podepsat za studenta.",
      );
    }

    // Check if the placement requires tripartite signature
    const major = placementData.studentMajor || placementData.major || "UPV";
    if (major === "UPV") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Pro obor UPV není elektronický podpis podporován/vyžadován.",
      );
    }
    // Simplification: In a real app we would check if context.auth.uid is the actual coordinator or company user assigned.
    // For now, we trust the caller's role if it matches the general requirements. We could verify the user's role from the users collection.
    const userDoc = await transaction.get(
      db.collection("users").doc(context.auth.uid),
    );
    const userData = userDoc.exists ? userDoc.data() : {};

    if (
      role === "coordinator" &&
      userData.role !== "admin" &&
      userData.role !== "coordinator"
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Nemáte oprávnění podepsat za koordinátora.",
      );
    }

    if (
      role === "company" &&
      userData.role !== "company" &&
      placementData.organizationId !== context.auth.uid &&
      placementData.mentorId !== context.auth.uid
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Nemáte oprávnění podepsat za společnost.",
      );
    }

    const ipAddress = context.rawRequest ? context.rawRequest.ip : "unknown";
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    const signatureData = {
      userId: context.auth.uid,
      timestamp: serverTimestamp,
      ipAddress: ipAddress,
    };

    const updateData = {};
    updateData[`signatures.${role}`] = signatureData;

    // Check if fully signed
    const currentSignatures = placementData.signatures || {};
    const newSignatures = { ...currentSignatures, [role]: signatureData };

    if (
      newSignatures.student &&
      newSignatures.coordinator &&
      newSignatures.company
    ) {
      updateData.status = "IN_PROGRESS"; // Maps to ACTIVE
    }

    transaction.update(placementRef, updateData);

    // Create audit log
    const auditLogRef = db.collection("audit_logs").doc();
    transaction.set(auditLogRef, {
      action: "SIGN_CONTRACT",
      placementId: placementId,
      role: role,
      userId: context.auth.uid,
      ipAddress: ipAddress,
      timestamp: serverTimestamp,
    });

    return { success: true, message: `Úspěšně podepsáno jako ${role}.` };
  });
});

// 10. PAYROLL REPORT (Mzdové výkazy)
exports.generatePayrollReport = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Musíte být přihlášeni.",
      );
    }

    try {
      const mentorsData = {}; // mentorId -> { name, hours }

      // Fetch all mentors and institutions to get their names
      const usersSnapshot = await admin
        .firestore()
        .collection("users")
        .where("role", "in", ["mentor", "institution"])
        .get();
      const userNames = {};
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        userNames[doc.id] =
          userData.displayName ||
          userData.name ||
          userData.email ||
          "Neznámý subjekt";
      });

      // Use collection group query to get all approved time logs across all placements efficiently
      const timeLogsSnapshot = await admin
        .firestore()
        .collectionGroup("time_logs")
        .where("status", "==", "approved")
        .get();

      timeLogsSnapshot.forEach((logDoc) => {
        const logData = logDoc.data();
        const mentorId = logData.mentorId;
        const organizationId = logData.organizationId || "unassigned";
        const hours = logData.hours || 0;

        if (mentorId && hours > 0) {
          const key = `${mentorId}_${organizationId}`;
          if (!mentorsData[key]) {
            mentorsData[key] = {
              mentorId: mentorId,
              mentorName: userNames[mentorId] || "Neznámý mentor",
              organizationId: organizationId,
              organizationName:
                organizationId !== "unassigned"
                  ? userNames[organizationId] || "Neznámá organizace"
                  : "Nepřiřazeno",
              totalHours: 0,
            };
          }
          mentorsData[key].totalHours += hours;
        }
      });

      return Object.values(mentorsData);
    } catch (error) {
      console.error("Error generating payroll report:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Nepodařilo se vygenerovat mzdový výkaz.",
      );
    }
  },
);

// --- 8. TEST AI REFLECTION EVALUATION (Admin Playground) ---
exports.testEvaluateReflection = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Musíte být přihlášeni.",
      );
    }

    // Check admin role here
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();
    if (
      !userDoc.exists ||
      (userDoc.data().role !== "admin" && userDoc.data().role !== "coordinator")
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Nemáte oprávnění.",
      );
    }

    const { reflectionText, rulesText } = data;

    if (!reflectionText || !rulesText) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Chybí povinné parametry: reflectionText a rulesText.",
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
                    description:
                      "Zda reflexe celkově splňuje metodiku (MŠMT KRAU) pro úspěšné hodnocení.",
                  },
                  didacticCompetence: {
                    type: SchemaType.OBJECT,
                    description: "Oborově-předmětová a didaktická kompetence",
                    properties: {
                      score: {
                        type: SchemaType.INTEGER,
                        description: "Bodové hodnocení od 0 do 100.",
                      },
                      reasoning: {
                        type: SchemaType.STRING,
                        description: "Zdůvodnění v profesionální češtině.",
                      },
                    },
                    required: ["score", "reasoning"],
                  },
                  pedagogicalCompetence: {
                    type: SchemaType.OBJECT,
                    description: "Pedagogická a psychologická kompetence",
                    properties: {
                      score: {
                        type: SchemaType.INTEGER,
                        description: "Bodové hodnocení od 0 do 100.",
                      },
                      reasoning: {
                        type: SchemaType.STRING,
                        description: "Zdůvodnění v profesionální češtině.",
                      },
                    },
                    required: ["score", "reasoning"],
                  },
                  socialCompetence: {
                    type: SchemaType.OBJECT,
                    description: "Komunikativní a sociální kompetence",
                    properties: {
                      score: {
                        type: SchemaType.INTEGER,
                        description: "Bodové hodnocení od 0 do 100.",
                      },
                      reasoning: {
                        type: SchemaType.STRING,
                        description: "Zdůvodnění v profesionální češtině.",
                      },
                    },
                    required: ["score", "reasoning"],
                  },
                  reflectiveCompetence: {
                    type: SchemaType.OBJECT,
                    description: "Profesní a sebereflektivní kompetence",
                    properties: {
                      score: {
                        type: SchemaType.INTEGER,
                        description: "Bodové hodnocení od 0 do 100.",
                      },
                      reasoning: {
                        type: SchemaType.STRING,
                        description: "Zdůvodnění v profesionální češtině.",
                      },
                    },
                    required: ["score", "reasoning"],
                  },
                },
                required: [
                  "isPass",
                  "didacticCompetence",
                  "pedagogicalCompetence",
                  "socialCompetence",
                  "reflectiveCompetence",
                ],
              },
            },
            required: ["evaluation"],
          },
        },
      });

      let systemPrompt =
        rulesText +
        "\n\nVáš výstup musí být výhradně validní JSON objekt.\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";

      const result = await model.generateContent(
        `${systemPrompt}\n\nText reflexe:\n${reflectionText}`,
      );
      const responseText = result.response.text();
      const evaluationData = JSON.parse(responseText);

      return evaluationData;
    } catch (error) {
      console.error("Chyba pri testovaní AI hodnocení:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Nepodařilo se ohodnotit reflexi",
        error.message,
      );
    }
  },
);

// 12. GENERATE COMMISSION DECREE
exports.generateCommissionDecree = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in.",
      );
    }

    const { commissionId, guarantorName, guarantorId } = data;
    if (!commissionId || !guarantorName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing commissionId or guarantorName.",
      );
    }

    const db = admin.firestore();
    const commissionRef = db.collection("commissions").doc(commissionId);

    try {
      const commissionDoc = await commissionRef.get();
      if (!commissionDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Commission not found.",
        );
      }

      const commissionData = commissionDoc.data();

      // Fetch related names
      const [studentDoc, mentorDoc, orgDoc] = await Promise.all([
        db.collection("users").doc(commissionData.studentId).get(),
        db.collection("users").doc(commissionData.mentorId).get(),
        db.collection("organizations").doc(commissionData.organizationId).get(),
      ]);

      const decreeData = {
        studentName: studentDoc.exists
          ? studentDoc.data().name
          : "Neznámý student",
        organizationName: orgDoc.exists
          ? orgDoc.data().name
          : "Neznámá organizace",
        mentorName: mentorDoc.exists ? mentorDoc.data().name : "Neznámý mentor",
        principalName: commissionData.principalName || "Neznámý ředitel",
        guarantorName: guarantorName,
      };

      // Generate PDF
      const { createCommissionDecreePdf } = require("./pdf_logic");
      const pdfBytes = await createCommissionDecreePdf(
        decreeData,
        commissionId,
      );

      // Upload to Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(`decrees/${commissionId}.pdf`);
      await file.save(Buffer.from(pdfBytes), {
        metadata: { contentType: "application/pdf" },
      });

      // Make it publicly accessible (or secure it via signed URLs, here we get a standard URL)
      await file.makePublic();
      const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

      // Update commission doc
      await commissionRef.update({
        status: "GENERATED",
        guarantorName: guarantorName,
        guarantorId: guarantorId || null,
        decreeUrl: pdfUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Automated Bonus - Add time_log for mentor
      const placementRef = db
        .collection("placements")
        .doc(commissionData.placementId);
      const timeLogRef = placementRef.collection("time_logs").doc();

      await timeLogRef.set({
        date: new Date().toISOString().split("T")[0],
        hours: 0,
        description: "Odměna za komisi - Jmenovací dekret",
        status: "approved", // Pre-approved
        type: "commission_bonus",
        amount: 1000, // Fixed rate for commission bonus
        mentorId: commissionData.mentorId,
        organizationId: commissionData.organizationId,
        studentId: commissionData.studentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, pdfUrl };
    } catch (error) {
      console.error("Decree Generation Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Error generating decree: ${error.message}`,
      );
    }
  },
);

// 13. RESOLVE LOGIN IDENTIFIER
exports.resolveLoginIdentifier = functions.https.onCall(
  async (data, context) => {
    const db = admin.firestore();
    const { identifier } = data;
    if (!identifier) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Chybí e-mail nebo Univerzitní ID.",
      );
    }

    // If identifier contains @, assume it's an email
    if (identifier.includes("@")) {
      const email = identifier.trim().toLowerCase();
      const querySnapshot = await db
        .collection("users")
        .where("email", "==", email)
        .get();
      if (querySnapshot.empty) {
        throw new functions.https.HttpsError(
          "not-found",
          "Přístup odepřen. Váš e-mail není v systému registrován.",
        );
      }
      return { email };
    } else {
      // Assume it's a University ID
      const universityId = identifier.trim();
      const querySnapshot = await db
        .collection("users")
        .where("universityId", "==", universityId)
        .get();

      if (querySnapshot.empty) {
        throw new functions.https.HttpsError(
          "not-found",
          "Přístup odepřen. Vaše Univerzitní ID nebylo nalezeno.",
        );
      }
      // Return the first match (should be unique)
      const userDoc = querySnapshot.docs[0];
      return { email: userDoc.data().email };
    }
  },
);

exports.updateSystemConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni.",
    );
  }

  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();
  if (
    !userDoc.exists ||
    (userDoc.data().role !== "admin" && userDoc.data().role !== "coordinator")
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Nemáte oprávnění.",
    );
  }

  const { docId, content, title, isCritical } = data;

  if (!docId || !content) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí povinné parametry.",
    );
  }

  try {
    await admin
      .firestore()
      .collection("system_configs")
      .doc(docId)
      .set(
        {
          id: docId,
          title: title || docId,
          content: content,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: context.auth.uid,
          isCritical: isCritical || false,
        },
        { merge: true },
      );

    return { success: true };
  } catch (error) {
    console.error("Error updating config:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Nepodařilo se uložit konfiguraci.",
      error.message,
    );
  }
});


// 14. CORRECT REFLECTION GRAMMAR (AI Sensei)
exports.correctReflectionGrammar = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni pro použití AI korektora."
    );
  }

  const { text } = data;

  if (!text || text.trim() === "") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí text k opravě."
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `Jsi profesionální jazykový korektor pro češtinu a slovenštinu.
Tvým jediným úkolem je opravit gramatické, pravopisné a stylistické chyby v zadaném textu.
ZÁSADNÍ PRAVIDLO: Nesmíš měnit sémantický význam, přidávat nové myšlenky ani odstraňovat existující informace.
Zachovej původní tón a záměr autora. Vrať POUZE opravený text bez jakýchkoliv komentářů nebo vysvětlivek.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: "Text k opravě:\n" + text }
    ]);

    const correctedText = result.response.text();

    return { correctedText: correctedText.trim() };
  } catch (error) {
    console.error("Error correcting grammar:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Nepodařilo se opravit gramatiku.",
      error.message
    );
  }
});

// Import public portfolio module
const publicPortfolio = require('./public_portfolio');
exports.updatePublicPortfolio = publicPortfolio.updatePublicPortfolio;


// Import Ping System
const pingSystem = require('./ping_system');
exports.pingMentorsScheduled = pingSystem.pingMentorsScheduled;
const impersonation = require('./impersonation');
exports.getImpersonationToken = impersonation.getImpersonationToken;
exports.stopImpersonating = impersonation.stopImpersonating;

// Import Sanitize DB Module
const sanitizeDb = require('./sanitize');
exports.sanitizeProductionDatabase = sanitizeDb.sanitizeProductionDatabase;


// Import Users Management Module
const usersModule = require('./users');
exports.createUserManually = usersModule.createUserManually;
