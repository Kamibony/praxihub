# DATA MODEL AUDIT: Single Source of Truth (SSOT) Verification

## 1. Current Schema Snapshot

Based on the codebase review, the current Firestore database collections are structured as follows:

### `users` Collection
- **Primary Key**: `uid` (matches Firebase Auth UID)
- **Fields observed**:
  - `email` (string)
  - `role` (string: STUDENT, INSTITUTION, COORDINATOR, ADMIN)
  - `name` / `displayName` / `firstName` / `lastName` (string) - *Fragmented across different components.*
  - `major` / `studentMajor` (string: UPV, KPV) - *Fragmented and inconsistently named.*
  - `targetHours` (number)
  - `organizationId` / `companyName` / `organizationName` (string) - *Institution-specific fields.*
  - `createdAt` (timestamp)

### `placements` Collection
- **Primary Key**: `docId` (auto-generated)
- **Fields observed**:
  - `studentId` (string, foreign key to `users`)
  - `studentName` (string) - *Denormalized from `users`.*
  - `studentEmail` (string) - *Denormalized from `users`.*
  - `major` / `studentMajor` (string) - *Denormalized from `users` and fragmented.*
  - `institutionId` / `mentorId` (string, foreign key to `users`)
  - `organizationId` (string, foreign key to `organizations`)
  - `status` (string, state machine driver)
  - `targetHours` (number)
  - `migratedHours` (number)
  - `description` (string)
- **Subcollections**:
  - `time_logs`: Stores hours and reflection logs.

### `organizations` Collection
- **Primary Key**: `docId` (auto-generated)
- **Fields observed**:
  - `ico` (string)
  - `obchodniJmeno` / `name` (string)
  - `sidlo` (string)

### `contracts` (Firebase Storage)
- **Structure**: Contracts are saved primarily as PDF documents in Firebase Storage at paths like `contracts/{userId}/{fileName}`. They are not a separate Firestore collection but their generation depends on the student and organization details.

### `audit_logs` Collection
- **Purpose**: Append-only collection for secure auditing (Tripartite Signatures).
- **Fields**: `userId`, `action`, `timestamp`, `ip`, `documentId`.

---

## 2. Duplication & Fragmentation Analysis

### Duplicated / Fragmented Fields

1.  **Major / Specialization**:
    *   **Locations**: `users.major`, `users.studentMajor`, `placements.major`, `placements.studentMajor`.
    *   **Issue**: Highly fragmented. The codebase contains complex conditional logic (e.g., `user.major || user.studentMajor || placement.studentMajor || placement.major`) just to determine if a student is UPV or KPV. This leads to inconsistent states and bugs.
    *   **Trust**: The UI often trusts the denormalized placement major or falls back to the user document, creating a tangled web without a clear SSOT.

2.  **Student Name**:
    *   **Locations**: `users.name`, `users.displayName`, `users.firstName`, `users.lastName`, `placements.studentName`.
    *   **Issue**: `placements.studentName` is a copied value. If a user updates their profile name, their existing placements will show the old name unless explicitly synced. Also, `displayName` vs `name` causes issues in Admin/Institution dashboards.
    *   **Trust**: Many dashboards map `placement.studentName` first before falling back to hydrated user data, trusting the potentially stale denormalized data.

3.  **Student Email**:
    *   **Locations**: `users.email`, `placements.studentEmail`.
    *   **Issue**: Same as name; an email change in the user profile won't automatically propagate to `placements.studentEmail`.

4.  **Institution / Organization Details**:
    *   **Locations**: `users.companyName`, `users.organizationName`, `placements.organization_name` (implied by hydration code), `organizations` collection fields.
    *   **Issue**: Mixing references and hardcoded strings. `users` collection has `organizationId`, `companyName`, and `organizationName`.

### Why Denormalization Exists

Denormalization (storing `studentName` and `major` in `placements`) was likely introduced to avoid an extra network request to the `users` collection when fetching lists of placements (e.g., for the Admin or Institution Dashboard). In NoSQL databases like Firestore, fetching relations requires client-side joins (hydration), which can be slower.

However, the lack of strict synchronization mechanisms (like Cloud Functions triggered on `users` update) has led to out-of-sync data.

---

## 3. Proposed SSOT Data Dictionary

To resolve these severe denormalization issues, we must establish strict Single Source of Truth (SSOT) rules.

### `users` Collection (The Source of Truth for Identity & Role)

This collection owns all persistent user identity properties.
*   **`uid`** (String): Primary Key.
*   **`email`** (String): SSOT for email.
*   **`displayName`** (String): SSOT for the full name. Deprecate `name`, `firstName`, `lastName`.
*   **`role`** (String): `STUDENT`, `INSTITUTION`, `COORDINATOR`, `ADMIN`.
*   **`major`** (String): SSOT for the student's program (`UPV`, `KPV`, or `null` if not a student). Deprecate `studentMajor`.
*   **`targetHours`** (Number): SSOT for the student's overall goal.
*   **`organizationId`** (String): (For INSTITUTION roles) Reference to the `organizations` collection. Deprecate `companyName`, `organizationName`.

### `placements` Collection (The Source of Truth for State)

This collection represents the relationship and the current state of a specific internship. It should *only* store foreign keys, not copy user data, unless strictly managed by backend sync.

*   **`id`** (String): Auto-generated.
*   **`studentId`** (String): Foreign Key -> `users.uid`.
*   **`institutionId`** (String): Foreign Key -> `users.uid` (the specific mentor/account).
*   **`organizationId`** (String): Foreign Key -> `organizations.id` (the company).
*   **`status`** (String): SSOT for the state machine.
*   **`migratedHours`** (Number): Placement specific overrides.

#### Handling Denormalization (The "Join" Problem)

**Option A: Strict Normalization (Client-Side Hydration)**
*   **Action**: Remove `studentName`, `studentEmail`, `major`, `studentMajor` from the `placements` collection entirely.
*   **Pros**: Impossible to have out-of-sync data. Data model is perfectly clean.
*   **Cons**: Requires the frontend to always perform "hydration" (fetching the associated `user` document for every `studentId` in a placement list). We already do this in some places (e.g., `InstitutionDashboard` uses `hydratedPlacements`).

**Option B: Managed Denormalization (Backend Sync)**
*   **Action**: Keep `studentName` and `studentMajor` in `placements` for fast querying (e.g., "Give me all UPV placements"), but enforce synchronization via a Firestore Trigger.
*   **Pros**: Fast read queries without complex client-side joins.
*   **Cons**: Increases write costs and backend complexity.

### Recommendation & Directive

Given the current scale and the fact that we already have a `hydratedPlacements` pattern emerging in the UI, **Option A (Strict Normalization)** is the safest and cleanest approach for the core schema.

For high-performance list views (like Admin Dashboard), we should load the `placements`, extract all unique `studentId`s, and fetch those `user` documents in a single batched query, caching them in memory or a global store.

### Cloud Function Synchronization (If Option B is required for specific queries)

If we find we *must* query placements by `major` directly on the database level (e.g., `where("major", "==", "UPV")`), we must implement the following Cloud Function:

```javascript
exports.syncUserUpdatesToPlacements = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();

    // Check if the SSOT fields changed
    if (newValue.displayName !== previousValue.displayName ||
        newValue.major !== previousValue.major ||
        newValue.email !== previousValue.email) {

      const placementsRef = db.collection('placements');
      const q = placementsRef.where('studentId', '==', context.params.userId);
      const snapshot = await q.get();

      if (snapshot.empty) return null;

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          studentName: newValue.displayName,
          studentEmail: newValue.email,
          major: newValue.major // use ONLY major in placements, drop studentMajor
        });
      });

      return batch.commit();
    }
    return null;
  });
```

*Note: Before writing this trigger, we must clean up the historical fragmented data in the database.*
