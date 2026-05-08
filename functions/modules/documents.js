const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

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
      const { createCommissionDecreePdf } = require("../pdf_logic");
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
