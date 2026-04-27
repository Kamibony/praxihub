const fs = require('fs');
let code = fs.readFileSync('functions/index.js', 'utf8');

// Replace the start of the importRoster function to add institution caching
let search = `  // Helper to normalize names
  const normalizeName = (name) => {`;

let replace = `  // Pre-process all unique institutions from the mappedData
  const uniqueInstitutions = [];
  const instMap = new Map(); // Maps orgName/ICO to user UID

  for (const row of mappedData) {
    const icoStr = row.ico ? String(row.ico).replace(/\\s/g, "") : null;
    const orgStr = row.organizationId ? String(row.organizationId).trim() : null;
    const key = icoStr || orgStr;
    if (key && !uniqueInstitutions.find(i => i.key === key)) {
      uniqueInstitutions.push({ key, icoStr, orgStr });
    }
  }

  // Pre-fetch or create institution users sequentially BEFORE processing placements to avoid race conditions
  for (const inst of uniqueInstitutions) {
    const { key, icoStr, orgStr } = inst;
    const usersRef = db.collection("users");

    // Attempt to find existing institution
    let existingInst = null;
    if (icoStr) {
      const q = usersRef.where("role", "==", "institution").where("ico", "==", icoStr).limit(1);
      const snap = await q.get();
      if (!snap.empty) existingInst = snap.docs[0];
    }
    if (!existingInst && orgStr) {
      // Try to find by name, displayName, or legacy field
      const q1 = usersRef.where("role", "==", "institution").where("displayName", "==", orgStr).limit(1);
      const snap1 = await q1.get();
      if (!snap1.empty) existingInst = snap1.docs[0];
      else {
         const q2 = usersRef.where("role", "==", "institution").where("name", "==", orgStr).limit(1);
         const snap2 = await q2.get();
         if (!snap2.empty) existingInst = snap2.docs[0];
      }
    }

    if (existingInst) {
      instMap.set(key, existingInst.id);
    } else {
      // Create new institution user
      const newInstRef = usersRef.doc();
      const isIco = /^[0-9]{6,10}$/.test(key);
      const newInstData = {
          role: "institution",
          displayName: isIco ? \`Organizace (IČO: \${key})\` : orgStr || key,
          status: "uninvited",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (icoStr || isIco) {
          newInstData.ico = icoStr || key;
      } else {
          newInstData.name = key; // legacy fallback
      }
      await newInstRef.set(newInstData);
      instMap.set(key, newInstRef.id);
    }
  }

  // Helper to normalize names
  const normalizeName = (name) => {`;

code = code.replace(search, replace);

// Now patch the transaction reads
let search2 = `        const orgsRef = db.collection("organizations");
        let existingOrgDoc = null;
        let orgName = null;
        if (userObj.organizationId) {
          orgName = String(userObj.organizationId).trim();
          const orgQ = orgsRef.where("name", "==", orgName).limit(1);
          const orgSnapshot = await transaction.get(orgQ);
          if (!orgSnapshot.empty) {
            existingOrgDoc = orgSnapshot.docs[0];
          }
        }`;

let replace2 = `        // Institutions are already resolved
        let institutionId = null;
        const icoStr = userObj.ico ? String(userObj.ico).replace(/\\s/g, "") : null;
        const orgStr = userObj.organizationId ? String(userObj.organizationId).trim() : null;
        const key = icoStr || orgStr;
        if (key) {
            institutionId = instMap.get(key) || null;
        }`;

code = code.replace(search2, replace2);

// Patch the transaction writes for the legacy organizations creation block
let search3 = `        let orgId = null;
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
        }`;

let replace3 = `        // Legacy orgs collection creation removed in favor of institution users via instMap`;

code = code.replace(search3, replace3);

// Patch existing placement updates
let search4 = `        if (existingPlacementDoc) {
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
        }`;

let replace4 = `        if (existingPlacementDoc) {
          transaction.update(existingPlacementDoc.ref, {
            institutionId: institutionId || existingPlacementDoc.data().institutionId || null,
            organizationId: orgStr || existingPlacementDoc.data().organizationId || null, // Keep legacy org name for backwards compatibility
            migratedHours: Number(userObj.migratedHours) || existingPlacementDoc.data().migratedHours || 0,
            targetHours: Number(userObj.targetHours) || existingPlacementDoc.data().targetHours || 15,
            studentMajor: userObj.major || existingPlacementDoc.data().studentMajor || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          const newPlacementRef = placementsRef.doc();
          transaction.set(newPlacementRef, {
            studentId: userId,
            institutionId: institutionId,
            organizationId: orgStr || null, // Keep legacy org name
            status: "DRAFT",
            migratedHours: Number(userObj.migratedHours) || 0,
            targetHours: Number(userObj.targetHours) || 15,
            studentMajor: userObj.major || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }`;

code = code.replace(search4, replace4);

fs.writeFileSync('functions/index.js', code);
console.log("Patched successfully!");
