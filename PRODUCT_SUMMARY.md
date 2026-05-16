# PraxiHub: Definitive Product Summary

## Executive Summary & Vision
PraxiHub is a centralized pedagogical practice platform designed to eliminate friction in the management, tracking, and evaluation of student practicums. By digitalizing the entire workflow—from contract generation to final reflection—PraxiHub connects students, coordinators, and institutions in a seamless, secure, and intuitive ecosystem.

## UI/UX Innovations (Code-Driven)

### "Enterprise Light Mode"
PraxiHub implements a robust "Enterprise Light Mode" utilizing Tailwind CSS semantic CSS variables (`--background`, `--primary`, etc.) defined in `globals.css` and managed by `next-themes`. This approach supports dynamic theming without relying on hardcoded utility classes (like `slate-900`), ensuring a clean, modern, and accessible interface. The design system leverages Glassmorphism and custom utility classes like `.card` and `.btn-primary` for consistency across the platform.

### Command Palette (⌘K)
Global navigation for Admins and Institutions is powered by a Command Palette (⌘K) integrated via the `cmdk` library at the root `layout.tsx`. This feature enables rapid, keyboard-driven access to key platform areas, such as the Dashboard, Document Center, User Management, and specific student records, dramatically improving operational efficiency.

### Micro-interactions & Toast Notifications
To enhance user feedback and interface fluidity, PraxiHub standardizes global micro-interactions using a toast notification library (e.g., `sonner` or `react-hot-toast`), which is seamlessly integrated into the root `layout.tsx`. Form transitions are smoothed using `@formkit/auto-animate`, providing progressive disclosure and intuitive step-by-step guidance.

### Local Form Persistence (`useDraftStorage`)
To prevent data loss in complex, monolithic forms such as onboarding and contract generation, PraxiHub utilizes a custom `useDraftStorage` hook. This hook synchronizes form state (`formData` and `currentStep`) with `localStorage`, ensuring that users can safely pause and resume their workflows without losing progress.

## The 3-Pillar "Pedagogická praxe" Module

### Náslechy (Observations)
The "Náslechy" module features a Live Tracker with advanced state management. It accurately captures and logs timestamps differentiating between periods when the teacher is speaking and when the student is speaking, providing granular insights into classroom dynamics during observations.

### Výstupy (Microteaching)
The "Výstupy" module incorporates comprehensive Microteaching Rubrics. To optimize performance and prevent database overload during continuous evaluation, the platform employs a `lodash.debounce` auto-save mechanism, ensuring that rubric scores and feedback are reliably synchronized with Firestore without excessive write operations.

### Reflexe (Reflection)
The "Reflexe" module revolutionizes post-practicum analysis by integrating the HTML5 Web Speech API (`SpeechRecognition`) for intuitive voice dictation. Furthermore, student reflections are automatically evaluated against MŠMT KRAU rules by Gemini AI (specifically Gemini 2.5 Pro/Flash), providing immediate, structured, and objective feedback.

## Advanced Architecture & Security

### Cognitive Telemetry
PraxiHub includes a GDPR-compliant Cognitive Telemetry system. A background `useEffect` logger anonymously captures reflection drafts, utilizing `crypto-js` to generate SHA-256 hashes of user IDs. This data is securely stored in the `research_telemetry` Firestore collection, which enforces strict WORM (Write-Once-Read-Many) compliance (allowing creates only).

### WORM Storage for Contracts
To support legally binding Tripartite Signatures, generated contracts are stored in Firebase Storage under strict WORM (Write-Once-Read-Many) policies. Once a contract is written to `contracts/{userId}/{fileName}`, Firebase Storage rules strictly block any modifications (updates or deletions), guaranteeing document immutability.

### Role-Based Access Control
Security and authorization are managed via Firebase Auth Custom Claims (`request.auth.token.role`). This allows `firestore.rules` and Cloud Functions to efficiently validate roles (`isAdmin`, `isCoordinator`, etc.) without requiring redundant database reads, optimizing performance and security.

### AI Document Router & Payroll
The backend features a sophisticated AI Document Router powered by Gemini (e.g., Gemini 2.5 Flash via the `routeDocument` Cloud Function). This system automatically classifies uploaded files and routes them to appropriate storage or processes. Additionally, the Admin Payroll module dynamically calculates payouts by multiplying approved student time logs against rates fetched directly from `system_configs/payroll_settings`, ensuring accurate and automated financial processing.

## Stakeholder Value Matrix

### The Student
*   **Frictionless Access:** Magic link authentication provides seamless entry to the platform.
*   **Verifiable Credentials:** The QR Skill Matrix PDF offers a dynamically generated, easily verifiable record of the student's competencies and completed practicums.

### The Coordinator/Teacher
*   **Efficient Data Management:** The Visual CSV import simplifies the process of onboarding and managing large rosters.
*   **Automated Evaluation:** Gemini AI evaluates student reflections against MŠMT KRAU rubrics, saving significant time while ensuring consistent and objective feedback.

### The Mentor/Institution
*   **Streamlined Administration:** Click-to-sign contracts facilitate rapid and secure legal agreements (Tripartite Digital Signatures).
*   **Simplified Approvals:** Easy hour approvals allow mentors to quickly validate student time logs, seamlessly feeding into the automated payroll system.
