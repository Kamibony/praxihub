# DUPLICATION AUDIT REPORT

## Executive Summary
Following reports of anomalous duplicate records (e.g., profiles with identical student identities like "Janko Vrtil", "Nikol Kozlov"), a system-wide diagnostic audit was conducted to evaluate uniqueness enforcement across the platform's NoSQL Firestore database.

Because Firestore lacks native `UNIQUE` column constraints, the risk of data duplication exists when creating new records or synchronizing states. This report outlines the global fields that require strict uniqueness, provides a diagnostic script to map existing duplicates without mutations, and proposes a long-term architectural strategy to enforce uniqueness and improve global searchability.

---

## 1. Global Unique Field Identification

An audit of the schema (`DATA_SCHEMA_AUDIT.md`) and platform logic identified the following fields across core collections that must remain strictly unique:

### `users` Collection
*   **`uid`**: Primary Key (Firebase Auth mapping). Naturally unique.
*   **`email`**: The Single Source of Truth for user email addresses. Must be globally unique across all roles.
*   **`studentId`**: University-issued identifier (if mapped dynamically). Should be strictly unique for `STUDENT` roles. Multiple profiles sharing the same `studentId` indicates duplicate onboarding or ghost states.
*   **`displayName`**: While technically people can share names, frequent duplication combined with identical roles suggests anomalous duplicate accounts.

### `organizations` Collection
*   **`docId`**: Primary Key. Naturally unique.
*   **`ico`**: (Business ID / IČO). Must be unique to prevent fragmented data mapping and duplicate ARES lookups for the same legal entity.

### `placements` Collection
*   **`docId`**: Primary Key. Naturally unique.
*   **Logical Pair (`studentId` + `organizationId`)**: A student should typically only have one active placement relationship with a specific organization at a given time to prevent ghost states or repeated enrollments.

---

## 2. Diagnostic Audit Script

A read-only Node.js diagnostic script has been created to safely scan the production database (or emulator) and output a comprehensive log of all existing duplicate records based on the identified unique fields.

**Script Path:** `scripts/audit_duplicates.js`

**How it works:**
*   It aggregates data using in-memory Maps.
*   For **Users**, it checks for duplicates across `email`, `studentId`, and `displayName`/`name`.
*   For **Organizations**, it scans for duplicate `ico`.
*   For **Placements**, it identifies any duplicated `studentId` + `organizationId` relationships.
*   **Safety:** It performs only `get()` reads and mutates no data.

---

## 3. Proposed Prevention Strategy

To permanently enforce uniqueness in our NoSQL architecture, we must implement robust backend constraints.

### Recommended Approach: Dedicated Registry Collections & Transactions

Given the limitations of Firestore Security Rules regarding complex cross-collection validation at scale, the most reliable pattern is the **Registry Pattern** combined with **Transactions**.

1.  **Registry Collections:**
    *   Create lightweight collections used purely as indexes: `used_emails`, `used_student_ids`, `used_icos`.
    *   The document ID in these collections is the value we want to ensure is unique (e.g., `used_icos/12345678`).

2.  **Transactional Pre-Flight Checks:**
    *   When creating a new Organization or onboarding a User, the request is routed through a Cloud Function (or uses a client-side transaction).
    *   The transaction attempts to create the registry document *and* the actual data document simultaneously.
    *   If the registry document already exists (e.g., `used_icos/12345678` already exists), the transaction fails automatically, guaranteeing absolute uniqueness.

3.  **Firestore Security Rules (Alternative/Supplementary):**
    *   We can update `firestore.rules` to enforce uniqueness by checking if a document exists.
    *   *Example:* `allow create: if !exists(/databases/$(database)/documents/organizations/$(request.resource.data.ico));` (This requires the `ico` to be the primary key or using a registry).

---

## 4. Enhancing Global Searchability

To empower stakeholders to easily verify records and audit the database state without developer intervention, the Admin UI search capabilities must be upgraded.

### Admin User Management & Dashboards
*   **Unified Search Bar:** Upgrade the frontend search inputs (in `/admin/users` and `/admin/dashboard`) to support multi-field querying.
*   **Direct Field Lookups:** Allow searching explicitly by `studentId`, `email`, or `ico`.
    *   *Implementation:* The search function should parse the query string and apply multiple `.where()` clauses (using logical ORs on the backend, or client-side filtering over hydrated lists) to match against the specific unique identifiers.
*   **Visibility Flags:** Implement a "Show Duplicates" filter button in the UI that highlights records sharing identical `studentId`s or `ico`s, surfacing the anomalies directly to the admin visually.
