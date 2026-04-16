# PraxiHub - System Architecture & Context

## Tech Stack
*   **Frontend:** Next.js App Router configured for Static Export (`output: 'export'`). This means NO server-side API routes and NO Server Actions.
*   **Backend / Serverless:** Firebase Cloud Functions (Callable & HTTPS) handle all backend logic and AI module evaluations.
*   **Database:** Firestore (with strict security rules and transaction-based safeguards).
*   **Authentication:** Firebase Passwordless Auth (Magic Links). Passwords are NOT used.
*   **Storage:** Firebase Storage for PDFs and global documents.
*   **Styling:** Tailwind CSS, `lucide-react` for icons.

## Architectural Principles
*   **Localization:** Strict Czech localization for all user-facing UI and AI system prompts. We do not use i18n libraries; strings are hardcoded in professional Czech for the CZ market.
*   **State Machine:** Placement progression is managed by a strict State Machine enforced by Cloud Functions, not client-side writes.
*   **Transactions:** Operations that read and then write data (like the Excel roster import or status transitions) use Firestore transactions to prevent race conditions and protect existing data.
*   **UI Component Structure:** Monolithic frontend UI files should be broken down into smaller, strictly typed discrete React components to maintain clean syntax and prevent deep nesting.
*   **AI Integration:** We use `gemini-2.5-pro` for general AI tasks (matchmaking, chatbots) and `gemini-2.5-flash` with structured outputs (JSON schema) for high-speed deterministic evaluations (MŠMT KRAU methodology).

## Macro Master Plan (Current State)
*   **Phases 1-5 (DONE):** Auth, Excel Import, AI Evaluation (MŠMT), Immutable Snapshots, UX/UI.
*   **Phase 6 (DONE):** Mentor Icon System & Time Logs. Security rules for `time_logs` subcollection have been fixed.
*   **Phase 7 (CURRENT):** Tripartite Digital Signatures (KPV Module).
    *   Goal: Implement a 3-way legally binding signature workflow.
    *   Requirement: Secure Cloud Function (`signContract`) that captures server timestamp, user ID, and IP address.
    *   Requirement: Unalterable audit trail written to the root `audit_logs` collection.
    *   Requirement: UI component for frictionless "Click-to-Sign" experience for Student, Coordinator, and Company roles.
