# PraxiHub: Definitive Product Summary

## Executive Overview
PraxiHub is a centralized pedagogical practice platform designed to eliminate friction in the management, tracking, and evaluation of student practicums. By digitalizing the entire workflow—from contract generation to final reflection—PraxiHub connects students, coordinators, and partner institutions in a seamless, secure, and intuitive cloud-based ecosystem, completely replacing fragmented workflows.

## Core UI/UX Innovations & Friction Elimination

### Enterprise Light Mode & Theme System
PraxiHub implements a robust "Enterprise Light Mode" utilizing Tailwind CSS semantic CSS variables (`--background`, `--primary`, etc.) defined in `globals.css` and strictly managed by the `next-themes` library. This ensures adherence to strict accessibility standards and supports dynamic theming without relying on hardcoded utility classes like `slate-900`.

### Global Command Palette
High-speed administrative navigation for Admins and Institutions is powered by a Command Palette implemented using the `cmdk` library. Bound to the `⌘K` / `Ctrl+K` shortcut and injected at the root `layout.tsx`, this feature enables rapid access to critical platform areas.

### Micro-interactions
To enhance user feedback and interface fluidity, PraxiHub standardizes global micro-interactions. Progressive form step transitions are smoothed out using `@formkit/auto-animate` (as architected), combined with instantaneous visual feedback via toast notifications (`react-hot-toast` / `sonner`).

### State Persistence
To protect users against data loss on accidental browser refreshes, complex, multi-step wizards (such as onboarding and contract generation) utilize a `useDraftStorage` custom hook architecture, securely keeping the `formData` and `currentStep` synchronized with `localStorage`.

### Admin Impersonation
PraxiHub features secure role-masking through the `getImpersonationToken` Cloud Function. This functionality safely allows admins to audit and experience workflows from a student's or institution's perspective, complete with a persistent UI banner reminding the user to exit the impersonation session safely via `stopImpersonating`.

## The 3-Pillar "Pedagogická praxe" Module

### Náslechy (Live Tracker)
The Observation (Náslechy) module includes a sophisticated stopwatch component designed for live event tracking. It precisely measures and logs intervals—differentiating between "Učitel hovoří" (Teacher speaking) and "Student hovoří" (Student speaking)—to provide a synchronized timeline chart of classroom dynamics.

### Výstupy (Microteaching Rubrics)
The "Výstupy" module features matrix-style evaluation forms driven dynamically from the `system_configs` Firestore collection (e.g., `system_configs/ai_krau_rules`), eliminating hardcoded graduation rules. To optimize performance and prevent database write bloat, auto-saving logic utilizes a precise client-side `lodash.debounce` mechanism.

### Reflexe (Portfólio & AI Assistance)
The Post-Practicum Reflection layer integrates the HTML5 Web Speech API (`SpeechRecognition`) for zero-friction audio dictation. Once reflections are drafted, an automated evaluation layer leverages Gemini Cloud Functions (e.g., Gemini 2.5) to provide immediate, structured, and objective feedback against MŠMT KRAU standards.

## Advanced Infrastructure, Security & AI Automation

### AI Smart Uploader & Document Center
The Admin Document Center utilizes a sophisticated AI Smart Uploader. Powered by the `routeDocument` Cloud Function using Gemini models, it automatically analyzes uploaded PDFs/DOCX files, categorizing them across departments (UPV/KPV) with a strict 80% AI confidence gate before enforcing manual overrides.

### Cognitive Telemetry & Privacy
PraxiHub employs a background logging engine that chronologically captures text draft progress securely. Stored in the `research_telemetry` Firestore collection, the telemetry relies on one-way SHA-256 hashing (via `crypto-js`) for User IDs, ensuring the system remains entirely anonymous and fully GDPR-compliant.

### WORM Legal Shield
To support legally binding Tripartite Signatures, generated contracts enforce a strict WORM (Write-Once-Read-Many) compliance via Firebase Storage rules (`allow update, delete: if false`). This guarantees cryptographic immutability of signed documents stored under `contracts/{userId}/{fileName}`.

### Dynamic Admin Payroll Module
The platform automatically orchestrates payouts via the `/admin/payroll` module. It dynamically calculates compensation by aggregating approved mentor hours against standardized rates directly fetched from the `system_configs/payroll_settings` document, providing robust cross-institution grouping and one-click browser Blob CSV exports.

## Stakeholder Value Matrix

### The Student
*   **Seamless Access:** Passwordless Magic Link authentication provides secure, frictionless entry.
*   **Verifiable Credentials:** The dynamically generated, QR-verified Skill Matrix PDF offers an objective record of completed practicums and competencies.

### The Coordinator/Teacher
*   **Efficient Operations:** The `VisualMappingImport` tool translates messy Excel/CSV rosters into structured database records seamlessly.
*   **Financial Automation:** The Admin Payroll module instantly calculates multi-tier mentor rewards without error-prone manual spreadsheets.

### The Partner Institution/Mentor
*   **Legal Security:** Click-to-sign cryptographic non-repudiation contract signatures dramatically speed up partnership agreements.
*   **Simplified Feedback:** The intuitive portal simplifies validating student hours and finalizing necessary practicum evaluations.
