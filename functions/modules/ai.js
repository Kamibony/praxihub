const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

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
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                organization_name: {
                  type: SchemaType.STRING,
                  description: "Názov firmy",
                  nullable: true
                },
                organization_ico: {
                  type: SchemaType.STRING,
                  description: "IČO firmy (iba čísla, bez medzier)",
                  nullable: true
                },
                start_date: {
                  type: SchemaType.STRING,
                  description: "Dátum začiatku praxe vo formáte YYYY-MM-DD",
                  nullable: true
                },
                end_date: {
                  type: SchemaType.STRING,
                  description: "Dátum konca praxe vo formáte YYYY-MM-DD",
                  nullable: true
                }
              },
              required: ["organization_name", "organization_ico", "start_date", "end_date"]
            }
          }
        });

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
          Nájdi názov organizácie, jej IČO (identifikačné číslo), dátum začiatku a konca praxe.
          Ak IČO nevieš nájsť, skús hľadať 8-miestne číslo označené ako IČO.
        `;

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64File, mimeType: mimeType } },
        ]);
        const cleanJson = result.response.text().trim();
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

exports.chatWithAI = functions.runWith({ memory: "512MB" }).https.onCall(async (data, context) => {
  // data obsahuje: { message: "Otázka užívateľa", role: "student/company/..." }

  const userMessage = data.message;
  const userRole = data.role || "visitor";

  try {
    const db = admin.firestore();
    let knowledgeBase = "No extra knowledge base found.";
    try {
      const kbDoc = await db.collection('system_configs').doc('chatbot_knowledge').get();
      if (kbDoc.exists && kbDoc.data().content) {
        knowledgeBase = kbDoc.data().content;
      }
    } catch (err) {
      console.warn("Could not fetch chatbot_knowledge from system_configs, using fallback.", err);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Systémové inštrukcie pre Chatbota
    const systemPrompt = `
   You are the intelligent assistant for PraxiHub, a university placement management platform.
   Your goal is to guide Students, Coordinators, and Companies through the app.
   You must answer in strict professional Czech language.

   KEY KNOWLEDGE BASE:
   ${knowledgeBase}

   BEHAVIOR:
   - Be concise and helpful.
   - Answer strictly in professional Czech.
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

exports.findMatches = functions.runWith({ memory: "1GB", timeoutSeconds: 300 }).https.onCall(async (data, context) => {
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
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              organizationId: {
                type: SchemaType.STRING,
                description: "ID firmy ze vstupu"
              },
              matchScore: {
                type: SchemaType.INTEGER,
                description: "Číslo 0-100 udávající skóre shody"
              },
              reasoning: {
                type: SchemaType.STRING,
                description: "Stručné vysvětlení v češtině, proč se hodí/nehodí (max 2 věty)"
              }
            },
            required: ["organizationId", "matchScore", "reasoning"]
          }
        }
      }
    });

    // Sanitize user inputs to prevent basic prompt injections
    const sanitizeText = (text) => text.replace(/<[^>]*>?/gm, '').substring(0, 500);
    const sanitizedStudentSkills = studentSkills.map(sanitizeText);
    const sanitizedCompanies = companies.map(c => ({
      id: c.id,
      name: sanitizeText(c.name),
      lookingFor: c.lookingFor.map(sanitizeText)
    }));

    const prompt = `
      You are a strict matchmaking engine. use ONLY the provided JSON data. DO NOT invent or assume any skills or requirements not explicitly listed. If a profile is empty, ignore it.

      Student má tyto dovednosti: ${sanitizedStudentSkills.join(", ")}.

      Zde je seznam firem a co hledají:
      ${JSON.stringify(sanitizedCompanies)}

      Úkol:
      Porovnej studentovy dovednosti s požadavky firem.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

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

exports.evaluateReflection = functions.runWith({ memory: "1GB", timeoutSeconds: 300 }).https.onCall(async (data, context) => {
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

    let krauDoc = await db.collection("system_configs").doc(configDocId).get();

    // Fallback to legacy rules if UPV rules not set yet
    if (!krauDoc.exists && major === "UPV") {
      krauDoc = await db
        .collection("system_configs")
        .doc("ai_krau_rules")
        .get();
    }

    let rulesContent = `Jste expertní hodnotitel studentských reflexí odborné praxe.
Hodnoťte text striktně podle 4 pilířů metodiky:
1. Oborově-předmětová a didaktická kompetence (didacticCompetence)
2. Pedagogická a psychologická kompetence (pedagogicalCompetence)
3. Komunikativní a sociální kompetence (socialCompetence)
4. Profesní a sebereflektivní kompetence (reflectiveCompetence)`;

    if (krauDoc.exists) {
      const contentRaw = krauDoc.data().content;
      try {
        const parsed = JSON.parse(contentRaw);
        if (parsed && typeof parsed === "object") {
          rulesContent = `
Jste expertní hodnotitel studentských reflexí odborné praxe.
## Metodika
${parsed.metodika || ""}

## Uznatelnost
${parsed.uznatelnost || ""}

## Kompetenční rámec
${parsed.kompetencni_ramec || ""}

Váš výstup musí být výhradně validní JSON objekt.
Veškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.`;
        } else {
          rulesContent =
            contentRaw +
            "\n\nVáš výstup musí být výhradně validní JSON objekt.\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";
        }
      } catch (e) {
        // Fallback for legacy plain text content
        rulesContent =
          contentRaw +
          "\n\nVáš výstup musí být výhradně validní JSON objekt.\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";
      }
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
      const { createCertificatePdf } = require("../pdf_logic");
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

exports.correctReflectionGrammar = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Musíte být přihlášeni pro použití AI korektora.",
      );
    }

    const { text } = data;

    if (!text || text.trim() === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Chybí text k opravě.",
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
        { text: "Text k opravě:\n" + text },
      ]);

      const correctedText = result.response.text();

      return { correctedText: correctedText.trim() };
    } catch (error) {
      console.error("Error correcting grammar:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Nepodařilo se opravit gramatiku.",
        error.message,
      );
    }
  },
);

exports.generateShowcaseNarration = functions.https.onCall(async (data, context) => {
  const { viewContext } = data;
  if (!viewContext) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chýba kontext pohľadu (viewContext).",
    );
  }

  try {
    const db = admin.firestore();
    let rulesData = {};
    try {
      const upvDoc = await db.collection('system_configs').doc('ai_rules_upv').get();
      const kpvDoc = await db.collection('system_configs').doc('ai_rules_kpv').get();
      if (upvDoc.exists) rulesData.upv = upvDoc.data().content;
      if (kpvDoc.exists) rulesData.kpv = kpvDoc.data().content;
    } catch (e) {
      console.warn("Failed to fetch ai_rules from system_configs", e);
    }

    if (Object.keys(rulesData).length === 0) {
      rulesData = {
        fallback: "System rules not found. Please ensure the knowledge base is populated."
      };
    }

    const systemState = {
      rules: rulesData,
      currentView: viewContext
    };

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are presenting the NEW IVP PRAXE system. Here is the raw JSON data defining the current rules/state:
${JSON.stringify(systemState)}

Explain this data into a 2-sentence spoken explanation. You must answer in strict professional Czech language. Do NOT hallucinate or add any outside information.
`;

    const result = await model.generateContent(prompt);
    return { narration: result.response.text() };
  } catch (error) {
    console.error("generateShowcaseNarration Error:", error);
    throw new functions.https.HttpsError("internal", "Nepodařilo se vygenerovat naraci: " + error.message);
  }
});

exports.routeDocument = functions.runWith({ memory: "1GB", timeoutSeconds: 300 }).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni.",
    );
  }

  const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== "admin" && userDoc.data().role !== "coordinator")) {
     throw new functions.https.HttpsError(
      "permission-denied",
      "Nemáte oprávnění."
    );
  }

  const { fileDataBase64, mimeType, textSample } = data;
  let textToParse = textSample || "";

  // If no text sample was provided (e.g. not CSV/Excel), extract from PDF/DOCX
  if (!textToParse && fileDataBase64) {
      if (mimeType === "application/pdf") {
          const buffer = Buffer.from(fileDataBase64, 'base64');
          try {
              const pdfParse = require('pdf-parse');
              const parsedData = await pdfParse(buffer);
              textToParse = parsedData.text;
          } catch (err) {
               throw new functions.https.HttpsError("internal", "Chyba při parsování PDF: " + err.message);
          }
      } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          const buffer = Buffer.from(fileDataBase64, 'base64');
          try {
              const mammoth = require("mammoth");
              const result = await mammoth.extractRawText({ buffer: buffer });
              textToParse = result.value;
          } catch (err) {
               throw new functions.https.HttpsError("internal", "Chyba při parsování DOCX: " + err.message);
          }
      } else {
         // Could be other template formats
         textToParse = "Neznámý obsah, pouze metadata souboru.";
      }
  }

  if (!textToParse) {
      textToParse = "Prázdný dokument.";
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
             category: {
                 type: SchemaType.STRING,
                 description: "Kategorie dokumentu: AI_RULE, ROSTER, TEMPLATE, COMPLIANCE nebo UNKNOWN."
             },
             department: {
                 type: SchemaType.STRING,
                 description: "Obor dokumentu: UPV, KPV nebo UNKNOWN."
             },
             confidence: {
                 type: SchemaType.INTEGER,
                 description: "Spolehlivost klasifikace 0-100."
             },
             reasoning: {
                 type: SchemaType.STRING,
                 description: "Krátké vysvětlení klasifikace česky."
             }
          },
          required: ["category", "department", "confidence", "reasoning"]
        }
      }
    });

    const prompt = `
You are an expert Document Classification AI for a university placement system.
Classify the following document extract into exactly one of the endpoints.

Categories:
1. AI_RULE: Contains methodologies, competency frameworks, or recognition rules (Metodika, Kompetenční rámec, Uznatelnost).
2. ROSTER: Contains lists of students, IDs, emails, hours, or organization details (typically from Excel/CSV).
3. TEMPLATE: Contains blank forms, placeholders (e.g., "[Jméno]", "Zde doplňte"), or generic templates for student/mentor use.
4. COMPLIANCE: Contains signed framework agreements, contracts, or legal compliance documents between the university and institutions.
5. UNKNOWN: If not explicitly clear.

Department Scope:
1. UPV: Učitelství (Teaching). Keywords: učitel, škola, pedagogika, didaktika, asistent pedagoga.
2. KPV: Poradenství (Counseling). Keywords: poradenství, poradce, psychologie, psycholog.
3. UNKNOWN: If not explicitly clear.

Text dokumentu k analýze (prvních pár tisíc znaků):
${textToParse.substring(0, 5000)}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedJson = JSON.parse(responseText);

    // If it's an AI_RULE and confidence is high, we can pre-parse it here
    // to save a second round-trip from the frontend.
    if (parsedJson.category === 'AI_RULE' && parsedJson.confidence >= 80) {
        const proModel = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                 metodika: {
                     type: SchemaType.STRING,
                     description: "Extrahovaná metodika (obecná pravidla a průběh praxe)."
                 },
                 uznatelnost: {
                     type: SchemaType.STRING,
                     description: "Extrahovaná pravidla uznatelnosti praxe."
                 },
                 kompetencni_ramec: {
                     type: SchemaType.STRING,
                     description: "Extrahovaný kompetenční rámec (pedagogické, didaktické a další kompetence)."
                 }
              },
              required: ["metodika", "uznatelnost", "kompetencni_ramec"]
            }
          }
        });

        const proPrompt = `
Analyzuj následující text dokumentu a extrahuj klíčové informace pro hodnocení studentských praxí.
Rozděl zjištěné informace do tří kategorií:
1. Metodika (obecná pravidla, jak má praxe probíhat)
2. Uznatelnost (pravidla pro uznání předchozí praxe nebo zaměstnání)
3. Kompetenční rámec (požadavky na kompetence studenta - oborové, pedagogické, atd.)

Ponech informace v profesionální češtině a stručném bodovém formátu. Pokud některá kategorie v dokumentu zcela chybí, vrať pro ni prázdný řetězec.

Text dokumentu k analýze:
${textToParse.substring(0, 30000)}
`;
        const proResult = await proModel.generateContent(proPrompt);
        const proParsed = JSON.parse(proResult.response.text());
        parsedJson.extractedRules = proParsed;
    }

    return parsedJson;

  } catch (error) {
    console.error("routeDocument Error:", error);
    throw new functions.https.HttpsError("internal", "Chyba při komunikaci s AI: " + error.message);
  }
});

exports.parseDocumentForAI = functions.runWith({ memory: "1GB", timeoutSeconds: 300 }).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni.",
    );
  }

  const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== "admin" && userDoc.data().role !== "coordinator")) {
     throw new functions.https.HttpsError(
      "permission-denied",
      "Nemáte oprávnění."
    );
  }

  const { fileDataBase64, mimeType } = data;
  if (!fileDataBase64) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Chybí fileDataBase64.",
    );
  }

  let textToParse = "";

  if (mimeType === "application/pdf") {
      const buffer = Buffer.from(fileDataBase64, 'base64');
      try {
          const pdfParse = require('pdf-parse');
          const parsedData = await pdfParse(buffer);
          textToParse = parsedData.text;
      } catch (err) {
           throw new functions.https.HttpsError("internal", "Chyba při parsování PDF: " + err.message);
      }
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const buffer = Buffer.from(fileDataBase64, 'base64');
      try {
          const mammoth = require("mammoth");
          const result = await mammoth.extractRawText({ buffer: buffer });
          textToParse = result.value;
      } catch (err) {
           throw new functions.https.HttpsError("internal", "Chyba při parsování DOCX: " + err.message);
      }
  } else {
      throw new functions.https.HttpsError("invalid-argument", "Nepodporovaný formát. Zkuste prosím PDF nebo DOCX.");
  }

  if (!textToParse) {
      throw new functions.https.HttpsError("internal", "Nepodařilo se extrahovat žádný text.");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use 2.5 pro for extraction as per memory for general functions
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
             metodika: {
                 type: SchemaType.STRING,
                 description: "Extrahovaná metodika (obecná pravidla a průběh praxe)."
             },
             uznatelnost: {
                 type: SchemaType.STRING,
                 description: "Extrahovaná pravidla uznatelnosti praxe."
             },
             kompetencni_ramec: {
                 type: SchemaType.STRING,
                 description: "Extrahovaný kompetenční rámec (pedagogické, didaktické a další kompetence)."
             }
          },
          required: ["metodika", "uznatelnost", "kompetencni_ramec"]
        }
      }
    });

    const prompt = `
Analyzuj následující text dokumentu a extrahuj klíčové informace pro hodnocení studentských praxí.
Rozděl zjištěné informace do tří kategorií:
1. Metodika (obecná pravidla, jak má praxe probíhat)
2. Uznatelnost (pravidla pro uznání předchozí praxe nebo zaměstnání)
3. Kompetenční rámec (požadavky na kompetence studenta - oborové, pedagogické, atd.)

Ponech informace v profesionální češtině a stručném bodovém formátu. Pokud některá kategorie v dokumentu zcela chybí, vrať pro ni prázdný řetězec.

Text dokumentu k analýze:
${textToParse.substring(0, 30000)} // Limit to avoid hitting context window excessively if file is massive
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedJson = JSON.parse(responseText);

    return parsedJson;

  } catch (error) {
     console.error("parseDocumentForAI Error:", error);
     throw new functions.https.HttpsError("internal", "Nepodařilo se zpracovat dokument pomocí AI: " + error.message);
  }
});
