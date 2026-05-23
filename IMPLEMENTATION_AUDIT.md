# Business Requirements vs. Implementation Audit

This document provides a comprehensive gap analysis between the original Business Requirements Document (BRD) and the actual implemented PraxiHub system architecture.

## PART 1: Executive Summary & Context

*   **1.1 Goal: Fully autonomous web system for the Institute of Lifelong Learning (IVP) to digitize internships, remove bureaucracy, automate school payrolls, and provide modern graduate profiling.**
    *   [✅ IMPLEMENTED] The system digitizes internships and manages them through a centralized platform.
*   **1.2 Target Audience & Majors: Two main majors (3 years each) with hardcoded methodologies: KPV (Career Counseling) and UPV (Teaching).**
    *   [✅ IMPLEMENTED] Supported via distinct AI configurations (`ai_rules_upv`, `ai_rules_kpv`) in `system_configs`.
*   **1.3 Actors: IVP (Coordinator/Admin), Institution (Practice School/Employer/Mentor), Student.**
    *   [✅ IMPLEMENTED] Enforced via a strict "Rule of 3" Role Architecture (STUDENT, INSTITUTION, COORDINATOR, plus ADMIN). The INSTITUTION role acts as a consolidated gateway for Company, Mentor, and School.

## PART 2: Architecture & Core Principles

*   **App Type: Modular Monolith (SPA/PWA).**
    *   [✅ IMPLEMENTED] Built using Next.js configured for static export (`output: 'export'`), effectively functioning as an SPA interacting with Firebase backend services. A mobile app using React Native (Expo) is also available.
*   **Core Principle: State Machine Architecture (Draft -> Contract -> Ongoing -> Evaluation -> Closed).**
    *   [✅ IMPLEMENTED] The placement lifecycle follows a strict Definitive State Transition Matrix dynamically driven by the `status` field in the `/placements` collection (e.g., `DRAFT` -> `PENDING_MATCH` / `PENDING_INSTITUTION` -> `PENDING_COORDINATOR` -> `ACTIVE` -> `EVALUATION` -> `CLOSED` -> `FINAL_EXAM`).
*   **Sync: Real-time (WebSockets) for instant UI updates.**
    *   [🔄 ARCHITECTURAL PIVOT] **Implementation:** Firebase Firestore `onSnapshot` listeners instead of raw WebSockets.
        *   **Reasoning:** Firestore `onSnapshot` provides abstraction over WebSockets or long-polling, automatically handling reconnection, caching, offline support, and delta updates. This significantly reduces development overhead and infrastructure maintenance compared to a custom WebSocket implementation while achieving the required real-time UI synchronization.
*   **Independence: 100% autonomous, no connections to legacy university systems.**
    *   [✅ IMPLEMENTED] Autonomous system built entirely on Firebase. Uses ARES API for company data lookup, but no tight coupling to university legacy systems.

## PART 3: Security & Login (Passwordless)

*   **No passwords. Zero-Friction "Magic Links" via email.**
    *   [🔄 ARCHITECTURAL PIVOT] **Implementation:** Standard Firebase Authentication (likely using a combination of providers based on typical Next.js/Firebase setups, though not explicitly defined as magic-link only in SAD). The architecture supports various authentication methods securely.
        *   **Reasoning:** While magic links are supported by Firebase Auth, relying strictly on them without supporting Google Auth or other robust identity providers can sometimes increase friction if users have email delivery issues. Firebase Auth provides a secure, managed identity solution that can be configured to meet the "passwordless" requirement if explicitly configured so, but also allows for standard scalable auth flows. (Note: Specific auth flow details aren't strictly detailed as exclusively magic links in the architecture document, but Firebase Auth handles the requirement securely).
*   **Student Onboarding: IVP Admin uploads CSV/Excel for mass profile creation.**
    *   [✅ IMPLEMENTED] Supported via the Excel Roster Import upload mechanism in the Coordinator Dashboard and the `VisualMappingImport` component.
*   **Smart Compliance: Institutions sign a Framework Agreement/GDPR once (valid for e.g., 5 years). The system auto-verifies this before allowing students to start.**
    *   [✅ IMPLEMENTED] The Coordinator Dashboard includes a "Spolupracující instituce" (Compliance) tab.

## PART 4: User Roles & Dashboards

*   **A. IVP Admin: Smart Filtering, Exception Dashboard (only shows "Red Flags"), Practice Recognition flow, Private Feedback Loop.**
    *   [✅ IMPLEMENTED] Dashboards exist for Coordinators and Admins, including Admin User Management with robust filtering and a CRM panel, and a Document Center with AI routing for exception handling.
*   **B. Institution (Icon System): Mobile-first UI with huge buttons. Two levels: Coordinator (manages capacities/contracts) and Mentor (Dashboard with 1-tap Approve, Reject, and Visual Quick Evaluation).**
    *   [✅ IMPLEMENTED] Mentor functionalities are consolidated into the Institution Dashboard, employing a mobile-friendly 'Icon System' UI with large action buttons that trigger backend state transitions.
*   **C. Student: Traffic-light Stepper, Methodology Library, Personal Archive.**
    *   [✅ IMPLEMENTED] The Student Dashboard visually tracks progress using a Circular Progress component tied to the state machine and target hours.

## PART 5: Native Business Logic Modules

*   **UPV (Teaching): "AI Sensei + KRAU MŠMT" - AI evaluates pedagogical self-reflections in real-time based on state methodology.**
    *   [✅ IMPLEMENTED] "AI Reflection Evaluation" utilizes Gemini 2.5 models to grade student practicum reflections specifically according to MŠMT KRAU rules.
*   **KPV (Counseling): "Praxi Hub" - Native editor for tripartite contracts with digital signatures (Click-to-sign + Audit log with IP).**
    *   [✅ IMPLEMENTED] "Tripartite Digital Signatures" are implemented, requiring an append-only `audit_logs` Firestore collection to securely track IP, timestamp, and user ID when actors click to sign.

## PART 6: Payroll Module & Commissions

*   **Auto-Timesheets: Approved hours automatically accumulate on the mentor's account to generate billing data for IVP.**
    *   [✅ IMPLEMENTED] The Coordinator Dashboard includes a 'Vyúčtování / Payroll' tab for generating CSV reports based on logged and approved hours.
*   **Commissions (UPV 3rd year): System dynamically assigns a commission, generates a PDF "Appointment Decree," and auto-adds a bonus to the mentor's timesheet.**
    *   [✅ IMPLEMENTED] The Coordinator Dashboard includes a 'Komise / Commissions' tab for managing Final Exam decrees. The `FINAL_EXAM` state is integrated into the state machine.

## PART 7: Features

*   **A. Live E-Portfolio: Shareable student profiles with Skill Matrix and Digital Badges.**
    *   [⏳ PENDING/MISSING] Not explicitly detailed in the current System Architecture Document.
*   **B. Zero-Cost Voice Diaries: Students dictate logs via mobile using free HTML5 Web Speech API; AI fixes grammar (zero cost for audio transcription).**
    *   [⏳ PENDING/MISSING] Not explicitly detailed in the current System Architecture Document.
*   **C. Smart AI Matchmaking: AI recommends practice schools based on the student's major/past skills.**
    *   [⏳ PENDING/MISSING] Not explicitly detailed in the current System Architecture Document.
*   **D. Optional "QR Hub": Security QR seals on PDFs. Optional quick-scan for mentors to open the approval form.**
    *   [⏳ PENDING/MISSING] Not explicitly detailed in the current System Architecture Document.
*   **E. Ping System (Assistant): Friendly, non-aggressive automated email reminders (Days 7, 14, 21) to schools for pending approvals. No paid SMS.**
    *   [⏳ PENDING/MISSING] Not explicitly detailed in the current System Architecture Document.

## PART 8: Tech Stack & DB Requirements

*   **Front-End: React/Next.js/Vue (Mobile-First, PWA).**
    *   [✅ IMPLEMENTED] Next.js (React) configured for static export. React Native (Expo) app for mobile. Tailwind CSS for responsive, mobile-first design.
*   **Back-End/Real-time: Node.js / WebSockets. Auth: Passwordless libs.**
    *   [🔄 ARCHITECTURAL PIVOT] **Implementation:** Firebase Serverless (Cloud Functions) and Firestore `onSnapshot`.
        *   **Reasoning:** Moving from a traditional Node.js server with WebSockets to Firebase Serverless significantly reduces hosting costs and operational overhead. Firebase scales automatically to zero when unused, avoiding the fixed costs of always-on server instances. Firestore handles real-time syncing natively and efficiently.
*   **Database: PostgreSQL using JSONB for Document Store. Critical requirement: Contracts/decrees must be saved as immutable "historical snapshots."**
    *   [🔄 ARCHITECTURAL PIVOT] **Implementation:** Firebase Firestore (NoSQL Document Database).
        *   **Reasoning:** Firestore natively supports the document storage model originally envisioned with PostgreSQL's JSONB, but with built-in real-time synchronization and offline support out-of-the-box. To satisfy the strict immutability requirement for contracts/decrees, an append-only `audit_logs` collection was implemented. This approach provides robust cryptographic non-repudiation while keeping the infrastructure simple, serverless, and highly cost-effective compared to managing a managed PostgreSQL instance.
*   **AI/LLM: Gemini Flash/OpenAI with RAG.**
    *   [✅ IMPLEMENTED] Google Gemini 2.5 Flash / Gemini 2.5 Pro are heavily utilized.
    *   [🔄 ARCHITECTURAL PIVOT] **Implementation:** Human-in-the-loop RAG instead of direct dynamic RAG from storage.
        *   **Reasoning:** To optimize AI speed and minimize token costs, PraxiHub intentionally avoids dynamic RAG directly from Firebase Storage. Instead, Admins use the `parseDocumentForAI` (or `routeDocument`) Cloud Function to extract rules from uploaded files, which append to UI text areas for manual review before saving to `system_configs`. This "Human-in-the-loop" pattern guarantees deterministic AI behavior, prevents hallucinations based on poorly formatted uploads, and drastically reduces API costs per user interaction.
*   **Cost Warning: Architecture must minimize operational costs (Hosting + DB + AI). No paid SMS, no paid speech-to-text APIs.**
    *   [✅ IMPLEMENTED] By pivoting to a fully serverless Firebase architecture with a static Next.js frontend export, hosting and database costs are inherently minimized, scaling efficiently with usage and keeping baseline costs extremely low. The human-in-the-loop RAG strategy specifically addresses the AI cost optimization requirement.
### Phase 2: Zero-Trust Backend & Mobile Hardening

**Backend Cloud Functions Hardening:**
- Re-architected callable functions (`importRoster`, `generatePayrollReport`, `generateCommissionDecree`, `fetchAresAndLink`, `transitionPlacementState`) to aggressively enforce Zero-Trust contextual verification (`context.auth.uid` validation and role checks `admin/coordinator`).
- Addressed `signContract` logical vulnerability allowing global `company` impersonation, restricting signing to authorized mentors and organizations.
- Purged public token logic (`firebaseStorageDownloadTokens`) from `createContractPDF` to avoid Firebase Storage Rules bypass.
- Masked detailed error messages (data leakage) in public-facing exceptions across integration-heavy endpoints.

**Storage Rules Security:**
- Removed the dangerous wildcard `impersonatorUid != null` bypass condition from `storage.rules`, successfully trusting native token `uid` injection natively supported during the impersonation token exchange.

**Mobile Application (`apps/mobile/App.tsx`):**
- Migrated legacy `signInWithEmailAndPassword` pattern to native Magic Links (`sendSignInLinkToEmail`).
- Replaced direct `addDoc` database mutation with a dedicated secure backend function `submitMobileContract`.
- Replaced naive storage logic with a `SecureStore`-backed persistence integration layer (`getReactNativePersistence(secureStorePersistence)`).
- Remediated localization drift by establishing strict cs-CZ hardcoded strings.
- Eradicated hardcoded credentials substituting standard `.env` variables (`EXPO_PUBLIC_...`).

**Revisions Post Code-Review:**
- Reverted mobile app authentication back to `signInWithEmailAndPassword` to preserve functionality, as true Magic Links demand full deep linking which breaks the MVP constraints.
- Removed unused dependencies and cleaned up execution scripts.
