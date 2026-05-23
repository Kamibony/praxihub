# STRATEGIC PLAN: Data Normalization & Systemic Remediation

## 1. Incremental vs. "Big Bang" Migration

**Recommendation: The "Big Bang" / Hard Reset Approach**

Given the explicit condition that we are willing to **discard legacy UAT data** for the sake of long-term integrity, a **"Big Bang"** migration is the strategically superior choice.

### Justification:
*   **System Stability:** Incremental migrations on highly denormalized and fragmented NoSQL schemas often result in "split-brain" bugs, where some UI components read old data shapes while others expect the new shape. This leads to brittle transitional code (e.g., `user.major || placement.major || user.studentMajor`). A clean break eliminates this entire class of bugs immediately.
*   **Maintenance Effort:** Writing dual-path code to support both old and new data structures temporarily inflates technical debt and requires extensive testing across both paradigms.
*   **Data Integrity:** Since the current UAT data is admittedly compromised, attempting to map it perfectly to a pristine new schema is a high-effort, low-value endeavor. Wiping the slate clean guarantees that from Day 1 of the new schema, all data respects the new Single Source of Truth (SSOT) rules.

*Note on Execution:* The "Big Bang" refers to the database state. We will still deploy the code incrementally in milestones to ensure each module is stable before moving to the next.

---

## 2. The Integrity Auditor Implementation

Before executing the full reset and schema lock, we will build the **Automated Integrity Auditor** as a standalone diagnostic tool. This script will ensure the new rules are respected over time.

### Structure & Purpose:
*   **Implementation:** A Node.js CLI script using the Firebase Admin SDK (`scripts/integrity_auditor.js`).
*   **Future Use:** It will serve as a "Health Check" utility run locally or integrated into a CI/CD pipeline (e.g., a weekly cron job via GitHub Actions) to catch schema regressions.
*   **Core Checks:**
    1.  **Identity SSOT Verification:** Ensures `placements` do *not* contain `studentName`, `studentEmail`, `major`, or `studentMajor`. If these fields exist, it flags a violation.
    2.  **Referential Integrity:** Validates that all foreign keys (e.g., `studentId`, `institutionId` in `placements`) resolve to valid documents in the `users` collection.
    3.  **Role Purity:** Verifies that all users have exactly one valid role (`STUDENT`, `INSTITUTION`, `COORDINATOR`, `ADMIN`) and that fields conform to that role (e.g., only `STUDENT`s have a `major`).

---

## 3. Execution Roadmap

The implementation will follow a strict milestone-driven sequence. We will pause and verify system stability at the end of each milestone.

### Milestone 1: The Foundation & Verification
*   **Action 1.1: Database Wipe.** Execute a hard reset of the Firestore emulator/production database to clear all legacy fragmented data.
*   **Action 1.2: Build Integrity Auditor.** Develop `scripts/integrity_auditor.js` with the strict SSOT rules.
*   **Action 1.3: AuthContext Consolidation.** Refactor `AuthContext.tsx` to serve as the absolute source of truth for the active user's identity, ensuring it only exposes normalized fields (e.g., standardizing on `displayName` and `major`).
*   **Verification:** Run the Integrity Auditor against a seeded database. It must report 100% compliance.

### Milestone 2: Backend Enforcement & Triggers
*   **Action 2.1: Cloud Function Scrubbing.** Audit and update all Cloud Functions (`functions/index.js`, etc.) that currently copy or rely on denormalized data (e.g., removing logic that writes `studentName` to a placement on creation).
*   **Action 2.2: Managed Denormalization (If Required).** If specific high-performance queries demand it, implement the precise Cloud Function triggers (as outlined in the Audit) to keep read-optimized fields in sync strictly bound to the `users` collection SSOT.
*   **Verification:** Deploy functions to the emulator. Create a user, create a placement, and update the user. The Integrity Auditor must confirm the state remains pure.

### Milestone 3: Frontend Binding (The "Great Refactoring")
*   **Action 3.1: Component Hydration.** Refactor core UI components (Admin Dashboard, Institution Dashboard, Student Dashboard) to perform client-side hydration (joins) instead of relying on denormalized placement data.
*   **Action 3.2: Form & Input Standardization.** Ensure onboarding and edit forms only write to the correct SSOT locations (e.g., updating a major only writes to `users/{uid}`).
*   **Verification:** Full manual E2E run-through of the core workflows (Onboarding -> Placement Request -> Approval -> Evaluation). Ensure UI accurately reflects data without ghosting or fallback logic.

### Milestone 4: Final Lockdown
*   **Action 4.1: Firestore Security Rules.** Update `firestore.rules` to actively reject writes that attempt to inject denormalized fields (e.g., blocking a write to `placements` if it includes a `studentName` key).
*   **Action 4.2: UAT Deployment.** Deploy the finalized architecture to the staging environment for client review.
