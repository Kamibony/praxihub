# Admin Document Center

## Overview
The Document Center is the centralized hub for administrators to manage AI rules, import student rosters, handle contract templates, and maintain compliance archives.

## 1. Smart Uploader & AI Router
The Smart Uploader intelligently routes uploaded files to their proper destinations.

**API Resilience (Handling 429 Errors):**
The AI routing function uses Google's Generative AI. If the API returns an HTTP 429 status code or a quota exhaustion message, the system gracefully catches this and throws a `functions.https.HttpsError('resource-exhausted', ...)`. The frontend intercepts this error and displays a user-friendly toast message: "Omlouváme se, ale AI služby jsou momentálně přetížené (byl vyčerpán limit požadavků). Zkuste to prosím znovu za chvíli.". This prevents unhandled exceptions and infinite retries.

## 2. AI Knowledge Base
Administrators can update the AI evaluation criteria for UPV and KPV. This section allows updating the rules (snippets) that guide the AI in evaluating reflections and other student submissions.

## 3. Roster Import
Administrators can bulk-import student rosters via CSV.

**Data Integrity (State Machine Rules):**
During Roster Import, the system strictly enforces State Machine Rules. To prevent "Ghost" states (users existing without a proper workflow context), the import process mandatorily assigns either `UPV` or `KPV` claims based on the import context. This ensures that every imported user is correctly routed to their respective major's onboarding and dashboard flow.

## 4. Template Manager
Manage the document templates (e.g., contracts) used across the platform.

**State Dependencies (Contract Generation):**
The UI and business logic enforce strict state dependencies. Contract generation can only occur when the placement is in the `ORG_APPROVED` state. The UI conditionally renders the generation links/buttons based on this prerequisite, and the backend validates this state before allowing template processing.

## 5. Compliance Archive
A secure repository for storing and retrieving compliance documents. Documents uploaded here are purely for archival purposes and are NOT analyzed by the AI.
