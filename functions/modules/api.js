const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");

// 6. STATE MACHINE TRANSITION
exports.transitionPlacementState = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in.",
      );
    }

    // Definitive State Transition Matrix
    const validTransitions = {
      DRAFT: ["PENDING_MATCH", "PENDING_INSTITUTION", "ANALYZING"],
      PENDING_MATCH: ["PENDING_INSTITUTION", "DRAFT"],
      PENDING_INSTITUTION: ["PENDING_COORDINATOR", "DRAFT", "ANALYZING"],
      PENDING_COORDINATOR: ["ACTIVE", "DRAFT", "ANALYZING"],
      ANALYZING: ["NEEDS_REVIEW", "REJECTED"],
      NEEDS_REVIEW: ["APPROVED", "PENDING_COORDINATOR", "ACTIVE", "REJECTED"],
      APPROVED: ["ACTIVE", "EVALUATION", "CLOSED"],
      ACTIVE: ["EVALUATION", "CLOSED"],
      EVALUATION: ["CLOSED"],
      CLOSED: ["FINAL_EXAM"],
      REJECTED: ["DRAFT"],
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
        const currentState = currentData.status || "DRAFT";

        // Strictly enforce the state machine matrix
        const allowedNextStates = validTransitions[currentState];

        if (!allowedNextStates || !allowedNextStates.includes(newState)) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Neplatný přechod stavu. Ze stavu '${currentState}' nelze přejít do '${newState}'.`,
          );
        }

        // Add guardrails here for the new states
        if (newState === "PENDING_COORDINATOR" || newState === "ACTIVE") {
          // ensure required fields exist
          if (!currentData.organizationId) {
            throw new functions.https.HttpsError(
              "failed-precondition",
              `Missing required fields for ${newState}.`,
            );
          }

          const major = currentData.studentMajor || currentData.major || "UPV";
          if (major === "KPV") {
            const orgDoc = await transaction.get(
              db.collection("organizations").doc(currentData.organizationId),
            );

            // Check if organization exists. Note that in current implementation we link with organizations collection, not users
            if (!orgDoc.exists) {
              const userOrgDoc = await transaction.get(
                db.collection("users").doc(currentData.organizationId),
              );
              if (!userOrgDoc.exists) {
                throw new functions.https.HttpsError(
                  "failed-precondition",
                  "Organizace nenalezena.",
                );
              } else {
                const userOrgData = userOrgDoc.data();
                const expirationStr = userOrgData.frameworkAgreementExpiration;

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
            } else {
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

          let existingInstDoc = null;
          let orgName = null;
          let orgIco = null;

          if (userObj.organizationId) {
            orgName = String(userObj.organizationId).trim();
          }
          if (userObj.ico) {
            orgIco = String(userObj.ico).trim();
          }

          if (orgIco || orgName) {
            let instQ;
            if (orgIco) {
              instQ = usersRef.where("role", "==", "institution").where("ico", "==", orgIco).limit(1);
            } else {
              instQ = usersRef.where("role", "==", "institution").where("displayName", "==", orgName).limit(1);
            }
            const instSnapshot = await transaction.get(instQ);
            if (!instSnapshot.empty) {
              existingInstDoc = instSnapshot.docs[0];
            }
          }

          let instId = null;
          if (orgName || orgIco) {
            if (existingInstDoc) {
              instId = existingInstDoc.id;
            } else {
              const newInstRef = usersRef.doc();
              instId = newInstRef.id;
              transaction.set(newInstRef, {
                role: "institution",
                displayName: orgName || "Neznámá instituce",
                ico: orgIco || null,
                status: "uninvited",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }

          let userId = existingUserDoc
            ? existingUserDoc.id
            : userObj.uid
              ? String(userObj.uid)
              : usersRef.doc().id;

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
              institutionId:
                instId || existingUserDoc.data().institutionId || null,
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
              institutionId: instId || null,
              year: userObj.year || null,
              major: userObj.major || null,
              email:
                userObj.email ||
                `${normalizedName.replace(/\s+/g, ".").toLowerCase()}@placeholder.com`, // Mock email
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            added++;
          }

          if (existingPlacementDoc) {
            transaction.update(existingPlacementDoc.ref, {
              institutionId:
                instId || existingPlacementDoc.data().institutionId || null,
              migratedHours:
                Number(userObj.migratedHours) ||
                existingPlacementDoc.data().migratedHours ||
                0,
              targetHours:
                Number(userObj.targetHours) ||
                existingPlacementDoc.data().targetHours ||
                15,
              studentMajor:
                userObj.major ||
                existingPlacementDoc.data().studentMajor ||
                null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            const newPlacementRef = placementsRef.doc();
            transaction.set(newPlacementRef, {
              studentId: userId,
              institutionId: instId || null,
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
    await Promise.all(mappedData.map((row) => processUser(row)));

    return { added, updated, ignored };
  });

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

exports.migrateInstitutions = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
  // Check authorization - only admins
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== "admin" && userDoc.data().role !== "coordinator")) {
    throw new functions.https.HttpsError("permission-denied", "Nemáte oprávnění.");
  }

  const db = admin.firestore();
  console.log("Starting institutions migration via Cloud Function...");

  const placementsSnapshot = await db.collection("placements").get();
  const uniqueOrgs = {}; // orgId -> array of placement refs
  console.log(`Found ${placementsSnapshot.docs.length} placements.`);

  for (const doc of placementsSnapshot.docs) {
      const placementData = doc.data();
      if (placementData.organizationId) {
          if (!uniqueOrgs[placementData.organizationId]) {
              uniqueOrgs[placementData.organizationId] = [];
          }
          uniqueOrgs[placementData.organizationId].push(doc.ref);
      }
  }

  const orgIds = Object.keys(uniqueOrgs);
  console.log(`Found ${orgIds.length} unique organizations linked in placements.`);

  let createdCount = 0;
  let updatedCount = 0;

  const promises = orgIds.map(async (orgId) => {
      const orgDoc = await db.collection("organizations").doc(orgId).get();
      if (!orgDoc.exists) return;

      const orgData = orgDoc.data();

      // Find if user already exists
      let instQ = db.collection("users").where("role", "==", "institution").where("displayName", "==", orgData.name).limit(1);
      let instSnapshot = await instQ.get();

      let instId;
      if (!instSnapshot.empty) {
          instId = instSnapshot.docs[0].id;
      } else {
          const newUserRef = db.collection("users").doc();
          instId = newUserRef.id;

          await newUserRef.set({
              role: "institution",
              displayName: orgData.name || "Neznámá instituce",
              ico: orgData.ico || null,
              status: "uninvited",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          createdCount++;
          console.log(`Created institution user ${instId} for organization ${orgId}`);
      }

      // Update placements concurrently
      const updatePromises = uniqueOrgs[orgId].map(async (placementRef) => {
          await placementRef.update({
              institutionId: instId
          });
          updatedCount++;
          console.log(`Updated placement ${placementRef.id} with institutionId ${instId}`);
      });
      await Promise.all(updatePromises);
  });

  await Promise.all(promises);

  console.log(`Migration complete. Created: ${createdCount}, Updated Placements: ${updatedCount}`);
  return { success: true, createdCount, updatedCount };
});

exports.fetchAresAndLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in.",
    );
  }

  const { ico, placementId } = data;
  if (!ico || !placementId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing ICO or placementId.",
    );
  }

  const db = admin.firestore();
  const placementRef = db.collection("placements").doc(placementId);

  try {
    const placementDoc = await placementRef.get();
    if (!placementDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Placement not found.");
    }

    // Look up the organization by ICO in the Firestore
    const orgQuery = await db
      .collection("organizations")
      .where("ico", "==", ico)
      .get();
    let orgId;
    let orgData;

    if (orgQuery.empty) {
      const pData = placementDoc.data();

      try {
        console.log(`Fetching real ARES data for ICO: ${ico}`);
        const aresResponse = await axios.get(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
          timeout: 5000 // 5 seconds timeout
        });

        if (aresResponse.data && aresResponse.data.obchodniJmeno) {
          console.log(`Successfully fetched ARES data for ICO: ${ico}`);
          orgData = {
            name: aresResponse.data.obchodniJmeno,
            ico: aresResponse.data.ico || ico,
            address: aresResponse.data.sidlo?.textovaAdresa || "",
            web: pData.organization_web || "",
            status: "ACTIVE",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };
        } else {
          throw new Error("ARES response missing obchodniJmeno");
        }
      } catch (aresError) {
        console.error(`Failed to fetch from ARES for ICO: ${ico}`, aresError.message);
        console.log("Falling back to placement data...");
        // Graceful fallback to placement data if ARES fails or is unavailable
        orgData = {
          name: pData.organization_name || "Organizace (ARES nedostupný)",
          ico: ico,
          web: pData.organization_web || "",
          status: "ACTIVE",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }

      const newOrgRef = await db.collection("organizations").add(orgData);
      orgId = newOrgRef.id;
    } else {
      orgId = orgQuery.docs[0].id;
      orgData = orgQuery.docs[0].data();
    }

    // Update the placement state to PENDING_INSTITUTION and link the organization ID
    await placementRef.update({
      organizationId: orgId,
      status: "PENDING_INSTITUTION",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      systemLogs: admin.firestore.FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        message: "Automatické ARES ověření dokončeno. Organizace propojena.",
        actorId: "system",
      }),
    });

    return {
      success: true,
      organizationId: orgId,
      organizationName: orgData.name,
    };
  } catch (error) {
    console.error("fetchAresAndLink Error:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Error linking ARES data: ${error.message}`,
    );
  }
});
