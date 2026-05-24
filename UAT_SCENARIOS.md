# UAT Scenarios

This document outlines the User Acceptance Testing (UAT) scenarios for PraxiHub, detailing the "Given-When-Then" steps for the Student, Institutional, and Coordinator journeys.

## 1. Student Journey (UPV/KPV)

**Scenario: Complete placement contract generation.**

*   **Given:** A student (UPV or KPV major) logs into PraxiHub and has an active placement.
*   **When:** The student navigates to the Dashboard, accesses the Placement Detail page, and initiates the "Generate PDF Contract" action.
*   **Then:**
    *   The UI must hydrate identity data (Major, Name) correctly strictly from the Single Source of Truth (SSOT).
    *   The system generates a PDF contract.
    *   The generated PDF must NOT contain any "null" or "undefined" fields.
    *   The system data state remains SSOT-compliant (verified via `integrity_auditor.js`).

## 2. Institutional Journey (Company)

**Scenario: Validate student assignment and signature authorization.**

*   **Given:** An Institutional user (Company representative) logs into PraxiHub.
*   **When:** The user navigates to the Organization Dashboard and lists assigned students. They select a student's contract to view/sign.
*   **Then:**
    *   The UI correctly lists only the students assigned to that specific organization.
    *   The contract is displayed correctly.
    *   The system enforces signature validation, ensuring the company can *only* sign their own assignments (no unauthorized cross-company signing).
    *   The system data state remains SSOT-compliant (verified via `integrity_auditor.js`).

## 3. Coordinator Journey (Admin)

**Scenario: Audit payroll filtering and real-time consistency.**

*   **Given:** A Coordinator (Admin) logs into PraxiHub.
*   **When:** The Coordinator navigates to the Payroll Module, applies audit filters (by major and status), and compares the data.
*   **Then:**
    *   The Payroll Module correctly filters records based on major (UPV/KPV) and status.
    *   The displayed data is consistent in real-time against the underlying `users` and `placements` collections.
    *   The system data state remains SSOT-compliant (verified via `integrity_auditor.js`).
