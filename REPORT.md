# Architectural Audit: Major (UPV/KPV) Lifecycle & Routing Separation

## 1. Current State Analysis

The current Onboarding and Contract Generation flows suffer from a critical missing data-collection step and cross-session data leaks:

**Onboarding Flaw:**
In `apps/web/app/onboarding/page.tsx`, the onboarding wizard exclusively asks for `firstName` and `lastName`. There is **no mechanism or UI step** asking the student to define their major (`UPV` vs `KPV`).

**Implicit Defaulting:**
Because the `major` is never explicitly set, downstream modules implement unsafe fallbacks, defaulting the major to `UPV`.
For instance, in `apps/web/app/student/dashboard/page.tsx`:
```javascript
major: user.major || 'UPV',
studentMajor: user.major || 'UPV'
```
Similarly, in `functions/index.js` (e.g. `evaluateReflection`):
```javascript
const major = placementData.studentMajor || "UPV";
const configDocId = major === "KPV" ? "ai_rules_kpv" : "ai_rules_upv";
```

**Impersonation State Leak:**
The application uses `localStorage` for drafting states (e.g., `onboarding_draft` saving `{ firstName, lastName }`). This data is **not scoped by `userId`**. When an Admin uses the `getImpersonationToken` function to sign in as a student, the browser's `localStorage` remains intact. The impersonated session pulls the local draft, potentially overwriting the target student's name with the Admin's draft data or vice versa.

---

## 2. Lifecycle Impact Map

When a student enters the system without a strictly enforced `major`, and defaults silently to `UPV`, it corrupts logic across multiple critical modules:

1. **State Machine Transitions (`placements.status`):**
   - **UPV** goes to `PENDING_MATCH`.
   - **KPV** goes to `PENDING_INSTITUTION`.
   - Without a defined major, KPV students are routed into the UPV matchmaking flow incorrectly.
2. **AI Reflection Evaluation (`evaluateReflection`):**
   - The major dictates which AI rules to load from Firestore (`system_configs/ai_rules_upv` vs `system_configs/ai_rules_kpv`).
   - If defaulted to UPV, a KPV student's reflection will be graded against the wrong MŠMT KRAU rules.
3. **Smart AI Matchmaking:**
   - The hybrid filtering algorithm pre-filters institutions based on the student's `major`. An incorrect major results in irrelevant school suggestions.
4. **Contract/Document Logic (`pdf_logic.js` & `index.js`):**
   - UPV requires strict **Tripartite Signatures**, enforcing WORM compliance. KPV has different contractual rules. Defaulting to UPV forces KPV students into a stricter signature flow than necessary.
5. **Admin Payroll Calculations:**
   - Payroll formulas branch based on `UPV` vs `KPV`. An inaccurate major causes incorrect compensation rates to be applied for institutional payouts.

---

## 3. Proposed Architectural Solution

To resolve these systemic issues, we must implement a robust routing and state-management strategy:

### A. Enforce Major Selection During Onboarding
- **Modify Onboarding Flow:** Add a mandatory step in `apps/web/app/onboarding/page.tsx` for students to select their Major (`UPV` or `KPV`).
- **Database Validation:** The Firestore `users` collection must ensure `major` is a required field upon creation.

### B. Eliminate Unsafe Fallbacks
- **Strict Typing:** Remove `major: user.major || 'UPV'` fallbacks across the frontend (`student/dashboard`, `admin/payroll`) and backend (`functions/index.js`).
- **Error Handling:** If `major` is undefined, the system should block the action and throw an explicit error or redirect the user back to a "Complete Profile" screen.

### C. Permanently Isolate State Between Impersonation Sessions
- **User-Scoped Local Storage:** Instead of `localStorage.setItem('onboarding_draft', ...)`, we must scope all draft storage keys by the current User ID (e.g., `localStorage.setItem(`onboarding_draft_${user.uid}`, ...)`).
- **Clear State on Impersonation:** When `stopImpersonating` or `getImpersonationToken` is called, explicitly clear non-scoped `localStorage` drafts or enforce the user-scoped keys to prevent cross-session leaks.
