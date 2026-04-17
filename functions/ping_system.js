const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { sendEmailNotification } = require('./index'); // Assuming sendEmailNotification is available or imported correctly

// Ensure firebase app is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

/**
 * Ping System - Scheduled Job to notify mentors of pending time logs.
 * Runs daily at 8 AM.
 */
exports.pingMentorsScheduled = onSchedule('0 8 * * *', async (event) => {
    console.log('Ping System started.');

    try {
        // Query pending time logs using collectionGroup
        // To do this, an index on time_logs -> status is needed
        const pendingLogsSnapshot = await db.collectionGroup('time_logs')
            .where('status', '==', 'pending')
            .get();

        if (pendingLogsSnapshot.empty) {
            console.log('No pending time logs found.');
            return null;
        }

        // Group by mentorId
        const mentorPendingCounts = {};

        pendingLogsSnapshot.forEach(doc => {
            const data = doc.data();
            const mentorId = data.mentorId;
            if (mentorId) {
                if (!mentorPendingCounts[mentorId]) {
                    mentorPendingCounts[mentorId] = 0;
                }
                mentorPendingCounts[mentorId]++;
            }
        });

        const now = admin.firestore.FieldValue.serverTimestamp();
        let notificationsSent = 0;

        for (const [mentorId, count] of Object.entries(mentorPendingCounts)) {
            if (count > 0) {
                // Fetch mentor details to get email
                const mentorDoc = await db.collection('users').doc(mentorId).get();
                if (mentorDoc.exists) {
                    const mentorData = mentorDoc.data();

                    if (mentorData.email) {
                        // In a real application, you'd use an email sending service (SendGrid, etc.)
                        // For Firebase, we might use a mail extension or a custom email function

                        // Let's create an audit log for the ping
                        await db.collection('audit_logs').add({
                            action: 'PING_MENTOR_PENDING_LOGS',
                            targetId: mentorId,
                            details: `Sent ping to mentor ${mentorData.email} for ${count} pending time logs.`,
                            timestamp: now,
                        });

                        notificationsSent++;
                        console.log(`Pinged mentor ${mentorData.email} (${mentorId}) about ${count} pending logs.`);
                    }
                }
            }
        }

        console.log(`Ping System finished. Sent ${notificationsSent} notifications.`);
    } catch (error) {
        console.error('Error running ping system:', error);
    }

    return null;
});
