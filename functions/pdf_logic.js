const admin = require("firebase-admin");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const QRCode = require("qrcode");

async function createCertificatePdf(snapshotData, snapshotId) {
  const fontRes = await fetch(
    "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf",
  );
  const fontBytes = await fontRes.arrayBuffer();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  // Header
  const headerText = "Certifikát o absolvování odborné praxe";
  const headerWidth = customFont.widthOfTextAtSize(headerText, 18);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: height - 100,
    size: 18,
    font: customFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Student: ${snapshotData.studentName}`, {
    x: 50,
    y: height - 160,
    size: 14,
    font: customFont,
  });
  page.drawText(
    `Společnost: ${snapshotData.companyName || snapshotData.organization_name || "Neznámá"}`,
    { x: 50, y: height - 190, size: 14, font: customFont },
  );
  if (snapshotData.start_date && snapshotData.end_date) {
    page.drawText(
      `Termín: ${snapshotData.start_date} - ${snapshotData.end_date}`,
      { x: 50, y: height - 220, size: 14, font: customFont },
    );
  }

  if (
    snapshotData.studentMajor === "UPV" ||
    snapshotData.major === "UPV" ||
    (!snapshotData.studentMajor && !snapshotData.major)
  ) {
    page.drawText(`Hodnocení AI (MŠMT KRAU): Úspěšně splněno`, {
      x: 50,
      y: height - 260,
      size: 14,
      font: customFont,
      color: rgb(0, 0.5, 0),
    });
  } else {
    page.drawText(`Hodnocení AI: Úspěšně splněno`, {
      x: 50,
      y: height - 260,
      size: 14,
      font: customFont,
      color: rgb(0, 0.5, 0),
    });
  }

  const dateText = `Vydáno: ${new Date().toLocaleDateString("cs-CZ")}`;
  page.drawText(dateText, {
    x: 50,
    y: height - 300,
    size: 12,
    font: customFont,
  });
  page.drawText(`ID záznamu: ${snapshotId}`, {
    x: 50,
    y: height - 320,
    size: 10,
    font: customFont,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(
    `https://praxihub-app.web.app/verify?id=${snapshotId}`,
  );
  const qrImage = await pdfDoc.embedPng(qrCodeDataUrl);

  page.drawImage(qrImage, {
    x: width - 150,
    y: height - 250,
    width: 100,
    height: 100,
  });

  return await pdfDoc.save();
}

async function createCommissionDecreePdf(decreeData, decreeId) {
  const fontRes = await fetch(
    "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf",
  );
  const fontBytes = await fontRes.arrayBuffer();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  // Header
  const headerText = "Jmenovací dekret komise";
  const headerWidth = customFont.widthOfTextAtSize(headerText, 18);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: height - 100,
    size: 18,
    font: customFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Student: ${decreeData.studentName}`, {
    x: 50,
    y: height - 160,
    size: 14,
    font: customFont,
  });
  page.drawText(
    `Škola (Organizace): ${decreeData.organizationName || "Neznámá"}`,
    { x: 50, y: height - 190, size: 14, font: customFont },
  );
  page.drawText(
    `Mentor: ${decreeData.mentorName || "Neznámý"}`,
    { x: 50, y: height - 220, size: 14, font: customFont },
  );
  page.drawText(
    `Ředitel: ${decreeData.principalName || "Neznámý"}`,
    { x: 50, y: height - 250, size: 14, font: customFont },
  );
  page.drawText(
    `Garant IVP: ${decreeData.guarantorName || "Neznámý"}`,
    { x: 50, y: height - 280, size: 14, font: customFont },
  );

  const dateText = `Vydáno: ${new Date().toLocaleDateString("cs-CZ")}`;
  page.drawText(dateText, {
    x: 50,
    y: height - 320,
    size: 12,
    font: customFont,
  });
  page.drawText(`ID dekretu: ${decreeId}`, {
    x: 50,
    y: height - 340,
    size: 10,
    font: customFont,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(
    `https://praxihub-app.web.app/verify?id=${decreeId}`,
  );
  const qrImage = await pdfDoc.embedPng(qrCodeDataUrl);

  page.drawImage(qrImage, {
    x: width - 150,
    y: height - 250,
    width: 100,
    height: 100,
  });

  return await pdfDoc.save();
}

module.exports = { createCertificatePdf, createCommissionDecreePdf };
