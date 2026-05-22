# DIAGNOSTIC REPORT: State Machine "Ghosting" in Onboarding Flow

## 1. Flowchart Description

The infinite loop occurs through the following routing sequence:

1. **`/login`** -> User logs in successfully via Firebase Auth and is routed to `/dashboard`.
2. **`/dashboard`** -> Reads the `users` Firestore document, identifies `userData.role` as `student`, and routes to `/student/dashboard`.
3. **`/student/dashboard` (Load Phase)** ->
   - `onAuthStateChanged` fires and receives the Firebase Auth `currentUser` object.
   - **CRITICAL FLAW:** Sets local React state via `setUser(currentUser)`.
   - Fetches the user's Firestore document.
   - Checks if `data.major` or `data.studentMajor` exists. Since it does, it correctly avoids an immediate redirect to `/onboarding`.
   - **CRITICAL FLAW:** The component fails to merge the Firestore `data` into the local `user` state. The local `user` state remains strictly the Firebase Auth object (which fundamentally lacks the `major` property).
4. **`/student/dashboard` (Render & User Interaction Phase)** ->
   - The UI components (e.g., Traffic Light and the Organization Request Form) check the local state for completeness: `user?.major || user?.studentMajor`.
   - Because `user.major` is undefined, the UI falls back to the empty state. The Profile summary displays "Chybí obor", and the Traffic Light turns RED.
   - If the user clicks the RED light or tries to submit an organization request, the event handler explicitly checks `!user.major` and triggers `router.push('/onboarding')`.
5. **`/onboarding` (Load Phase)** ->
   - Fetches the user's Firestore document.
   - Checks `if (data.firstName && data.lastName && data.major)`.
   - Since the data *does* legitimately exist in Firestore, the onboarding page considers the profile complete and immediately executes `router.push('/dashboard')`.
6. **`/dashboard`** -> Routes the user back to `/student/dashboard`. The cycle repeats endlessly.

## 2. State Verification

Here is the breakdown of which state is being verified at each step, and where the divergence happens:

* **`/dashboard`**: Checks `userData.role` from the Firestore `users` document to route the user. Does not verify profile completeness.
* **`/student/dashboard` (Initial Load)**: Checks `data.major` and `data.studentMajor` directly from the **Firestore document (`data`)**. The verification passes.
* **`/student/dashboard` (UI Render & Handlers)**: Checks `user.major` and `user.studentMajor` from the **local React state (`user`)**. The verification fails because `setUser` was only initialized with the Auth object, effectively "ghosting" the server-side truth.
* **`/onboarding`**: Checks `data.firstName && data.lastName && data.major` directly from the **Firestore document (`data`)**. The verification passes, triggering the bounce back.

## 3. The Fix

The data propagation path is broken in `apps/web/app/student/dashboard/page.tsx`.

While the dashboard successfully queries the Firestore document and passes the *initial* validation check, it **fails to propagate the retrieved Firestore fields into the local React `user` state**. The UI and interaction handlers downstream subsequently rely on this incomplete local state, falsely concluding that the profile is missing a major. This causes the dashboard to force an interaction-driven redirect to `/onboarding`, which then consults the *actual* Firestore document and bounces the user back to the dashboard.

The resolution will require merging the Firestore document data with the Auth object when executing `setUser()` in `student/dashboard/page.tsx`.
