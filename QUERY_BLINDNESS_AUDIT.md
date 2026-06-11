# QUERY BLINDNESS AUDIT
## Context
The User view wasn't showing newly signed up users if they haven't completed onboarding. The root cause is frontend query blindness - filtering in the frontend or restrictively querying in the database that leaves out valid users from being visible to Admins/Coordinators.

## Objective
Audit and categorize Firestore queries and data adapters across all core modules (`Users`, `Placements`, `Institutions`, `TimeLogs`) that introduce query blindness. Formulate a global filtering policy.

## Codebase Scan Results

### 1. Hard Security/Tenant Filters
These are logically necessary for tenant isolation and basic functionality:

*   **`apps/web/app/student/dashboard/page.tsx`**
    *   `query(collection(db, "placements"), where("studentId", "==", user.uid))`
    *   Tenant filter: Students should only see their own placements.
*   **`apps/web/app/student/generate/page.tsx`**
    *   `query(collection(db, "placements"), where("studentId", "==", unifiedUser.uid), where("status", "==", "ORG_APPROVED"))`
    *   Tenant filter: Students can only generate contracts for their own approved placements.
*   **`apps/web/app/institution/dashboard/page.tsx`**
    *   `query(collection(db, "placements"), where("institutionId", "==", user.uid))`
    *   Tenant filter: Institutions should only see their own placements.

### 2. Soft State Filters (The "Blind Spots")
These filters hide valid data from Admin/Coordinator views based on state (like missing roles or statuses).

*   **`apps/web/app/admin/users/page.tsx` (Admin User View)**
    *   *Issue:* The `roleFilter` strictly filters to known roles (`student`, `institution`, `coordinator`, `admin`).
    *   *Effect:* Users without a role (e.g., users who just signed up but haven't completed onboarding, or their onboarding failed midway) are entirely invisible when any role filter is active, and even in 'ALL' view if a role is assumed by the system elsewhere. Actually, if `roleFilter === 'ALL'`, it sets `matchesRole = true`. So users without a role *should* show up in 'ALL'.
    *   *Deeper Issue in `useActiveUsers` Adapter:* `apps/web/hooks/useDataAdapters.ts` only filters out `user.isDeleted === true`. This is good. It fetches all users.
    *   *Blindness Check:* If a user has no role, `getRoleBadge(u.role)` will return a fallback, but the role itself might be blank. The filter logic `matchesRole = u.role === roleFilter;` will hide them. If `roleFilter` is `'student'`, incomplete users are hidden. There is no filter option for "Incomplete Profile" or "No Role".
    *   *Another issue:* The search query matches against `name`, `displayName`, `organizationId`, `companyName`, `organizationName`, and `email`. If these are empty, search might fail, but empty search query matches everything.

*   **`apps/web/app/admin/dashboard/page.tsx` (Admin Placement View)**
    *   *Issue:* `filteredPlacements` relies on `COORDINATOR_VIEW_GROUPS`.
    *   *Effect:* If a placement somehow ends up with a state not mapped in `COORDINATOR_VIEW_GROUPS`, it will be completely hidden from the Admin dashboard when `filterStatus !== "ALL"`. Even worse, if it's not handled gracefully in the "ALL" view or map, it might crash or be hidden.
    *   *Another Issue:* `const commQ = query(collection(db, "users"), where("role", "in", ["institution", "mentor", "company"]));` (Wait, this wasn't in the `where` scan? Let me recheck the `grep` output: `apps/web/app/admin/dashboard/page.tsx:126:      const commQ = query(`). Yes, this fetches specifically these roles. If an institution is missing a role, it won't be fetched for this specific logic (though this might just be for a specific dropdown/list).
    *   *Wait, I saw `.filter((u: any) => u.role === "institution")` in `apps/web/app/admin/dashboard/page.tsx`.* Yes, it filters the users array for institutions.

*   **`apps/web/app/admin/payroll/page.tsx`**
    *   *Issue:* `query(placementsRef, where("status", "==", PlacementStatus.EVALUATION))` and `where("status", "==", PlacementStatus.CLOSED)`.
    *   *Effect:* This is logically okay for *payroll calculation* (you only pay for evaluation/closed), but if there's a dispute about a placement stuck in another status, the Admin can't see it here. However, this is a specific module, not a general management view.
    *   *Issue:* `where("status", "==", "approved")` for time logs. Again, correct for payroll, but hides pending logs.

*   **`apps/web/hooks/useDataAdapters.ts`**
    *   `useActiveUsers`: Filters out `user.isDeleted !== true`. This is a hard delete/tombstone filter, which is intended.
    *   `useHydratedPlacements`: Filters out `!p.isDeleted`. Again, intended tombstone filter. BUT it also sets `isDeleted = true` if `studentData` is null or `studentData.isDeleted` is true. This means if a placement exists but the student document is missing/deleted, the placement is *silently hidden*. This is dangerous. An admin should see "Orphaned Placement" instead of it disappearing.

*   **`apps/web/app/institution/dashboard/page.tsx`**
    *   *Issue:* The time logs logic: `const pendingLogs = timeLogs.filter(log => log.status === 'pending');`. This is fine for separating lists, but if a log has an invalid status (e.g., typos in status), it won't show up in `pending` or `approved`. Wait, `reviewedLogs` is `log.status !== 'pending'`. So it covers everything else.

## Proposed Visibility Policy

**The "Show Everything, Badge Exceptions" Policy**

1.  **Admin/Coordinator Data Fetching Must Be Exhaustive:**
    All administrative views (User Management, Placement Management, Institutional Overviews) MUST fetch ALL documents in the respective collections, excluding only explicitly soft-deleted records (`isDeleted: true`).
2.  **No Restrictive `.where()` Clauses for State in Admin Views:**
    Queries to Firestore in Admin views must not use `.where("status", "==", ...)` or `.where("role", "==", ...)` to restrict the base data set.
3.  **Client-Side Filtering Must Include "Other/Unknown" Buckets:**
    If client-side filtering is used (e.g., tabs or dropdowns), there MUST be a way to view records that don't fit the predefined buckets. For example:
    *   User Management must have an "Incomplete/No Role" filter option.
    *   Placement Management must have an "Unknown State" bucket if states don't match the Enum.
4.  **Graceful Degradation and Badging:**
    Instead of hiding records with missing relations or incomplete data, the UI MUST render them with explicit warning badges (e.g., "⚠️ Missing Student Data", "⚠️ Incomplete Profile", "Draft").
    *   *Specifically for `useDataAdapters.ts`:* Do not artificially set `isDeleted = true` on a placement just because the `studentId` cannot be resolved. Keep it visible and let the UI flag it as an orphaned record.

## Action Plan (Pending Approval)

1.  **Refactor `useHydratedPlacements`:** Stop hiding placements where `studentData` is null. Instead, pass a flag (e.g., `isOrphaned: true`) and handle it in the UI.
2.  **Update `apps/web/app/admin/users/page.tsx`:** Add a "Bez role / Nedokončeno" (No Role / Incomplete) option to the `roleFilter` dropdown. Update the `filteredUsers` logic to catch users where `!u.role`.
3.  **Review `COORDINATOR_VIEW_GROUPS`:** Ensure all possible `PlacementStatus` values are mapped to a view group in `apps/web/lib/constants/placementStates.ts`, or add an "Ostatní" (Other) fallback group on the dashboard.
