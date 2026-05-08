# Solution Design & Execution Plan: Technical Debt Remediation

Based on the CTO-level deep dive audit, this document outlines the proposed architectural solutions, required dependencies, and phased execution strategy to address critical technical debt in PraxiHub.

---

## 1. Security & Rules (WORM Compliance & Bypass Safety)

### Proposed Technical Solution
*   **WORM (Write-Once-Read-Many) Enforcement for Contracts:** To support legally binding Tripartite Signatures, Firebase Storage rules will be restructured. Once a file is written to the `contracts/{userId}/{fileName}` path, modifications (updates/deletions) will be strictly blocked.
*   **Strict State Machine Auditing (UAT Bypass Fix):** The `firestore.rules` for the `placements` collection currently allows bypasses if `affectedKeys()` is empty. We will explicitly define the allowed fields for the UAT bypass (`status`, `targetHours`, `migratedHours`) and gate this exception behind an environment-specific check or a specific administrative custom claim, ensuring clients cannot arbitrarily mutate state in production.
*   **Role Validation Optimization:** Replace the repeated `getUserRole()` function evaluations in `firestore.rules` with Firebase Custom Claims injected during authentication. This shifts role validation from the database read path to the auth token, significantly reducing latency and Firestore read costs.

### Dependencies & Patterns
*   **SDK Feature:** Firebase Authentication Custom Claims (e.g., `admin`, `coordinator`, `student`).
*   **Pattern:** WORM (Write-Once-Read-Many) architecture in Firebase Storage rules.

### Phased Execution Strategy
1.  **Phase 1a:** Implement an administrative Cloud Function to backfill existing users with appropriate Custom Claims based on their Firestore role.
2.  **Phase 1b:** Deploy updated `firestore.rules` that utilize Custom Claims (`request.auth.token.role`) instead of database reads.
3.  **Phase 1c:** Deploy updated `storage.rules` enforcing WORM for the `contracts/` directory.
4.  **Phase 1d:** Refactor the UAT bypass rule to require the `admin` Custom Claim rather than relying on an empty `affectedKeys` array.

---

## 2. Monolithic Backend (Decoupling & ARES Integration)

### Proposed Technical Solution
*   **Decoupling the Monolith:** The monolithic `functions/index.js` leads to slow cold starts because all dependencies (e.g., `pdf-parse`, `gemini`) load for every function. We will refactor this into a modular structure using Firebase Gen 2 Cloud Functions and grouped exports, isolating heavy AI functions from lightweight CRUD operations.
*   **ARES API Implementation:** The currently mocked `fetchAresAndLink` function will be fully implemented to query the public ARES REST API (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`).

### Dependencies & Patterns
*   **Library:** `axios` for HTTP requests to the ARES API.
*   **Pattern:** Circuit Breaker & Exponential Backoff for ARES API calls to handle rate limits or endpoint downtime gracefully.
*   **Pattern:** Lazy Loading / Dynamic Imports within Cloud Functions to prevent loading heavy AI libraries until the specific route requires them.

### Phased Execution Strategy
1.  **Phase 2a:** Restructure `functions/index.js` into sub-modules (e.g., `functions/api`, `functions/ai`, `functions/auth`). Implement lazy loading for dependencies like `pdf-parse` and `mammoth`.
2.  **Phase 2b:** Implement the `fetchAresAndLink` logic using `axios` with a retry mechanism and an explicit try/catch fallback to use existing document data if ARES is unreachable.
3.  **Phase 2c:** Deploy and monitor cold start metrics.

---

## 3. AI Integration Resilience

### Proposed Technical Solution
*   **Robust Output Parsing (Structured Outputs):** Reliance on `JSON.parse()` for Gemini outputs is brittle. We will strictly enforce JSON schema compliance using the `response_schema` and `response_mime_type: "application/json"` parameters natively supported by the latest Gemini SDK, offloading parsing safety to the model layer.
*   **Prompt Injection Mitigation:** We will implement an input sanitization layer before passing user-generated text into functions like `routeDocument` and `parseDocumentForAI`.
*   **Context Window Management:** Replace hardcoded substring limits (e.g., `text.substring(0, 5000)`) with a token-aware chunking strategy for large documents, ensuring critical rules are not arbitrarily truncated before reaching the AI.

### Dependencies & Patterns
*   **Library:** (Optional) A lightweight token estimation library if exact chunking is required, though Gemini 2.5 Pro's massive context window may mitigate the need for aggressive chunking if structured correctly.
*   **Pattern:** Structured Outputs (Native Gemini API feature).
*   **Pattern:** Retry with Fallback (re-prompting the model if parsing fails despite schema enforcement).

### Phased Execution Strategy
1.  **Phase 3a:** Update the Gemini API calls in `routeDocument` and `parseDocumentForAI` to use explicit `response_schema` definitions.
2.  **Phase 3b:** Implement input sanitization and dynamic context sizing based on document length.
3.  **Phase 3c:** Implement a retry block for AI calls that gracefully degrades or flags for manual review on repeated failures.

---

## 4. UI Enterprise Standards (Theme & Testing)

### Proposed Technical Solution
*   **Enterprise Accessibility Theme:** The heavy reliance on dark mode (`slate-900`, emojis) limits enterprise adoption. We will introduce a `ThemeProvider` (e.g., `next-themes`) to support an "Enterprise Light" mode, swapping heavy glassmorphism and deep slates for high-contrast, accessible styling compliant with WCAG 2.1 AA.
*   **Automated Regression Testing:** Enterprise scale requires CI/CD confidence. We will repair the currently disabled Playwright testing infrastructure, ensuring the `tests/global-setup.ts` correctly manages emulator ports and the seeding script (`tests/e2e/seed.ts`) populates necessary test state.

### Dependencies & Patterns
*   **Library:** `next-themes` for seamless light/dark mode toggling in Next.js static exports.
*   **Pattern:** CSS Variables / Tailwind Theming Strategy (abstracting hardcoded `bg-slate-900` into `bg-primary` variables controlled by the theme).

### Phased Execution Strategy
1.  **Phase 4a:** Audit and fix the Playwright `global-setup.ts` to ensure reliable emulator booting and teardown in CI.
2.  **Phase 4b:** Introduce `next-themes` and define an "Enterprise Light" palette in `tailwind.config.js`.
3.  **Phase 4c:** Systematically abstract hardcoded dark mode utility classes across core components into semantic variables, starting with the Admin Dashboards.