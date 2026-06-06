# Manual QA Runbook: UAT with Quick-Switch / Impersonation

This runbook guides Quality Assurance and User Acceptance Testing (UAT) testers through end-to-end (E2E) lifecycle validations using the PraxiHub built-in Admin Impersonation feature. This allows for rapid testing of multi-user workflows without needing multiple browsers or logging in and out with different credentials.

## Prerequisites
1. You must be logged in with an Admin account (`role: 'admin'`).
2. Familiarize yourself with the **Impersonation Banner**: When impersonating a user, a banner appears at the top of the screen. You can stop impersonating at any time by clicking the button in this banner.

---

## Scenario A: The UPV E2E Lifecycle

This scenario validates the flow for a student with the **UPV** major, from contract generation to institution signature, and finally to coordinator payroll verification.

### Phase 1: UPV Student - Contract Generation

1. **Initiate Impersonation:**
   - Navigate to the Admin Users list: `/admin/users`
   - Use the search or filters to find a student with the **UPV** major.
   - Click on the student's row to open the right-side CRM panel.
   - Click the button: **"Přihlásit se jako tento uživatel"** (Log in as this user).

2. **Verify Student State:**
   - You should be redirected to the Student Dashboard (`/student/dashboard`).
   - Look for the Impersonation Banner at the top to confirm you are impersonating.
   - **Verification 1:** Check the element with `data-testid="student-name"`. Ensure it matches the student you selected. Expected visual state: The student's name is displayed in a white, bold font.
   - **Verification 2:** Check the element with `data-testid="student-major"`. It must display **UPV**. Expected visual state: A blue badge with "UPV". *Fallback:* If missing, it will display "Chybí obor".

3. **Generate Contract:**
   - Click the button with `data-testid="generate-contract-link-main"` (or `data-testid="generate-contract-link"`).
   - Complete the contract generation wizard steps (using the Draft Storage).
   - Submit the contract and ensure the success state (toast notification or redirect) is triggered.

### Phase 2: Assigned Institution - Contract Signature

1. **Switch Role:**
   - Click **"Zastavit"** (or the equivalent stop button) in the top Impersonation Banner to return to your Admin session.
   - Navigate back to `/admin/users`.
   - Find the **Institution** (Organization/School) that was assigned to the UPV student.
   - Click their row to open the CRM panel and click **"Přihlásit se jako tento uživatel"**.

2. **Verify Cross-Tenant Boundary & Student Assignment:**
   - You should be on the Institution Dashboard (`/institution/dashboard`).
   - Locate the assigned student's card using `data-testid="assigned-student-card"`.
   - **Verification 1:** Within this card, check `data-testid="student-name"`. It must match the UPV student from Phase 1.
   - **Verification 2:** Check `data-testid="student-major"`. It must display **UPV**.

3. **Sign Contract:**
   - Follow the UI prompts on the student's card or placement detail to review and sign the newly generated contract.
   - Verify the success state indicating the tripartite signature requirement is met for the institution.

### Phase 3: Coordinator - Payroll Verification

1. **Switch Role:**
   - Stop impersonating the Institution using the top banner.
   - You are back to your Admin session. (If you want to test specifically as a Coordinator, you can impersonate a Coordinator user, but Admins also have access).

2. **Verify Payroll:**
   - Navigate to the Payroll module: `/admin/payroll`.
   - **Verification 1:** Find the row for the institution using `data-testid="payroll-row"`.
   - **Verification 2:** Confirm the institution name matches via `data-testid="institution-name"`.
   - **Verification 3:** Check the "Schválené hodiny (UPV)" column. Verify that the approved hours exactly match the UPV student's completed data. Ensure the dynamic calculation (hours * rate) matches the system configs.

---

## Scenario B: The KPV E2E Lifecycle

This scenario follows the same validation cycle but specifically targets a **KPV** student. Note that KPV corresponds to the "Odborný výcvik" (OV) mission.

### Phase 1: KPV Student - Contract Generation

1. **Initiate Impersonation:**
   - Navigate to `/admin/users`.
   - Find a student with the **KPV** major.
   - Click their row and click **"Přihlásit se jako tento uživatel"**.

2. **Verify Student State:**
   - **Verification 1:** Check `data-testid="student-name"`.
   - **Verification 2:** Check `data-testid="student-major"`. **Crucial Difference:** This must display **KPV**.

3. **Generate Contract:**
   - Click `data-testid="generate-contract-link-main"`.
   - Complete the KPV specific contract wizard. *Note: KPV contracts may have different terms or evaluation parameters compared to UPV.*

### Phase 2: Assigned Institution - Contract Signature

1. **Switch Role:**
   - Stop impersonating. Navigate to `/admin/users` and impersonate the KPV student's assigned **Institution**.

2. **Verify Assignment:**
   - On the Institution Dashboard (`/institution/dashboard`), find `data-testid="assigned-student-card"`.
   - **Verification 1:** Check `data-testid="student-name"`.
   - **Verification 2:** Check `data-testid="student-major"`. It must explicitly show **KPV**.

3. **Sign Contract:**
   - Complete the signature process for the KPV contract.

### Phase 3: Coordinator - Payroll Verification

1. **Switch Role:**
   - Stop impersonating.

2. **Verify Payroll Data:**
   - Navigate to `/admin/payroll`.
   - Find the institution's `data-testid="payroll-row"`.
   - **Crucial Difference:** Unlike Scenario A, verify the hours and payouts specifically for the **KPV categories**. Ensure KPV time logs are properly categorized and do not bleed into UPV payroll calculations.

---

## Scenario C: New Baselines and System Checks

This section covers validation for the new architectural and design realities of the platform, including UI/UX, layouts, ARES API, regressions, and critical workflows.

### 1. UX/UI & Design System (Light Glassmorphism Consistency)
The application adheres strictly to the 'Master Blueprint' philosophy. Check the following:
- **Global Theme Check:** Verify the UI defaults to a light theme (`bg-[#f8fafc]`) and uses the primary brand color Indigo/Violet (`brand-500: #6366f1`).
- **Glassmorphism Elements:** Inspect header elements for `backdrop-blur-12px`.
- **Dark Mode Encapsulation:** Certain modular views like `/student/dashboard` and `/admin/documents` are intentionally encapsulated as dark themes (e.g. `bg-slate-900/30`, `backdrop-blur-8px`, heavily rounded modals `rounded-[2.5rem]`). Ensure that legacy dark-mode styles do not leak into the global light AppShell.
- **Contrast Check:** Verify text-contrast over glassmorphism backgrounds.
- **Action Tables:** Hover over table rows to confirm that primary action buttons appear correctly on hover.

### 2. Layout Constraints (AppShell Geometry)
The AppShell employs a two-column layout consisting of a fixed 300px sidebar and a fluid main content area.
- **No Horizontal Scrolling:** Verify that across various breakpoints (Desktop, Tablet, Mobile) there is NO horizontal scrolling. The root container should enforce `overflow-x-hidden` and the fluid main content wrapper must use `min-w-0 max-w-full overflow-hidden`.
- **Sidebar Collapse:** On smaller breakpoints, verify the 300px fixed sidebar hides/collapses properly into a hamburger menu or equivalent responsive pattern.

### 3. ARES API Integration
The application uses the ARES REST API to fetch institution details automatically.
- **Valid IČO Test:** Navigate to the Institution creation/editing form. Input a valid IČO (e.g. `00023337` for UK). The form should automatically populate the institution's official name, address, and legal details.
- **Invalid IČO Test:** Enter an invalid or non-existent IČO (e.g. `99999999`). Verify that a clear error message is shown and the system does not crash or partially populate incorrect data.

### 4. Regression Checks
- **Globální dokumenty (Admin Dashboard):** Navigate to the Admin Dashboard. Verify that the legacy "Globální dokumenty" module is completely absent from the UI. Admin document assets are now stored exclusively under `/global_documents/{category}/{dept}/{fileName}`.
- **Legacy Directories:** Ensure there are no active links to deprecated root folders like `templates/`, `compliance/`, or `methodologies/`.

### 5. Registration & Onboarding Workflows (CRITICAL)
Verify the end-to-end user creation scenarios for all primary roles. The application uses Magic Links for primary web auth.

#### A. Self-Registration Paths
1. **Student Registration:** Go to `/signup` and select the Student role. Complete the form and verify the Magic Link email is sent. Click the link and verify you enter the `/onboarding` pipeline to select your major (UPV vs KPV) and complete profile setup.
2. **Institution Registration:** Go to `/signup` and select the Institution role. Complete the form, confirm email, and verify you are directed to the specific Institution onboarding flow to input details like capacity and KRAU criteria.

#### B. Admin-Provisioned Paths
1. **Manual User Creation:** As an Admin (`role: 'admin'`), navigate to `/admin/users`.
2. **Invite User:** Use the admin panel to manually invite/create a new Coordinator or Institution account. Verify that the user receives an invitation email and can set up their account smoothly.

#### C. Role Routing Validation
After completing onboarding or logging in:
- **Student Role:** Verify successful redirection to `/student/dashboard`. Check the 3-state Interactive Traffic Light (Semafor) mapped to the placement status.
- **Institution Role:** Verify successful redirection to `/institution/dashboard`.
- **Coordinator/Admin Role:** Verify successful redirection to `/admin/dashboard`.
