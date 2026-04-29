const fs = require('fs');

const indexJsPath = 'functions/index.js';
let content = fs.readFileSync(indexJsPath, 'utf8');

const parseDocumentForAIFunc = `
// 15. PARSE DOCUMENT FOR AI KNOWLEDGE BASE
exports.parseDocumentForAI = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Musíte být přihlášeni.",
    );
  }

  const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (userDoc.data().role !== "admin" && userDoc.data().role !== "coordinator") {
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
      const pdfParse = require('pdf-parse');
      const buffer = Buffer.from(fileDataBase64, 'base64');
      try {
          const parsedData = await pdfParse(buffer);
          textToParse = parsedData.text;
      } catch (err) {
           throw new functions.https.HttpsError("internal", "Chyba při parsování PDF: " + err.message);
      }
  } else {
      throw new functions.https.HttpsError("invalid-argument", "Nepodporovaný formát. Zkuste prosím PDF.");
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

    const prompt = \`
Analyzuj následující text dokumentu a extrahuj klíčové informace pro hodnocení studentských praxí.
Rozděl zjištěné informace do tří kategorií:
1. Metodika (obecná pravidla, jak má praxe probíhat)
2. Uznatelnost (pravidla pro uznání předchozí praxe nebo zaměstnání)
3. Kompetenční rámec (požadavky na kompetence studenta - oborové, pedagogické, atd.)

Ponech informace v profesionální češtině a stručném bodovém formátu. Pokud některá kategorie v dokumentu zcela chybí, vrať pro ni prázdný řetězec.

Text dokumentu k analýze:
\${textToParse.substring(0, 30000)} // Limit to avoid hitting context window excessively if file is massive
\`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedJson = JSON.parse(responseText);

    return parsedJson;

  } catch (error) {
     console.error("parseDocumentForAI Error:", error);
     throw new functions.https.HttpsError("internal", "Nepodařilo se zpracovat dokument pomocí AI: " + error.message);
  }
});
`;

content += '\n' + parseDocumentForAIFunc;
fs.writeFileSync(indexJsPath, content);
console.log('Function added.');
