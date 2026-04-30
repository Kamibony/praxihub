# Comprehensive Technical State Report - NEW IVP PRAXE (praxihub)

## Architecture & Tech Stack Overview

### Frontend
- **Web App**: Next.js (App Router) configured strictly for Static Export (`output: 'export'`). This means server-side API routes and Server Actions are disabled, relying entirely on client-side fetching and Firebase Callable Functions.
- **Mobile App**: React Native with Expo (`apps/mobile`), utilizing Firebase Client SDKs for basic operations and Image Picker for potential uploads.
- **Styling**: Tailwind CSS with custom utility classes (`globals.css`) emphasizing Glassmorphism and Slate/Indigo color palettes. Icons are provided by `lucide-react` but UI design language explicitly prefers Emojis.

### Backend (Serverless)
- **Functions**: Firebase Cloud Functions (Node.js 20 environment) handling all backend business logic, third-party API integrations (ARES), and AI processing.
- **Authentication**: Firebase Passwordless Auth (Magic Links).
- **Database**: Firestore. Follows NoSQL denormalization patterns with a strict role architecture (STUDENT, INSTITUTION, COORDINATOR).
- **Storage**: Firebase Storage manages templates, compliance files (`global_documents`), and snapshots.

## Core Modules & Current Implementation

- **Role Management & Impersonation**: Admin slide-over CRM allows for direct database updates and "Login-As" impersonation using custom claims.
- **State Machine**: Placements transition through a strict Definitive State Transition Matrix (DRAFT -> PENDING_MATCH -> ... -> ACTIVE -> CLOSED -> FINAL_EXAM) strictly enforced by backend logic.
- **Smart Matchmaking (Phase 3)**: AI-driven matching of students to institutions, with results cached locally on the student document.
- **QR Hub & Mentorship (Phase 3/6)**: Time logs and mentor approvals via QR code scanning (`html5-qrcode` & `react-qr-code`).
- **Tripartite Digital Signatures (Phase 7 - Current)**: Implementing a 3-way legally binding signature workflow capturing server timestamp, user ID, and IP address into an immutable `audit_logs` collection.
- **Voice UI**: Native HTML5 Web Speech API integration in the Student Dashboard for dictating reflections.

## Database Schema (High-Level)

- `users`: Core identity and role definitions (UID linked to University Student ID).
- `organizations`: Company data (often populated via mock/real ARES API fetching).
- `placements`: Core domain model linking a student to an institution.
  - Subcollection `time_logs`: Denormalized structure tracking mentor approvals (subject to `collectionGroup` queries for payroll).
- `archived_placements` & `commissions`: Immutable snapshots for public verification and final exams.
- `public_portfolios`: Projection pattern for public-facing read-only e-portfolios.
- `system_configs`: Backend configuration and AI evaluation rules parsed from admin-uploaded documents.

## AI & LLM Integration

The application heavily utilizes Google's Gemini API:
- **Models**: `gemini-2.5-pro` is used for broad text extraction and chat tasks (e.g., parsing methodology documents in `parseDocumentForAI` and general matchmaking). `gemini-2.5-flash` is leveraged for high-speed, deterministic tasks requiring structured JSON outputs, such as grammar correction (`correctReflectionGrammar`) and MŠMT KRAU evaluation (`evaluateReflection`).
- **RAG Architecture**: Employs a "human-in-the-loop" pattern. Documents (PDF/DOCX) are parsed via Cloud Functions, AI extracts rules (metodika, uznatelnost, kompetencni_ramec), and admins manually review these snippets in the UI before committing them to `system_configs`.

## CI/CD & Infrastructure

- **Workflows**: GitHub Actions orchestrate the pipeline.
- **Deployment**: The `deploy.yml` workflow installs dependencies, builds the Next.js static export (`out` directory moved to `public`), and deploys to Firebase Hosting. Functions are deployed using `firebase deploy --only functions --force`.
- **Testing**: A `run-tests.yml` exists, but Playwright E2E tests are currently systematically disabled in `package.json` (`echo 'Playwright tests temporarily disabled...'`).

## Technical Debt & Immediate Issues

- **Testing Deficit**: E2E tests are disabled. The local testing infrastructure needs to be re-activated, especially handling Firebase Emulator boot flakiness and port orphans.
- **Next.js Static Export Constraints**: Reliance on query parameters (`?id=slug`) for dynamic routing instead of native App Router dynamic segments due to `output: 'export'`.
- **Hardcoded Prompts & Strings**: Strict requirement for Czech localization without an i18n library leads to tightly coupled UI logic and backend AI prompts.
- **Package Management**: The CI/CD explicitly removes `package-lock.json` before deploying functions to force `npm install` over `npm ci`, indicating potential dependency resolution issues.
- **ARES Mocking**: The `fetchAresAndLink` function currently mocks the ARES API response; it needs a robust implementation for production.

## Recommendations for Next Steps

1. **Re-activate Quality Assurance Pipeline**: Fix the underlying dependency or emulator issues that caused E2E tests to be disabled. Re-enable Playwright tests to protect against regressions during Phase 7 development.
2. **Refactor ARES Integration**: Replace the mocked `fetchAresAndLink` functionality with actual HTTP requests to the Czech ARES registry for accurate organization data validation.
3. **Audit Security Rules**: Ensure that the newly developed Phase 7 `audit_logs` collections are strictly append-only for authenticated users and immutable once written.
4. **Environment Configuration Audit**: Review hardcoded AI prompts and parameters. Consider migrating static model versions (e.g., "gemini-2.5-pro") into `system_configs` or environment variables to allow seamless upgrades without code deployments.
