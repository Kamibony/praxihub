# COMPREHENSIVE ARCHITECTURAL AUDIT: Global Data Visibility & Referential Integrity

## 1. Executive Summary
This document provides a comprehensive diagnostic report on the global data visibility inconsistencies reported across the PraxiHub platform (e.g., students appearing in "Přehled praxí" but missing from "Správa uživatelů"). The audit confirms that these issues stem from systemic architectural vulnerabilities related to data fragmentation, orphaned records, query mismatches, and a lack of referential integrity safeguards across the Firestore schema.

---

## 2. System-Wide Relational Scan

An audit of the NoSQL relational boundaries reveals several critical scenarios where primary entities can disappear or become hidden, leaving active "ghost" records in downstream views:

### 2.1 Users -> Placements Boundary
*   **The "Ghost Student" Anomaly**: When a student is deleted from the `users` collection via the "Správa uživatelů" (`/admin/users`) view, their associated documents in the `placements` collection remain untouched.
*   **Impact**: Dashboards like "Přehled praxí" (`/admin/dashboard`), which query the `placements` collection directly, continue to display these placements. Because these views attempt to hydrate missing data by querying the `users` collection for a non-existent `uid`, the UI either crashes or renders placeholders (e.g., 'Student neuveden', 'Načítám...').

### 2.2 Mentors/Institutions -> Placements & TimeLogs
*   **Orphaned Mentor Logs**: If an institution or mentor is removed from the `users` collection, any `placements` or `time_logs` referencing their `institutionId` or `mentorId` become orphaned.
*   **Impact**: Student dashboards and payroll views attempting to reference the deleted mentor fail to load correctly. Time logs stuck in a "pending" state can never be approved by the (now non-existent) mentor.

### 2.3 Institutions -> Organizations
*   **Dangling Organization References**: The `organizations` collection stores data about companies (`ico`, `obchodniJmeno`), but `placements` and `users` often store duplicated details (`organizationId`, `companyName`, `organization_name`, `organization_ico`).
*   **Impact**: Deleting an organization does not cascade to the `placements` referencing it, leaving legacy strings and invalid references that disrupt ARES lookups and UI components.

---

## 3. Root Cause Categorization

The data visibility inconsistencies are driven by two primary architectural failures:

### 3.1 Frontend Query Mismatches
Different dashboards implement fragmented and conflicting data fetching rules:
*   **Direct Collection Polling vs. Hydration**: The Admin User Management view (`/admin/users`) queries the `users` collection directly. However, the Admin Dashboard (`/admin/dashboard`) queries the `placements` collection and expects the `studentId` to resolve cleanly. The Institution Dashboard (`/institution/dashboard`) attempts client-side hydration (`hydratedPlacements`), mapping `placements` to `users` on the fly.
*   **Filtering Discrepancies**: Views filter by disparate sets of rules. For example, some views hide users without a valid `major`, while others display all users blindly. The lack of centralized query adapters means that data hidden by business logic in one view is fully visible in another.

### 3.2 Backend Referential Failures (No Cascading Deletes)
The root cause of "ghost records" is the absence of cascading deletes or soft-delete mechanisms:
*   **Missing `onDelete` Triggers**: There are no Cloud Functions listening to `onDelete` events for the `users` collection. When `deleteDoc(doc(db, "users", userId))` is executed on the frontend, it removes the user document but fails to clean up associated `placements`, `time_logs`, or Storage objects (like contracts).
*   **Denormalization Traps**: The schema copies data (e.g., `studentName`, `major`) into `placements`. When the primary `users` document is deleted, the `placements` document retains this stale string data, masquerading as a valid record until an explicit foreign-key lookup is performed.

---

## 4. Proposed Global Strategy

To permanently resolve these structural weaknesses and enforce a Single Source of Truth (SSOT), we propose the following architectural interventions. **No database mutations, deletions, or code refactorings are to be executed without stakeholder approval of this strategy.**

### 4.1 Backend Safeguards: Strict Referential Integrity
We recommend moving away from unsafe client-side hard deletes. Instead, we must implement robust backend lifecycle management.

*   **Implementation of Cloud Function `onDelete` Triggers**:
    *   Create a Cloud Function (e.g., `onUserDeleted`) that triggers when a document in the `users` collection is removed.
    *   This function must systematically cascade the deletion to all related collections: removing associated `placements`, recursively deleting `time_logs` and `rubrics` subcollections, and clearing `contracts` from Firebase Storage.
*   **Alternative: Soft-Delete (Tombstone) Strategy**:
    *   Rather than hard-deleting records, introduce an `isDeleted: true` and `deletedAt: timestamp` flag on primary entities (`users`, `organizations`).
    *   Update all frontend queries and Firestore Rules to automatically filter out documents where `isDeleted == true`.
    *   **Recommendation**: A soft-delete approach provides an audit trail and prevents accidental data loss while immediately resolving the UI visibility mismatches.

### 4.2 Standardized Global Query Builders/Adapters
To eliminate frontend query fragmentation, data fetching logic must be abstracted away from individual React components.

*   **Unified Data Access Layer**: Create a set of global hooks/adapters (e.g., `useHydratedPlacements()`, `useActiveUsers()`) located in a shared `lib/api/` or `hooks/` directory.
*   **Consistent Hydration Logic**: These adapters will handle the complex client-side joins (e.g., fetching a placement, mapping the `studentId` to the `users` collection) in exactly one way. If a foreign key lookup fails (because the user was deleted or soft-deleted), the adapter will automatically prune the orphaned placement from the resulting dataset, preventing it from appearing in the UI.
*   **Centralized Filtering**: Enforce Role and Status filtering inside the query builders so that all dashboards obey the exact same visibility rules (e.g., automatically hiding users who have not completed onboarding).

---
**Status**: Pending Stakeholder Review. Do not proceed with implementation until approved.
