const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

// Sub-modules exports
const ai = require("./modules/ai");
const api = require("./modules/api");
const documents = require("./modules/documents");

// 1. AI & Core Functions
exports.analyzeContract = ai.analyzeContract;
exports.chatWithAI = ai.chatWithAI;
exports.findMatches = ai.findMatches;
exports.evaluateReflection = ai.evaluateReflection;
exports.testEvaluateReflection = ai.testEvaluateReflection;
exports.routeDocument = ai.routeDocument;
exports.parseDocumentForAI = ai.parseDocumentForAI;
exports.generateShowcaseNarration = ai.generateShowcaseNarration;
exports.correctReflectionGrammar = ai.correctReflectionGrammar;

// 2. API & Database Functions
exports.transitionPlacementState = api.transitionPlacementState;
exports.signContract = api.signContract;
exports.importRoster = api.importRoster;
exports.generatePayrollReport = api.generatePayrollReport;
exports.resolveLoginIdentifier = api.resolveLoginIdentifier;
exports.updateSystemConfig = api.updateSystemConfig;
exports.migrateInstitutions = api.migrateInstitutions;
exports.fetchAresAndLink = api.fetchAresAndLink;

// 3. Documents & PDF Functions
exports.createContractPDF = documents.createContractPDF;
exports.generateCommissionDecree = documents.generateCommissionDecree;

// Legacy / standalone modules
const publicPortfolio = require("./public_portfolio");
exports.updatePublicPortfolio = publicPortfolio.updatePublicPortfolio;

const pingSystem = require("./ping_system");
exports.pingMentorsScheduled = pingSystem.pingMentorsScheduled;

const impersonation = require("./impersonation");
exports.getImpersonationToken = impersonation.getImpersonationToken;
exports.stopImpersonating = impersonation.stopImpersonating;

const sanitizeDb = require("./sanitize");
exports.sanitizeProductionDatabase = sanitizeDb.sanitizeProductionDatabase;

const usersModule = require("./users");
exports.createUserManually = usersModule.createUserManually;

// Uncategorized / legacy direct export
const functions = require("firebase-functions/v1");

exports.sendEmailNotification = functions.firestore
  .document("placements/{docId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    // Ak sa zmenil status, pošleme mail
    if (newData.status !== previousData.status) {
      const emailDoc = {
        to: newData.studentEmail,
        message: {
          subject: `PraxiHub: Zmena stavu zmluvy na ${newData.status}`,
          text: `Ahoj, stav tvojej zmluvy sa zmenil na: ${newData.status}. Skontroluj si dashboard.`,
          html: `<p>Ahoj,</p><p>stav tvojej zmluvy sa zmenil na: <strong>${newData.status}</strong>.</p><p><a href="https://praxihub-app.web.app">Prejsť na Dashboard</a></p>`,
        },
      };

      // Zapíšeme do kolekcie 'mail', ktorú sleduje rozšírenie Trigger Email
      await admin.firestore().collection("mail").add(emailDoc);
      console.log(
        `📧 E-mail požiadavka vytvorená pre: ${newData.studentEmail}`,
      );
    }
    return null;
  });
