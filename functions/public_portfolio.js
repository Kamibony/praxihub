const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Ensure firebase app is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

/**
 * Cloud Function to update the public portfolio projection.
 * This function triggers whenever a user document is updated.
 * It strictly creates a sanitized snapshot in the 'public_portfolios' collection.
 */
exports.updatePublicPortfolio = onDocumentUpdated('users/{userId}', async (event) => {
  const newValue = event.data.after.data();
  const userId = event.params.userId;

  // We only care about students and if they have opted-in (assuming researchConsent or a specific portfolio flag)
  if (newValue.role !== 'student' || !newValue.researchConsent) {
      // If they opted out or changed role, we might want to delete the portfolio
      try {
         await db.collection('public_portfolios').doc(userId).delete();
      } catch (e) {
          // Ignore if it doesn't exist
      }
      return null;
  }

  // Calculate stats from their placements (this might be better done directly when placements update, but for simplicity we can do it here or aggregate)
  // To keep it simple and safe from N+1, we will query completed placements for this student
  let completedPlacementsCount = 0;
  let totalHours = 0;
  let skills = [
      { skill: 'Didaktická', level: 0 },
      { skill: 'Pedagogická', level: 0 },
      { skill: 'Sociální', level: 0 },
      { skill: 'Reflektivní', level: 0 }
  ];

  try {
      const placementsRef = db.collection('placements');
      const q = placementsRef.where('studentId', '==', userId).where('status', '==', 'CLOSED');
      const snapshot = await q.get();

      completedPlacementsCount = snapshot.size;

      let totalScores = {
          didaktická: 0,
          pedagogická: 0,
          sociální: 0,
          reflektivní: 0
      };

      let evaluatedCount = 0;

      snapshot.forEach(doc => {
          const data = doc.data();
          totalHours += (data.totalHours || 0);

          if (data.evaluationResult) {
              evaluatedCount++;
              // MŠMT KRAU pillars
              totalScores.didaktická += (data.evaluationResult.didacticCompetence?.score || 0);
              totalScores.pedagogická += (data.evaluationResult.pedagogicalCompetence?.score || 0);
              totalScores.sociální += (data.evaluationResult.socialCompetence?.score || 0);
              totalScores.reflektivní += (data.evaluationResult.reflectiveCompetence?.score || 0);
          }
      });

      if (evaluatedCount > 0) {
          skills = [
              { skill: 'Didaktická', level: Math.round(totalScores.didaktická / evaluatedCount) },
              { skill: 'Pedagogická', level: Math.round(totalScores.pedagogická / evaluatedCount) },
              { skill: 'Sociální', level: Math.round(totalScores.sociální / evaluatedCount) },
              { skill: 'Reflektivní', level: Math.round(totalScores.reflektivní / evaluatedCount) }
          ];
      }

  } catch (error) {
      console.error('Error fetching placements for portfolio:', error);
  }

  // Sanitized projection
  const sanitizedPortfolio = {
      displayName: newValue.name || 'Anonymní student',
      major: newValue.major || '',
      bio: newValue.bio || '',
      avatarUrl: newValue.photoURL || '',
      skills: skills,
      completedPlacements: completedPlacementsCount,
      totalHours: totalHours,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('public_portfolios').doc(userId).set(sanitizedPortfolio, { merge: true });

  return null;
});
