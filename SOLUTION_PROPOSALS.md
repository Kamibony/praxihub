# Technical Solution Proposals

This document outlines proposed implementation strategies for addressing critical technical debt and executing Phase 7 features, based on the findings in the `TECHNICAL_STATE_REPORT.md`.

## 1. ARES API Refactoring

**Moving from mocks to real HTTP requests.**

*   **Proposed Technical Approach:**
    *   Update the `fetchAresAndLink` Cloud Function in `functions/index.js`.
    *   Utilize the existing `axios` dependency to make an HTTP GET request to the public ARES REST API endpoint (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`).
    *   Parse the structured JSON response to extract authentic data fields (`obchodniJmeno`, `ico`, `sidlo`, etc.).
    *   Update or create the corresponding document in the Firestore `organizations` collection with this verified data.
*   **Potential Risks & Trade-offs:**
    *   **Rate Limiting & Availability:** The ARES API may enforce rate limits or experience downtime. The function must include robust `try/catch` error handling.
    *   **Fallback Strategy:** If the ARES request fails, the system should gracefully notify the user and potentially allow manual entry as a fallback, rather than completely blocking the placement flow.
*   **Complexity & Order:**
    *   **Complexity:** Low.
    *   **Order:** Independent task. Can be executed immediately.

## 2. Re-activating E2E Testing

**Fixing the Playwright/Emulator infrastructure.**

*   **Proposed Technical Approach:**
    *   Remove the temporary `echo` override in the `test` scripts within `package.json` and `apps/web/package.json`.
    *   Create a dedicated setup script (e.g., `tests/global-setup.ts` or a bash wrapper) that strictly enforces a clean environment before booting Firebase Emulators. This script will identify and kill orphaned processes occupying critical ports (`3000`, `4000`, `5001`, `8080`) using standard Unix commands (like `lsof` and `kill`).
    *   Configure `playwright.config.ts` to utilize the `webServer` property to orchestrate the Next.js build (`next build`), static export serving, and Firebase Emulator initialization synchronously.
    *   Ensure environment variables (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, etc.) correctly point to the local emulators during the test run.
*   **Potential Risks & Trade-offs:**
    *   **CI/CD Pipeline Duration:** Running full Next.js builds and booting emulators will increase GitHub Actions build times.
    *   **Emulator Flakiness:** Booting the Java-based Firebase Emulator Suite can sometimes be flaky. We may need to introduce robust health checks (e.g., using `wait-on`) before Playwright starts executing tests.
*   **Complexity & Order:**
    *   **Complexity:** Medium.
    *   **Order:** High Priority. Must be completed *before* implementing Phase 7 to guarantee we don't introduce regressions into the complex state machine.

## 3. Dynamic AI Configuration

**Decoupling Gemini model versions from the static codebase into system_configs.**

*   **Proposed Technical Approach:**
    *   Expand the `system_configs` Firestore collection by creating a new document (e.g., `ai_settings`) to store active model configurations (`defaultModel: "gemini-2.5-pro"`, `fastModel: "gemini-2.5-flash"`).
    *   Refactor AI-dependent Cloud Functions (`analyzeContract`, `chatWithAI`, `evaluateReflection`, `parseDocumentForAI`, `correctReflectionGrammar`) to retrieve this configuration document at runtime.
    *   Implement global memory caching (outside the function handler scope) for these settings to minimize Firestore read operations and latency on subsequent invocations within the same container instance.
*   **Potential Risks & Trade-offs:**
    *   **Cold Start Latency:** The initial invocation will suffer a slight latency penalty due to the requisite Firestore read before executing the AI call.
    *   **Configuration Errors:** A typographical error in the database configuration could break AI functionality system-wide.
    *   **Safety Net:** Code must include hardcoded fallback model strings in case the `system_configs` read fails.
*   **Complexity & Order:**
    *   **Complexity:** Medium.
    *   **Order:** Independent task. Recommended to implement early to future-proof against model deprecations.

## 4. Phase 7 Implementation

**Architecture for Tripartite Digital Signatures & append-only audit_logs.**

*   **Proposed Technical Approach:**
    *   **Data Layer (Firestore):**
        *   Establish a new root-level collection: `audit_logs`.
        *   Configure `firestore.rules` to enforce strict append-only properties: `allow create: if request.auth != null; allow read, update, delete: if false;` (Ensuring only Admins/Backend can read or modify).
        *   Extend the `placements` document schema to include a `signatures` map object, tracking boolean states and timestamps for each role (Student, Institution, Coordinator).
    *   **Business Logic (Cloud Functions):**
        *   Develop a secure Callable Cloud Function named `signContract`.
        *   This function will extract the `request.auth.uid` and the client IP address via `context.rawRequest.ip`.
        *   It will execute a **Firestore Transaction** that simultaneously updates the relevant signature flag on the placement document AND writes a permanent, detailed record into the `audit_logs` collection, utilizing `admin.firestore.FieldValue.serverTimestamp()`.
    *   **Presentation Layer (Frontend UI):**
        *   Develop a reactive "Digital Signature" UI component integrated into the respective dashboards.
        *   The component will evaluate the placement's signature state and display a frictionless "Click-to-Sign" button exclusively to the authenticated user whose signature is pending.
*   **Potential Risks & Trade-offs:**
    *   **Legal Standing:** While this captures intent, identity (via auth), IP, and server timestamps, simple click-to-sign mechanisms offer lower assurance levels than cryptographic e-signatures (like DocuSign). The project stakeholders must validate this approach against internal compliance requirements.
    *   **Concurrency:** The strict requirement to use Firestore Transactions is crucial to prevent race conditions if multiple parties attempt to sign the contract simultaneously.
*   **Complexity & Order:**
    *   **Complexity:** High.
    *   **Order:** Core focus of Phase 7. Should follow the re-activation of E2E testing to ensure the signature workflow integrates seamlessly with the existing State Machine without disrupting current functionality.
