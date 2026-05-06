# UI/UX Simplification Proposal for PraxiHub

## 1. Cognitive Load Reduction

The current frontend implementation across student, institution, and admin interfaces is functionally rich but heavily relies on presenting all available options, steps, and statuses simultaneously. This creates a high cognitive load, forcing users to parse large amounts of text and UI elements to find what is relevant to their current state.

**Recommendations:**

*   **Progressive Disclosure:** Instead of showing all steps (e.g., in the Student Dashboard's "Získat smlouvu" or "Schválení organizace" sections), we should only display the *immediate next action required*. Secondary actions or future steps should be hidden or summarized until the prerequisite step is complete.
*   **Step-by-Step Wizards:** The document generation and onboarding processes should be refactored into focused, single-purpose wizard flows. Rather than a long scrolling page of forms, users should be guided through a sequential process (e.g., 1. Choose Role -> 2. Link University -> 3. Define Focus), reducing the overwhelming feeling of complex data entry.
*   **Contextual UI:** Dashboards should intelligently react to the `placement.status` state machine. For instance, if a student is in the `ORG_APPROVED` state, the entire dashboard should focus *exclusively* on generating the contract, hiding generic informational text about finding an organization. The UI must answer the question: *"What is the one thing I need to do right now?"*
*   **Status Translation:** Replace internal status keys (e.g., `PENDING_MATCH`, `NEEDS_REVIEW`) with conversational, user-friendly language in all views, not just via the `STATUS_LABELS` map, and provide a clear explanation of what the status means and who is currently blocking progress.

## 2. Role-Based Dashboards

The rule of three roles (STUDENT, INSTITUTION, COORDINATOR/ADMIN) is well-defined in the backend but the UI layouts often look like slightly modified versions of the same template, leading to mismatched expectations.

**Recommendations:**

*   **Student Dashboard (Focus: Journey & Next Steps):** The layout should shift from a static grid of cards to a "Timeline" or "Journey Map" paradigm. The primary element should be a massive, clear CTA for their immediate next required action (e.g., "Nahrát podepsanou smlouvu"). Supporting metrics (hours completed, skills) should be moved to a secondary tab or sidebar.
*   **Institution Dashboard (Focus: Actionable Inbox):** The current layout lists all placements and logs. This should be reimagined as a "Triage Inbox". The main view should exclusively show items requiring the institution's immediate attention (e.g., "3 students waiting for approval", "10 hours to review"). Items in stable states (like `ACTIVE` placements without pending logs) should be pushed to an "Archive" or "Managed" tab.
*   **Admin Dashboard (Focus: Metrics & Exceptions):** The Admin view is heavily laden with tables and tabs. It should lead with high-level KPI cards (Total Active, Pending Approvals) and a prominent "Exception Report" – a list of items that are stuck (e.g., `NEEDS_REVIEW` AI flags, missing framework agreements). The deep-dive tables should be secondary views. The Master-Detail UX with the slide-over panel should be expanded to more entities to avoid context switching.

## 3. Modern Interaction Paradigms

Forms, long lists, and standard modal dialogs are functional but feel dated and can be clunky on mobile devices.

**Recommendations:**

*   **Command Palette (⌘K / Ctrl+K):** Implement a global command palette, especially for Admins and Coordinators, allowing them to rapidly search for students, institutions, or jump to specific settings without navigating complex menus.
*   **Floating Contextual AI Assistants:** The current `Chatbot` component appears as a discrete element. It should be transformed into a floating action button (FAB) or integrated directly into empty states and complex forms as a contextual helper, providing inline explanations or auto-filling data based on the current page context.
*   **Skeleton Loading States:** Replace generic "Načítám..." text or full-page spinners with skeleton screens that mimic the layout of the loaded content. This reduces perceived loading time and prevents jarring layout shifts once data (like Firestore hydration) completes.
*   **Micro-interactions & Haptic Feedback (Mobile):** Introduce subtle animations for state changes (e.g., a fluid transition when a placement moves from `DRAFT` to `PENDING`), satisfying success animations (confetti or checkmark reveals) when completing a step, and ensure buttons provide immediate visual (and haptic on mobile) feedback.
*   **Mobile-First Bottom Navigation:** For mobile views, move critical navigation and primary actions to a bottom tab bar to improve reachability, rather than hiding them behind a hamburger menu at the top.

## 4. Visual Hierarchy & Whitespace

The current design utilizes Glassmorphism and dark themes, which can look modern but also lead to low contrast and cluttered interfaces if not carefully managed. The reliance on utility classes like `border-white/10` and `bg-slate-800/75` sometimes blurs the distinction between different sections.

**Recommendations:**

*   **Increase Whitespace (Breathing Room):** Significantly increase padding within cards and margins between sections. Let the content breathe. Do not try to fit everything onto a single screen without scrolling.
*   **Typography Refinement:** Use distinct typographic scales to clearly differentiate headings, subheadings, and body text. Important numbers (like completed hours) should use a display font or significantly larger size to establish an immediate focal point.
*   **Contrast and Focus:** Soften the Glassmorphism effect slightly to improve readability. Ensure that the primary CTA on any screen is visually distinct (e.g., using a solid, high-contrast color like the `indigo-600` accent) compared to secondary buttons (outlined or ghost styles).
*   **Semantic Use of Color & Emojis:** Standardize the use of color to indicate state (Green = Success/Active, Amber = Warning/Pending, Red = Error/Blocked). Continue using expressive emojis (✨, 🚨, 📄) as requested by the memory, but ensure they are used consistently as semantic indicators, not just decoration.
*   **Card Containment:** Avoid nesting cards within cards. If a section needs grouping, use subtle background shifts or dividers rather than heavy borders to reduce visual noise.
