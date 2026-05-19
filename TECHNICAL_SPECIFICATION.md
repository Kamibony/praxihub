# Master Technical Specification: PraxiHub v1.0

## Executive Summary
This document is the definitive, exhaustive Master Technical Specification for PraxiHub v1.0. It documents every subsystem, business rule, and architectural decision that forms the foundation of the platform.

---

## 1. System Architecture & Auth Blueprint

### 1.1 High-Level Topology
PraxiHub is constructed as a Serverless Modular Monolith.
- **Frontend Framework:** Next.js (React) utilizing the App Router, strictly configured for static export (`output: 'export'` in `next.config.mjs`). Server Actions and standard API routes are inherently disabled to support pure client-side static hosting on platforms like Firebase Hosting.
- **Backend & Database:** Firebase Cloud Functions (Node.js) serve as the backend execution environment, interfacing with Firebase Firestore (NoSQL) as the primary data store and Firebase Storage for binary assets.
- **AI Integration Engine:** Powered by Google Gemini (`gemini-2.5-flash` and `gemini-2.5-pro`) managed within the Firebase Cloud Functions to parse documents, evaluate reflections, and route uploads.

### 1.2 Next.js App Router Structure
The application employs standard Next.js App Router patterns, strictly localized under `apps/web/app/`:
- **`apps/web/app/login` & `apps/web/app/signup`:** Public authentication gateways.
- **`apps/web/app/admin/*`:** Dedicated routes for system administrators (e.g., `/dashboard`, `/documents`, `/payroll`, `/users`).
- **`apps/web/app/institution/*`:** Unified portal for schools, mentors, and corporate entities.
- **`apps/web/app/student/*`:** Primary interface for students tracking practice hours.
- **`apps/web/app/p/[studentId]`:** Dynamic public route for Live E-Portfolios. Utilizes `generateStaticParams()` to output fallback HTML files, with dynamic resolution handled client-side using `useParams()` to fetch data from Firestore.
- **`apps/web/app/consent` & `apps/web/app/showcase`:** Informational and interactive system views.

### 1.3 Custom Auth Claims RBAC Model & Magic Links
Authentication is fundamentally passwordless, utilizing Firebase Auth Magic Links (email/link provider). This reduces friction for students and institutional mentors while eliminating password fatigue.

**Role-Based Access Control (RBAC):**
Authorization is executed via Firebase Custom Auth Claims instead of inefficient database reads. Roles are injected into the JWT token (`request.auth.token.role`) and strictly evaluated by `firestore.rules`.
- `STUDENT`: Base participant role.
- `INSTITUTION`: Aggregated role encompassing Mentors, Companies, and Partner Schools.
- `COORDINATOR`: Institutional administrator mapping to university coordinators.
- `ADMIN`: Global system super-user.

---

## 2. UI/UX Engineering & State Management

### 2.1 Theme Provider Systems (`next-themes`)
The global design system implements an "Enterprise Light Mode" and Dark Mode strictly adhering to Tailwind CSS semantic CSS variables (`--background`, `--primary`, `--accent`) defined in `apps/web/globals.css`. Hardcoded utility classes like `slate-900` are explicitly avoided. Theming state is managed cross-application via the `next-themes` library injected at the root `layout.tsx`.

### 2.2 Global Command Palette (`cmdk`)
High-speed navigation for Administrative and Institutional users is implemented via a Command Palette component (`apps/web/components/CommandPalette.tsx`). Powered by the `cmdk` library and bound to `⌘K`, this component enables rapid cross-entity search (students, institutions, placements) without leaving the current view context.

### 2.3 Micro-interactions & Visual Feedback
To bridge the gap between static SPA state and asynchronous backend operations:
- **Progressive Disclosure:** `@formkit/auto-animate` is heavily utilized to provide smooth DOM transitions during step-by-step wizards.
- **Global Notifications:** Synchronous feedback is provided via toast notifications (`sonner` or `react-hot-toast`), integrated into the root layout to inform users of successful state transitions or AI classifications.
- **UAT Gates:** All unreleased components are wrapped in the `<UatGate />` (`apps/web/components/UatGate.tsx`) component to restrict visibility based on environment configuration or admin claims.

### 2.4 Persistent Draft Storage (`useDraftStorage`)
To prevent data loss in highly complex forms (e.g., Student Onboarding, Contract Generation), a custom hook (`useDraftStorage`) is implemented. This hook automatically serializes `formData` and `currentStep` states to `localStorage`, allowing users to safely refresh their browsers or return to the application hours later without losing form progress.

### 2.5 Administrative Impersonation Layer
Admins can debug specific user scenarios by impersonating target accounts via the `getImpersonationToken` Cloud Function (`functions/impersonation.js`).
1. The Admin requests to impersonate a User UID.
2. The Cloud Function securely verifies the Admin claim, then mints a custom Firebase token for the target UID containing an extra `impersonatorUid` claim.
3. The frontend (`apps/web/components/ImpersonationBanner.tsx`) detects this claim and renders a sticky banner allowing the Admin to immediately revert the session via `stopImpersonating`.

---

## 3. The Core "Pedagogická praxe" Subsystem

### 3.1 Live Tracker (Náslechy)
The `Náslechy` module operates as a chronological interactive stopwatch tracking tool. It measures live dynamics of a classroom. Specifically, it distinguishes the speaking duration of "Učitel hovoří" (Teacher speaking) versus "Student hovoří" (Student speaking). Timestamps and state transitions are meticulously recorded within the `time_logs` subcollection to generate retrospective analysis charts.

### 3.2 Evaluation Matrix (Výstupy)
The `Výstupy` module supports Microteaching Rubrics structured according to the official MŠMT KRAU criteria.
- **Dynamic Configuration:** Criteria are fetched dynamically from the `system_configs/ai_krau_rules` Firestore document. They are never hardcoded.
- **Debounced Sync:** The UI matrices employ `lodash.debounce` to synchronize changes to Firestore. This approach prevents `WRITE_EXCEEDED` database limits and controls bandwidth while auto-saving complex evaluation scores.

### 3.3 Reflection Engine (Reflexe)
Students compile post-practicum reflections directly in the UI.
- **HTML5 Web Speech API:** Integrated directly into the reflection text areas, allowing students to dictate their logs (Voice Diaries).
- **AI-Assisted Proofreading:** Submitted reflections are parsed by the `evaluateReflection` Cloud Function. This function uses Gemini 2.5 to grade the text strictly against MŠMT KRAU rules and auto-correct grammatical inconsistencies.

---

## 4. AI Automation & Telemetry

### 4.1 Gemini-Powered Document Extraction (Smart Uploader)
The Admin Document Center (`apps/web/app/admin/documents/page.tsx`) features an AI-driven Smart Uploader pipeline.
- **Execution Path:** Uploaded PDF/DOCX files trigger the `routeDocument` Cloud Function (`functions/index.js`).
- **Dependencies:** `pdf-parse` and `mammoth` are lazy-loaded specifically inside the function block to mitigate cold starts, accompanied by `runWith({ memory: "1GB", timeoutSeconds: 300 })` allocations to prevent OOM errors.
- **Logic:** `gemini-2.5-flash` classifies documents into 4 categories (`AI_RULE`, `ROSTER`, `TEMPLATE`, `COMPLIANCE`) and 2 departments (`UPV`, `KPV`).
- **Safety Boundary:** The classification requires an 80% confidence threshold. If the AI confidence falls below 80%, a localized Czech confirmation modal is returned to the Admin, demanding manual override approval to ensure safety.
- **Component Injection:** Recognized `ROSTER` (Excel/CSV) files are dynamically passed to the `apps/web/components/VisualMappingImport.tsx` component via the `initialFile` prop for immediate data mapping.

### 4.2 GDPR-Compliant Telemetry Pipeline (`research_telemetry`)
A cognitive telemetry system operates asynchronously to capture student reflection drafting progress for research analysis.
- **Data Obfuscation:** The system utilizes `crypto-js` to apply SHA-256 hashing to the user ID before submission. No PII is attached.
- **Enforcement:** The destination `research_telemetry` Firestore collection is protected by a strict WORM (Write-Once-Read-Many) configuration, allowing only `create` operations and entirely preventing modifications or deletions.

---

## 5. Security, Compliance & Legal Protection

### 5.1 Strict WORM Architecture (Tripartite Contracts)
To establish cryptographic non-repudiation and legal validity, Tripartite Signatures are utilized for contracts.
- **Audit Logs:** Every digital signature generated by the `ContractSignature` component (`apps/web/components/ContractSignature.tsx`) creates an append-only document in the `audit_logs` collection, logging the User ID, Timestamp, and IP Address.
- **Storage Protection:** Generated PDF contracts are stored in Firebase Storage. `storage.rules` implements strict WORM compliance: `allow update, delete: if false;` under the `contracts/{userId}/{fileName}` path. Once a contract is written, it is legally immutable.

### 5.2 Automated PDF Skill Matrix Generation
The system dynamically generates a cryptographic "Skill Matrix" PDF upon completion of a practicum sequence.
- **Cloud Function Execution:** The `generateSkillMatrixPDF` function (`functions/pdf_logic.js`) employs `pdf-lib` to render the final vector document.
- **QR Hub Verification:** A cryptographic verification QR code (`qrcode` library) is securely embedded into the document linking to `https://praxihub.cz/verify?id=...`. The resulting URL is safely written to the `skillMatrixUrl` field on the placement document.
- **Scanner Verification:** The QR code natively links to the `QrScanner` view (`apps/web/components/QrScanner.tsx`) enabling immediate verification against the active `placements` or `archived_placements` records.

---

## 6. Advanced & Background Systems

### 6.1 Ping System (Assistant)
The backend features an automated escalation cascade implemented via `functions/ping_system.js`.
- **Scheduled Triggers:** The function is invoked via Cloud Scheduler.
- **Escalation Rules:** It queries the `placements` collection for records stuck in `PENDING_INSTITUTION` or `PENDING_ORG_APPROVAL`. Based on the days elapsed since the last state change (Day 7, Day 14, Day 21), it dispatches localized, friendly email reminders to the host institution's contact.
- **Audit Tracking:** Each ping event is logged to `audit_logs` to ensure idempotency and prevent duplicate email dispatches.

### 6.2 Commissions & Decree Module (Menovací dekrét)
Specifically designed for UPV 3rd-year students taking their final pedagogical exams.
- **Commission Assignment:** Administrators can dynamically assign evaluation commissions composed of Coordinators and External Assessors.
- **PDF Rendering:** Upon finalizing the commission setup, the system generates an official "Menovací dekrét" (Decree of Appointment) PDF, rendering the assigned officials and timestamps, completely automating the bureaucratic overhead of the state exam process.

### 6.3 Director Features
Administrators (Directors) have macro-level controls over the system mechanics.
- **Capacity Management:** Admins can configure the maximum number of concurrent students an institution or individual mentor can accommodate.
- **Catalog Configurations:** Dynamic lists (e.g., approved academic subjects) are managed through administrative views and injected directly into form dropdowns.
- **Blackout Days:** Admins can define specific holiday periods or "Blackout Days" where time-logging is strictly disabled, preventing students from inadvertently falsifying hours during non-operational periods.

### 6.4 Smart Compliance (5-Year GDPA Rollover)
The institution validation pipeline requires a physical or digital Framework Agreement (GDPR compliance).
- **Rule Enforcement:** A contract signed by an institution is valid for exactly 5 years.
- **Rollover Protocols:** The system tracks the `complianceValidUntil` field. When expiration approaches, the system automatically flags the institution on the Exception Dashboard and restricts new `PENDING_MATCH` assignments until a new agreement is uploaded and signed.

### 6.5 Prior Practice Recognition (Uznatelnost)
Students with prior relevant professional experience can bypass traditional hours logging via the `Prior Practice Recognition` workflow.
- **Workflow:** The student uploads proof of employment/practice. The AI router extracts keywords against the "Uznatelnost" rules defined in `system_configs/ai_rules_upv`.
- **Admin Approval:** A coordinator reviews the AI recommendation and can issue a system override, explicitly granting a credit block that bypasses the standard placement hours requirement.

### 6.6 Exception Dashboard (Red Flag Telemetry)
The Admin Dashboard (`apps/web/app/admin/dashboard/page.tsx`) features an Exception Panel. This view filters out the noise of nominal operations and specifically highlights "Red Flags" including:
- Placements stuck in a single state for > 30 days.
- AI classification overrides that require human attention.
- Institutions with expired or expiring compliance agreements.
- Missing tripartite signatures from required actors.

### 6.7 Live E-Portfolio & LinkedIn Integration
Completed practicums generate a dynamic E-Portfolio accessible via `/p/[studentId]`.
- **Public Profile:** Exposes the parsed Skill Matrix, digital badges, and verified reflections. Public visibility is explicitly toggled via the `isPublic` flag in the user's document.
- **Credentials Integration:** The generated `certificateUrl` and `skillMatrixUrl` can be inherently mapped to LinkedIn digital badges via direct credential sharing links, empowering students in their post-graduate job search.

### 6.8 Smart AI Matchmaking
The system aids students in finding optimal institutional placements.
- **Hybrid Algorithm:** To bypass Gemini token limits, the matchmaking logic (`functions/index.js` or `functions/users.js`) employs a hybrid model. First, Firestore natively pre-filters institutions based on the student's `major` (e.g., UPV/KPV) and region.
- **AI Ranking:** The filtered shortlist is then passed to Gemini 2.5 Pro to rank the options based on specific "Aprobácia" (subject approvals) and generate human-readable reasoning snippets explaining why the school is a good fit.

### 6.9 Institutional Operations & Admin Payroll
The platform completely automates the tedious payroll reconciliation process.
- **Calculations:** The `/admin/payroll` module (`apps/web/app/admin/payroll/page.tsx`) iterates over all finalized placements. It multiplies the approved `time_logs` against standardized compensation rates fetched live from the `system_configs/payroll_settings` document.
- **Aggregation:** Data is grouped explicitly by `institutionId`.
- **Native Exports:** The module supports native client-side CSV Blob generation, allowing coordinators to execute single-click exports directly formatted for university accounting systems.

---

## Appendix A: System Config Schema Definitions

<table border="1">
  <tr>
    <th>Document Path</th>
    <th>Purpose</th>
    <th>Key Fields / Structure</th>
  </tr>
  <tr>
    <td><code>system_configs/ai_settings</code></td>
    <td>Decoupled AI Model configurations.</td>
    <td><code>defaultModel</code> (string), <code>fastModel</code> (string)</td>
  </tr>
  <tr>
    <td><code>system_configs/payroll_settings</code></td>
    <td>Dynamic payroll calculation constants.</td>
    <td><code>mentorHourlyRate</code> (number), <code>currency</code> (string)</td>
  </tr>
  <tr>
    <td><code>system_configs/ai_krau_rules</code></td>
    <td>MŠMT competency framework rubrics.</td>
    <td><code>categories</code> (array of objects with rule sets)</td>
  </tr>
  <tr>
    <td><code>system_configs/chatbot_knowledge</code></td>
    <td>Contextual knowledge for the floating FAB Chatbot.</td>
    <td><code>systemPrompt</code> (string), <code>faqs</code> (array)</td>
  </tr>
</table>

## Appendix B: Document Path Definitions

<table border="1">
  <tr>
    <th>Component / Function</th>
    <th>File Path</th>
    <th>Role</th>
  </tr>
  <tr>
    <td>Command Palette</td>
    <td><code>apps/web/components/CommandPalette.tsx</code></td>
    <td>Admin/Institution global fast navigation.</td>
  </tr>
  <tr>
    <td>Impersonation View</td>
    <td><code>apps/web/components/ImpersonationBanner.tsx</code></td>
    <td>UI handler for the <code>impersonatorUid</code> claim state.</td>
  </tr>
  <tr>
    <td>Smart Roster Importer</td>
    <td><code>apps/web/components/VisualMappingImport.tsx</code></td>
    <td>Spreadsheet field-mapping and UI ingest.</td>
  </tr>
  <tr>
    <td>Firebase Initialization</td>
    <td><code>apps/web/lib/firebase.ts</code></td>
    <td>Frontend setup, SDK execution, static fallback handlers.</td>
  </tr>
  <tr>
    <td>WORM Security Rules</td>
    <td><code>storage.rules</code></td>
    <td>Blocks updates/deletes to <code>contracts/</code> bucket paths.</td>
  </tr>
  <tr>
    <td>RBAC Security Rules</td>
    <td><code>firestore.rules</code></td>
    <td>Evaluates <code>request.auth.token.role</code> custom claims.</td>
  </tr>
</table>

*End of Master Technical Specification.*