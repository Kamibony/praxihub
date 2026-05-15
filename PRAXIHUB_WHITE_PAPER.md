# PRAXIHUB_WHITE_PAPER
## Master Blueprint (Current State & Gap Analysis)

This document serves as the definitive, exhaustive documentation of the PraxiHub system as it exists right now in the codebase. It details the architecture, data models, functional features, and provides a gap analysis for pending work.

---

## 1. System Architecture & Technology Stack

### Frontend Overview
- **Framework:** Next.js (React) using the App Router.
- **Export Strategy:** Configured for strict static export (`output: 'export'` in `next.config.mjs`), meaning it generates static HTML/JS and relies heavily on client-side fetching via the Firebase SDKs rather than server-side rendering (SSR) or Next.js server APIs.
- **Styling:** Tailwind CSS is used extensively for responsive design. The project implements a custom Glassmorphism style with predefined utility classes like `.card` and `.btn-primary`.
- **Theming:** Handled by `next-themes`, providing `<ThemeProvider>` support across the application for toggling between dark (slate-900 based) and light modes without hardcoded specific slate classes everywhere.

### Backend Overview
- **Infrastructure:** Serverless Architecture powered entirely by Firebase.
- **Data & Auth:** Uses Firebase Authentication for identity management and Firestore (NoSQL) for the primary database. File storage is managed via Firebase Storage.
- **Cloud Functions:** Complex backend logic, integration, and security-sensitive operations are executed via Firebase Callable Cloud Functions (`functions/`).
- **Optimization:** To mitigate cold start delays and memory limits, heavy dependencies (like `pdf-parse`, `mammoth`, and `@google/generative-ai`) are lazy-loaded *inside* the function handler blocks (`functions/index.js`), rather than at the top level. Functions are also configured with explicit resource allocations (`runWith({ memory: "1GB", timeoutSeconds: 300 })`).

### AI Integration
- **Models:** Utilizes Google Gemini 2.5 Flash and Gemini 2.5 Pro via the `@google/generative-ai` SDK.
- **Structure Enforcement:** Relies on the native Gemini API `responseSchema` configuration along with `responseMimeType: "application/json"` to strictly enforce structured JSON outputs and avoid brittle string parsing (e.g., stripping Markdown blocks).
- **Dynamic Context:** AI system prompts and knowledge bases are not hardcoded but dynamically fetched from the `system_configs` Firestore collection (e.g., `ai_rules_upv`, `chatbot_knowledge`), allowing administrators to adjust rules without codebase deployments.

---

## 2. Data Models & State Machine (Deep Dive)

### Core Firestore Collections

1. **`users`**: Contains user identity and role mapping.
   - Tied to Firebase Auth UID (`uid`).
   - Fields include `name`, `email`, `role` (`STUDENT`, `INSTITUTION`, `COORDINATOR`, `ADMIN`), and academic details (`major`, `skills`).

2. **`placements`**: The central entity representing a student's internship lifecycle.
   - Uses foreign keys: `studentId` (maps to `users`), `institutionId` (maps to `users`), `organizationId` (maps to `organizations`).
   - Fields include: `status`, `description`, `targetHours`, `migratedHours`.
   - **Time Logs (`time_logs` subcollection):** Student work logs are stored here.
   - **Hours Tracking Reality:** Hours are currently tracked as a **single monolithic number**. The `time_logs` subcollection contains documents with a simple numeric `hours` field. There is currently no schema support for separating hours into categories (e.g., theoretical vs. practical).

3. **`audit_logs`**: An append-only collection for compliance and security.
   - Used for the Tripartite Digital Signature system.
   - Records `userId`, `action`, `timestamp`, `ip`, and `documentId`.

### Placement State Machine
The lifecycle of a placement is strictly governed by the `status` field.
- **Valid States:** `DRAFT` -> `PENDING_MATCH` / `PENDING_INSTITUTION` -> `PENDING_COORDINATOR` -> `ACTIVE` -> `EVALUATION` -> `CLOSED` -> `FINAL_EXAM`.
- **Security Enforcement:** The `firestore.rules` are configured to prevent direct modification of the `status` field by client applications (e.g., `!affectedKeys().hasAny(['status'])`). All state transitions must be executed through callable Cloud Functions, ensuring proper business logic validation for each transition.

---

## 3. Implemented Features (What is 100% functional today)

### RBAC (Custom Claims) and Authentication
- **Authentication:** Employs Firebase Auth with Passwordless "Magic Links" (`sendSignInLinkToEmail`).
- **RBAC:** Roles are enforced through Firebase Auth Custom Claims (`request.auth.token.role`), which are validated directly in `firestore.rules` (`isAdmin()`, `isCoordinator()`). This prevents unnecessary database reads for authorization.

### WORM Storage Security for Contracts
- Storage rules (`storage.rules`) strictly enforce WORM (Write-Once-Read-Many) compliance for contracts.
- Once a file is uploaded to `match /contracts/{userId}/{fileName}`, the rule `allow update, delete: if false;` ensures the file cannot be modified or deleted by anyone.

### AI Smart Uploader & Document Routing
- Located in the Admin Document Center.
- Triggers the `routeDocument` Cloud Function using `gemini-2.5-flash`.
- Analyzes uploaded files (PDF/DOCX) and classifies them across 4 categories and 2 departments (UPV/KPV).
- Features an 80% confidence threshold fallback; if AI confidence is low, it prompts the Admin in the UI for manual override routing.

### AI Evaluation Logic (`evaluateReflection`)
- Utilizes the `evaluateReflection` Cloud Function.
- Fetches specific rule sets dynamically from `system_configs/ai_rules_upv` or `system_configs/ai_rules_kpv`.
- These rules contain `metodika` (methodology), `uznatelnost` (recognition rules), and `kompetencni_ramec` (competency frameworks) in stringified JSON.
- Evaluates student reflections according to MŠMT KRAU standards, passing or failing logs based on the provided dynamic context.

---

## 4. Architectural Gaps & Pending Work

Based on the current codebase state, the following items require new development or restructuring to meet future business requirements:

### Specific Methodologies (UPV vs. KPV Hours Tracking)
- **Current State:** The system tracks hours through a generic `hours` field (monolithic integer) inside the `time_logs` subcollection and tallies a flat `targetHours` vs `migratedHours` on the placement.
- **Gap:** There is no structural support to distinguish between "10 theoretical + 2 practical observations" for UPV, or "shadowing and case studies" for KPV.
- **Pending Work:** The database schema for `time_logs` must be expanded to include `category` or `logType` enumerations. The UI in the Student Dashboard and the progress logic in Cloud Functions must be updated to track and display progress across multiple specialized axes instead of a single progress bar.

### Voice Diaries
- **Current State:** The HTML5 Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) is natively implemented in the UI (`apps/web/app/student/dashboard/page.tsx`). Dictation is functional and uses an `enhanceVoiceLog` Cloud Function.
- **Gap:** None in terms of basic functionality.
- **Pending Work:** Ongoing maintenance for browser compatibility (e.g., iOS Safari support for Web Speech API).

### PDF Skill Matrix
- **Current State:** PDF generation is active via `functions/pdf_logic.js` (using `pdf-lib` and `qrcode`), successfully creating standard Certificates (`createCertificatePdf`) and Commission Decrees (`createCommissionDecreePdf`) with embedded verification QR codes.
- **Gap:** There is currently no dynamic PDF generator for a final "Competency List" or "Skill Matrix" document. Skills are stored in the user profile (`skills` array) and displayed via a Recharts RadarChart in the UI, but they are not serialized into a PDF artifact at the end of a placement.
- **Pending Work:** A new PDF template function must be authored in `pdf_logic.js` that maps the student's evaluated competencies against the MŠMT KRAU framework and generates a downloadable "Competency List" PDF.

### Telemetry & Research Logging
- **Current State:** The project includes the `@opentelemetry/api` dependency. However, there is no active telemetry module implemented to capture granular user interaction.
- **Gap:** The system does not capture every text version or keystroke of student reflections into a JSON-based research log. Changes to text areas are handled by standard React state, and only final submissions are sent to Firestore.
- **Pending Work:** Implement a dedicated telemetry provider (e.g., a custom hook or an integration with a service) that periodically syncs raw text area deltas and keystroke counts to a dedicated Firestore collection (e.g., `research_telemetry`) for analytical purposes.

### Payroll/Commissions
- **Current State:** A robust foundation exists. The UI (`apps/web/app/admin/dashboard/page.tsx`) features functional `PAYROLL` and `COMMISSIONS` tabs. The backend includes the `generatePayrollReport` and `generateCommissionDecree` Cloud Functions.
- **Gap:** While the scaffolding and export functions are present, it relies on aggregating basic logged hours.
- **Pending Work:** Verify if the current `generatePayrollReport` correctly handles varying hourly rates per institution or mentor, and if it meets all specific invoicing requirements for the Czech accounting standards. The underlying structure exists and is functional.