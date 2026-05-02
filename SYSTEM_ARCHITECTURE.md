# PraxiHub: System Architecture Document (SAD)

## 1. High-Level Overview
PraxiHub is a centralized digital platform designed to streamline and manage student internships and practical placements. The core problem it solves is the administrative burden and fragmentation associated with managing student placements between academic institutions, host organizations (institutions/companies), and the students themselves. PraxiHub automates workflows, provides AI-driven evaluations and document routing, and maintains a secure, verifiable record of placements and contractual agreements specifically tailored for the Czech educational system (MŠMT KRAU rules).

## 2. Tech Stack
- **Frontend**: Next.js (React) configured for static export
- **Backend/Platform**: Firebase (Authentication, Firestore, Storage, Cloud Functions)
- **Artificial Intelligence**: Google Gemini 2.5 Flash / Gemini 2.5 Pro (via Google Generative AI SDK)
- **Styling**: Tailwind CSS (Dark slate themes, Glassmorphism, Indigo accents)
- **Testing**: Playwright (End-to-End Testing)
- **Deployment & CI/CD**: GitHub Actions
- **Mobile**: React Native (Expo) - `apps/mobile`

## 3. Core Architecture & Data Flow
PraxiHub utilizes a Serverless architecture powered by Firebase.
- The **Next.js frontend** is configured for static export (`output: 'export'`) and hosted as a static site. It communicates directly with Firebase services via the client-side Firebase SDKs (Firestore, Auth, Storage).
- **Backend logic** is encapsulated in Firebase Callable Cloud Functions (`functions/`). These functions act as secure endpoints for complex operations, AI integrations, data migrations, and integrations with external APIs (like the public ARES API for Czech company data).
- **Data Flow**:
  - Real-time UI updates are powered by Firestore `onSnapshot` listeners. To prevent memory leaks, real-time listeners update base raw data state synchronously, while asynchronous hydration (fetching related documents) happens in a separate `useEffect`.
  - File uploads go directly to Firebase Storage or are processed via Cloud Functions for AI analysis.
  - Complex state transitions or operations requiring elevated privileges (e.g., administrative impersonation, AI document parsing) are triggered from the client via Callable Functions, executing with Admin SDK privileges on the backend.

## 4. Database Schema (Firestore)
The core database is NoSQL, utilizing Firebase Firestore.

- **`users`**: Stores user profiles and authentication metadata. The `uid` matches the Firebase Auth UID (and corresponds to the student's external university 'Student ID').
  - *Fields*: `uid`, `email`, `role` (STUDENT, INSTITUTION, COORDINATOR, ADMIN), `name`, `major`, etc.
- **`placements`**: The central entity representing a student's internship.
  - *Fields*: `studentId` (foreign key to `users`), `institutionId` (foreign key to `users`/institutions), `organizationId` (foreign key to `organizations`), `status`, `targetHours`, `migratedHours`, `description`, etc.
- **`organizations`**: Represents external companies/schools where placements occur (often synced via ARES API).
  - *Fields*: `ico`, `obchodniJmeno`, `sidlo`.
- **`system_configs`**: Stores dynamic system configuration, particularly for AI prompts.
  - *Documents*: `ai_rules_upv`, `ai_rules_kpv`, `chatbot_knowledge`, `ai_settings`. This decouples AI behavior from the static codebase.
- **`audit_logs`**: An append-only collection used for secure auditing, especially for Tripartite Signatures.
  - *Fields*: `userId`, `action`, `timestamp`, `ip`, `documentId`.

## 5. The Placement State Machine
Placements follow a strict state transition matrix dynamically driven by the `status` field in the `placements` collection to ensure data integrity and track progress.

Core transitions:
1. **`DRAFT`**: Initial creation by student or admin.
2. **`PENDING_MATCH`** (UPV) or **`PENDING_INSTITUTION`** (KPV): Awaiting assignment or acceptance by the host institution.
3. **`PENDING_COORDINATOR`**: Awaiting final approval from the school coordinator.
4. **`ACTIVE`**: Placement is ongoing. Hours can be logged, and circular progress tracking is visible to the student.
5. **`EVALUATION`**: Placement is finished, awaiting final reflections and grading.
6. **`CLOSED`**: Successfully completed and approved.
7. **`FINAL_EXAM`**: Specifically for placements tied to final exams/decrees.

*AI Document Parsing Workflow Branch:*
- `PENDING_ORG_APPROVAL` -> `ORG_APPROVED` -> `ANALYZING` (AI processing) -> `NEEDS_REVIEW` (Manual admin check) -> `APPROVED` (merges back to `ACTIVE` or `PENDING_COORDINATOR`).

## 6. Agentic AI & Cloud Functions
PraxiHub heavily utilizes AI to automate administrative tasks:

- **Intelligent Document Router**:
  - Located in the Admin Document Center and powered by the `routeDocument` Cloud Function using `gemini-2.5-flash`.
  - Analyzes uploaded documents (PDFs, DOCX) and classifies them into 4 categories and 2 departments (UPV/KPV).
  - Implements an 80% AI confidence threshold; if classification confidence falls below 80%, it triggers a localized Czech confirmation modal for a manual Admin override to ensure routing safety.
- **RAG Chatbot**:
  - Fetches dynamic knowledge dynamically from the `system_configs/chatbot_knowledge` Firestore document.
  - Provides contextual assistance to students and institutions without hardcoded knowledge bases.
- **AI Reflection Evaluation**:
  - Grades student reflections and logs based on strictly defined MŠMT KRAU rules.
  - Evaluation rules (`metodika`, `uznatelnost`, `kompetencni_ramec`) are stored as stringified JSON in `system_configs` (`ai_rules_upv` / `ai_rules_kpv`) and combined into the system prompt via cloud functions.
- **Contract Analysis**:
  - Extracts key data from uploaded PDF contracts using `pdf-parse`/`mammoth` and `gemini-2.5-pro` (`parseDocumentForAI`).
  - To optimize AI speed and cost, PraxiHub intentionally avoids direct dynamic RAG from Firebase Storage. Instead, it uses a human-in-the-loop pattern: Admins extract rules from uploaded files, which append to UI text areas for manual review before saving to `system_configs`.

## 7. Security, Roles & Signatures
- **Roles (Rule of 3)**: The system enforces a strict RBAC architecture with exactly three consolidated roles: `STUDENT`, `INSTITUTION` (consolidating Company/Firma, Mentor, and School into a single gateway), and `COORDINATOR` (IVP Admin).
- **Tripartite Digital Signatures**:
  - Phase 7 Architecture explicitly requires Tripartite Signatures for contracts from the Student, Institution, and Coordinator.
  - Signatures are securely recorded in the append-only `audit_logs` collection.
  - The system tracks IP addresses, timestamps, and the exact user ID at the time of clicking "Sign" to ensure cryptographic non-repudiation.
- **Impersonation (Login-As)**:
  - Admins can impersonate users for support purposes via custom Firebase tokens generated by the `getImpersonationToken` Cloud Function.
  - An `impersonatorUid` custom claim is injected into the generated token, which the frontend detects via `user.getIdTokenResult()` to display a persistent return banner and safely restore the original session.

## 8. CI/CD Pipeline
- **Deployment**: Managed via GitHub Actions (`deploy.yml`).
  - Deployments to Firebase Functions strictly execute `rm package-lock.json` followed by a clean `npm install` over `npm ci` on Google Cloud to prevent strict lockfile failures.
- **Testing**: End-to-End testing is actively integrated into the CI/CD pipeline using Playwright (`.github/workflows/run-tests.yml`).
  - Test environments correctly inject Firebase Emulator variables (e.g., `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`) to route traffic to local emulators instead of production logic.
  - A pre-test seed script (`tests/e2e/seed.ts`) populates the emulators. Date fields are strictly instantiated using `admin.firestore.Timestamp.fromDate(new Date())` to prevent frontend `.toDate()` parsing failures.
  - Flaky emulator boot sequences and orphaned ports (3000, 4000, 5001, 8080) are explicitly killed in `tests/global-setup.ts` before tests execute.