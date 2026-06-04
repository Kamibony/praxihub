# Comprehensive UX/UI Audit & Redesign Strategy

## Executive Summary
This architectural plan outlines the strategy to systematically overhaul the PraxiHub frontend architecture based on the provided UI/UX simplification proposal and the newly provided Master Blueprint specification. The strategy focuses on transitioning from a cluttered, data-dense interface to a clean, action-oriented, glassmorphism-based design system, while strictly preserving all existing backend functionality, SSOT data logic, and `<UatGate>` isolation.

## 1. Platform Audit & Current State Analysis

**Identified Issues:**
- **Cognitive Overload:** Dashboards (e.g., `student/dashboard/page.tsx`) present too many parallel paths and inactive elements (e.g., all document upload steps simultaneously) instead of a progressive flow based on `placement.status`.
- **Inconsistent Role Layouts:** Admin, Institution, and Student dashboards share similar static card grids rather than reflecting their distinct functional purposes (e.g., Student Journey vs. Admin Metrics).
- **Hardcoded Utility Overuse:** Over-reliance on hardcoded classes undermines the flexibility of `next-themes` and contributes to contrast/readability bugs.
- **Legacy Clutter:** Vestigial features need deprecation in favor of streamlined contextual actions.
- **Micro-interactions:** Heavy use of blocking forms rather than progressive disclosure (`@formkit/auto-animate`).

## 2. Blueprint Mapping & Systemic Translation

**A. Core Design Philosophy Translation:**
- **Typography:** Switch to Google Font 'Poppins' globally (`font-sans`).
- **Backgrounds:** Implement the soft blue-gray body background (`bg-[#f8fafc]`).
- **Glassmorphism & Theming:** Transition to the specified effects: headers use `backdrop-blur-12px` with 85% white opacity; modals use dark glass (`bg-slate-900/30` with `backdrop-blur-8px`). Update `apps/web/app/globals.css` semantic variables to reflect these.
- **Animations:** Standardize custom animations (fade-in, slide-up, subtle icon scaling).
- **Color Palette:** Integrate Indigo/Violet (`brand-500: #6366f1`) as the primary brand color, Slate for text/structure, and strict semantic colors (Emerald, Amber, Rose, Sky) for states.

**B. Layout Architecture Translation:**
- **Two-Column Layout:** Adopt the modern layout: Fixed 300px Left Sidebar (hidden on mobile, white bg, subtle shadow) and a Fluid Main Content Area (`flex-1`, scrollable, sticky top header).
- **Sidebar Elements:** Implement gradient app icon, bold typography, hover states (`hover:bg-slate-50`), active states (`bg-brand-50 text-brand-600`), and embedded KPI widgets at the bottom.
- **Main Content Header:** Build the sticky glass header with breadcrumbs, notification bell (pulsing dot), and primary/secondary action buttons.
- **KPI Grid:** Construct the 5-Column grid for top-level metrics with subtle gradient backgrounds, hover elevation, and large typography.
- **Action-Centric Table:** Develop the "row-as-a-card" pattern with padding, rounded corners, hover highlights (`hover:bg-brand-50/50`), integrated search, and hover-revealed action buttons (`opacity-0 group-hover:opacity-100`).

**C. Component Architecture:**
- **UI Kit:** Create isolated, atomic UI components (e.g., `BrandButton`, `StatusPill`, `GlassCard`) in a new `apps/web/components/ui/` directory.
- **Modals & Overlays:** Standardize modals to the new specs: dark glass backdrop, white rounded box (`rounded-[2.5rem]`), gradient header, and clear action buttons.
- **Contextual FAB:** Migrate notifications or chatbots to a bottom-right FAB with a gradient background and animated notification dot.

## 3. Step-by-Step Execution Plan

**Phase 1: Design System & Theming Foundation**
1. *Tailwind Configuration:* Update `apps/web/tailwind.config.js` to include the 'brand' color palette (Indigo #6366f1), custom animations, and Poppins font stack.
2. *CSS Standardization:* Audit and update `apps/web/app/globals.css` to introduce the new global background and refine semantic Glassmorphism variables.
3. *Component Primitives:* Create the foundational atomic UI components (`apps/web/components/ui/`).

**Phase 2: Global Shell & Layout Architecture**
1. *AppShell Component:* Develop a new global layout wrapper implementing the Left Sidebar and Fluid Main Content area.
2. *UatGate Integration:* Wrap this new global shell inside the existing `<UatGate>` to allow safe, toggleable testing in production without affecting active users.

**Phase 3: Data-Rich Components (KPIs & Tables)**
1. *KPI Grids:* Build out the KPI widgets for dashboards, ensuring they read from existing SSOT backend state without modification.
2. *Action-Centric Tables:* Implement the new table pattern, starting with Admin and Institution views. Use existing data fetching hooks but adapt the rendering to the "row-as-a-card" style.

**Phase 4: Modals & Contextual Floating Actions**
1. *Modal Refactor:* Redesign critical action flows (e.g., "Generovat smlouvu") to use the new rounded modal specifications.
2. *FAB Integration:* Implement the floating action button pattern.

**Phase 5: Pre-Commit & Quality Assurance**
1. *Testing:* Run all relevant E2E and UI tests to ensure `<UatGate>` logic remains intact and SSOT data access paths are unaffected.
2. *Compliance:* Verify WORM rules compliance and Admin Impersonation features remain fully functional with the new UI.

## Conclusion
This strategy ensures the visual and experiential overhaul of PraxiHub strictly according to the Master Blueprint without disrupting the complex state machine (Firebase Firestore reads, cloud function calls, role validations) running beneath the surface. Using `<UatGate>` allows continuous integration of the new design system safely.