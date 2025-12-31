
const { PDFDocument } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

async function verifyFont() {
  const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/roboto-fontface/0.10.0/fonts/roboto/Roboto-Regular.ttf';
  console.log(`Fetching font from: ${fontUrl}`);

  try {
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) {
      throw new Error(`Failed to fetch font: ${fontRes.status} ${fontRes.statusText}`);
    }
    const fontBytes = await fontRes.arrayBuffer();
    console.log(`Font fetched successfully. Size: ${fontBytes.byteLength} bytes`);

    console.log('Creating PDF document...');
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    console.log('Embedding font...');
    const customFont = await pdfDoc.embedFont(fontBytes);

    console.log('Font embedded successfully!');

    const page = pdfDoc.addPage();
    page.drawText('Test Font', {
      x: 50,
      y: 50,
      font: customFont,
      size: 20,
    });

    console.log('Text drawn successfully with custom font.');
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyFont();
