const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  try {
    console.log('Starting integration test...');

    // Create a doc in internships collection
    const internshipRef = db.collection('internships').doc();
    const docData = {
      status: 'UPLOADED',
      contract_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    };

    await internshipRef.set(docData);
    console.log(`Created document with ID: ${internshipRef.id}`);

    // Update status to 'ANALYZING'
    await internshipRef.update({ status: 'ANALYZING' });
    console.log(`Updated status to ANALYZING for document: ${internshipRef.id}`);

    // Poll every 1s (max 30s)
    const maxAttempts = 30;

    for (let i = 1; i <= maxAttempts; i++) {
        await sleep(1000);
        const doc = await internshipRef.get();
        if (!doc.exists) {
            console.error('Document disappeared!');
            process.exit(1);
        }

        const data = doc.data();
        const status = data.status;
        console.log(`Attempt ${i}: Current status is ${status}`);

        if (status === 'COMPLETED') {
            console.log('Success! Analysis completed.');
            console.log('Extracted Data:', JSON.stringify(data, null, 2));

            // Delete doc
            await internshipRef.delete();
            console.log('Document deleted.');
            process.exit(0);
        } else if (status === 'ERROR_ANALYSIS') {
            console.error('Error in analysis.');
            process.exit(1);
        }
    }

    console.error('Timeout waiting for status update.');
    process.exit(1);

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

runTest();
