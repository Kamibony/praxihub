# PRE-PURGE STATE REPORT & HARD RESET BLUEPRINT

## Executive Summary
This document provides a comprehensive analysis of the pre-production database schema, a step-by-step strategy for safely wiping the database, and the exact requirements for re-seeding the baseline data. This ensures a flawless hard reset without leaving orphaned artifacts or ghost states.

## 1. Global Schema Mapping

Based on the architectural codebase audit, `firestore.rules`, and diagnostic reports, the following entities currently exist in the database:

### 1.1 Active Root Collections
*   **`users`**: Core user profiles and identity data. The SSOT for `role`, `email`, `displayName`, and `major`.
*   **`organizations`**: Verified institution/company data. The SSOT for legal entities, identified uniquely by `ico`.
*   **`placements`**: Active relationship instances between students and organizations. Driven by a state machine (`status`).
*   **`archived_placements`**: Historical, publicly readable snapshots of completed/abandoned placements.
*   **`public_portfolios`**: Publicly accessible student profiles/portfolios.
*   **`commissions`**: Evaluative commission data linking students and mentors/coordinators.
*   **`research_telemetry`**: Append-only collection for research and analytics.
*   **`audit_logs`**: Immutable, append-only logs for secure auditing (e.g., Tripartite Signatures).
*   **`system_configs`**: Global system configuration parameters (e.g., `ai_krau_rules`).
*   **`import_logs`**: Audit trails and summaries for Roster Import processes.

### 1.2 Active Sub-Collections
*   **`placements/{placementId}/time_logs`**: Individual logs of hours and reflections associated with a specific placement.
*   **`placements/{placementId}/rubrics`**: Evaluative rubrics and AI data specific to a placement.

### 1.3 Deduplication Registries (New Architectural Features)
To overcome Firestore's lack of native unique constraints, the system utilizes registry collections:
*   **`used_emails`**: Enforces globally unique email addresses.
*   **`used_student_ids`**: Enforces unique university student identifiers.
*   **`used_icos`**: Enforces unique business IDs for organizations.

### 1.4 Active Firestore Indexes
*   **Collection Group `placements`**:
    *   Fields: `studentId` (ASC), `createdAt` (DESC)
    *   Fields: `status` (ASC), `studentId` (ASC), `createdAt` (DESC)
*   **Collection Group `time_logs`**:
    *   Field Overrides on `status`: ASC, DESC, CONTAINS, ASC (Collection Group)

### 1.5 Firebase Storage Paths
*   **`contracts/`**: User-uploaded and generated placement contracts.
*   **`certificates/`**: Generated completion certificates.
*   **`global_documents/{category}/{dept}/{fileName}`**: Strictly enforced path for Admin document assets (templates, AI Knowledge Base rules, compliance files). *Legacy root folders like `templates/` are deprecated.*

---

## 2. Hard Reset Blueprint

To ensure complete referential integrity and avoid orphaned "ghost" sub-collections, the wipe script must execute a strict bottom-up cascading deletion strategy.

### Step 1: Storage Artifact Purge
1.  Recursively delete all objects under the `contracts/` prefix.
2.  Recursively delete all objects under the `certificates/` prefix.
*Note: Do NOT delete `global_documents/` unless the intention is to completely wipe the Admin Document Center.*

### Step 2: Sub-Collection Cascading Purge
Because Firestore root collection deletion does not automatically delete sub-collections, these must be explicitly queried and wiped first:
1.  Query all documents in the `placements` collection.
2.  For each `placementId`, fetch and batch delete all documents in `placements/{placementId}/time_logs`.
3.  For each `placementId`, fetch and batch delete all documents in `placements/{placementId}/rubrics`.

### Step 3: Core Entity Purge
1.  Batch delete all documents in the `placements` collection.
2.  Batch delete all documents in the `users` collection.
3.  Batch delete all documents in the `organizations` collection.

### Step 4: Ancillary Collection Purge
1.  Batch delete all documents in `archived_placements`.
2.  Batch delete all documents in `public_portfolios`.
3.  Batch delete all documents in `commissions`.
4.  Batch delete all documents in `research_telemetry`.
5.  Batch delete all documents in `audit_logs`.
6.  Batch delete all documents in `import_logs`.

### Step 5: Registry Purge
1.  Batch delete all documents in `used_emails`.
2.  Batch delete all documents in `used_student_ids`.
3.  Batch delete all documents in `used_icos`.

### Step 6: Config Purge
1.  Batch delete all documents in `system_configs`.

### Step 7: Firebase Auth Purge
1.  Iterate through all Firebase Authentication user records.
2.  Delete all users **EXCEPT** the predefined Root Administrator whitelist (e.g., `admin@praxihub.cz`, `anet@praxihub.cz`, `praxihub@gmail.com`).

---

## 3. Re-Seed Requirements

Immediately after the purge, the database will be in a blank, inoperable state. To restore functionality and prevent infinite routing loops on the frontend, the following baseline data must be programmatically injected via a seeder script.

### 3.1 Root Administrator Restoration
The Auth users preserved in Step 7 must be reconstructed in the Firestore `users` collection.
*   Create documents in `users` matching the preserved `uid`s.
*   Must include strict SSOT fields: `role: "admin"`, `email`, and complete profile fields (`displayName`, `major`: `null`) to satisfy the dashboard completeness checks and avoid redirect loops.

### 3.2 Registry Synchronization
*   To maintain integrity, immediately insert the emails of the seeded Root Administrators into the `used_emails` registry.

### 3.3 Mandatory System Configurations
*   **`system_configs/ai_krau_rules`**: This document is aggressively queried by the `StudentDashboard` on load. It must be seeded with the base rubric structure and AI evaluation prompts.

### 3.4 Admin Document Assets Validation
*   Ensure that core templates and AI Knowledge base assets exist in the correct `/global_documents/{category}/{dept}/{fileName}` structure in Firebase Storage, as the frontend strictly relies on this new routing and strict MIME-type validation.

### 3.5 UAT Base Data (Optional but Recommended)
If the environment is used for UAT, seed base institutional rules:
*   A test organization in `organizations` and its corresponding `ico` in `used_icos`.
*   A test institution user linked to the test organization.
