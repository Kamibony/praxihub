# Comparative Workflow Analysis (UPV vs. KPV)

## 1. Step-by-Step Student Lifecycle Comparison

### 1.1 Onboarding & Guard Rails
**Both (UPV & KPV):**
*   **Initial Login:** Upon registering via Magic Link, users without a `firstName`, `lastName`, or `major` in their `users` document are redirected to `/onboarding`.
*   **Guard Rails:** The onboarding flow forces the student to provide their first name, last name, and select their major (UPV vs. KPV).
*   **Enforcement:** Submitting the form writes these values into the `users` Firestore document and optionally updates the `FirebaseUser.displayName`. The `AuthContext` ensures the user cannot bypass this screen if the mandatory properties are missing.

### 1.2 Contract Generation
**KPV:**
*   Users proceed to `/student/generate` to auto-fill their "Smlouva o odborné praxi".
*   They are required to select an institution (company) or enter a new one manually (creating a `PENDING_INVITE` institution).
*   The contract captures the `studentName`, `companyName`, `ico`, `position`, `startDate`, and `endDate`.
*   ARES API lookup is automatically triggered on generation for KPV to Fast-Track organizational validation.

**UPV:**
*   UPV workflows involve generating the contract as well, but their flow doesn't uniquely branch at `/student/generate` structurally. However, UPV relies later on specific "Menovací dekrét" creation by coordinators, which serves as a bureaucratic equivalent to KPV's standard firm contracts.

### 1.3 Dashboard & Logging Structural Differences
The Dashboard (`/student/dashboard`) uses `placement.studentMajor` or `placement.major` to conditionally render the correct logging categories.

**UPV (Náslechy / Výstupy / Reflexe):**
*   **Categories Available:**
    *   `theoretical_observations` (Teoretické náslechy)
    *   `practical_observations` (Praktické náslechy)
*   **Výstupy Pillar:** UPV students see the "Kompetenční rámec (MŠMT KRAU)" rubric pillar (`výstupy`), dynamically loading criteria from `system_configs/ai_krau_rules` and auto-saving text inputs.

**KPV (Stínování / Případové studie):**
*   **Categories Available:**
    *   `shadowing_hours` (Stínování)
    *   `case_studies` (Případové studie)
*   **Výstupy Pillar:** KPV still uses the `výstupy` pillar for rubric evaluation, but their time tracking focuses heavily on shadowed hours vs specific pedagogical observations.

### 1.4 Evaluation & Exit
**Both (AI Reflection):**
*   Both majors must write a final reflection that is evaluated by `evaluateReflection` against the KRAU criteria.
*   The AI outputs structured JSON determining if the reflection passes (`isPass`) or providing reasoning per category (`didacticCompetence`, etc.).

**UPV Specific (Skill Matrix):**
*   UPV includes a specific `generateSkillMatrixPDF` Cloud Function, triggered via "Generovat KRAU Matrix" button, which generates the PDF Skill Matrix using `pdf-lib` and updates `skillMatrixUrl` on the placement.
*   **Menovací dekrét:** UPV features automated "Menovací dekrét" PDFs for their evaluation commissions, completely bypassing standard firm evaluations.

---

## 2. The Missing Auto-fill Bug Diagnosis

### Bug 1: Missing Auto-fill in Onboarding (No Major User)
**Diagnosis:**
When a user first registers via Magic Link, Firebase Auth handles the authentication, but the `users` collection document in Firestore might be empty or missing `firstName` / `lastName`.
1.  The onboarding page relies on the `AuthContext`'s `user` object.
2.  If the user leaves the onboarding midway, it writes to `localStorage` as `onboarding_draft_{uid}`.
3.  However, if they never wrote the draft, the local storage is empty.
4.  The issue stems from the fact that `useAuth` populates `displayName` in the fallback state for new users, but `onboarding/page.tsx` **never attempts to split or pre-fill `firstName` and `lastName` from `user.displayName` or `firebaseUser.displayName`** if it already exists (e.g., from Google SSO or a previous auth state). It only relies on `localStorage` drafts.

### Bug 2: Missing Auto-fill in Contract Generation (KPV)
**Diagnosis:**
When a KPV user navigates to `/student/generate`, the `studentName` input should be auto-filled. The code attempts to do this via:
```typescript
studentName: currentUser.displayName || currentUser.email || ""
```
1.  **The Flaw:** Inside `useEffect` in `/student/generate/page.tsx`, the code calls `onAuthStateChanged(auth, async (currentUser) => ...)` and relies exclusively on `currentUser` (the raw `FirebaseUser` object).
2.  **Why it drops:** During onboarding, `updateProfile(firebaseUser, { displayName: ... })` is called asynchronously. If the student navigates away or logs back in quickly, or if the `AuthContext` handles the merge correctly but the raw `FirebaseUser` hasn't synced `displayName` properly across sessions, `currentUser.displayName` is `null`.
3.  The unified `useAuth` hook explicitly merges Firestore data into the `user` object (`displayName: authUser.displayName, ...data`), which guarantees `displayName` exists because it was written to Firestore as `displayName: \`${firstName} ${lastName}\`.trim()`.
4.  **However, the contract page ignores `useAuth`!** It fetches the raw `FirebaseUser` via `onAuthStateChanged` directly inside a `useEffect`, bypassing the robust state provided by `AuthContext`.

### 3. Proposed Solutions (No Code Changes Executed)

#### Fix for Onboarding (Bug 1)
Modify `apps/web/app/onboarding/page.tsx`'s initial `useEffect` to parse the `displayName` from the `user` context if `firstName` and `lastName` state are empty and there's no draft:
```typescript
// Proposed Fix for Onboarding
useEffect(() => {
  if (user && !firstName && !lastName) {
    const draft = localStorage.getItem(`onboarding_draft_${user.uid}`);
    if (!draft && user.displayName) {
      const parts = user.displayName.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
  }
}, [user]);
```

#### Fix for Contract Generation (Bug 2)
Refactor `apps/web/app/student/generate/page.tsx` to utilize the existing `AuthContext` instead of re-subscribing to `onAuthStateChanged`.
```typescript
// Proposed Fix for Generate Contract
import { useAuth } from "../../../contexts/AuthContext";

export default function GenerateContractPage() {
  const { user: unifiedUser, loading: authLoading } = useAuth();

  // Replace the onAuthStateChanged logic with a useEffect dependent on unifiedUser
  useEffect(() => {
    if (authLoading) return;
    if (!unifiedUser) {
      router.push("/login");
      return;
    }

    // ... fetch placement logic ...

    setFormData(prev => ({
        ...prev,
        // Utilize the unified user which correctly merges Firestore's displayName
        studentName: unifiedUser.displayName || unifiedUser.email || ""
    }));
  }, [unifiedUser, authLoading]);
}
```
This architectural shift ensures consistency and prevents "State Ghosting" by honoring the `AuthContext` as the single source of truth, as mandated in the system memory.