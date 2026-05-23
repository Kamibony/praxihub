# BACKEND & STORAGE SECURITY AUDIT: Zero-Trust Hardening

This document outlines the findings of a comprehensive read-only security audit of the PraxiHub backend architecture, focusing on Cloud Functions, Binary Storage rules, and Data Leakage vulnerabilities.

## 1. Cloud Functions (functions/) - IDOR & Auth Bypass Vulnerabilities

A critical review of the backend logic reveals multiple functions that fail to apply Zero-Trust principles, trusting client input over contextual authorization.

*   **`transitionPlacementState`**: **CRITICAL**. No authorization check is performed beyond ensuring the caller is authenticated. Any user can transition the state of *any* `placementId` in the system, bypassing all process workflows and approvals.
*   **`importRoster`**: **CRITICAL**. The function fails to verify if the caller has the Admin or Coordinator role. Any authenticated user (including students) can trigger this function to bulk import or overwrite user identities and placement data across the platform.
*   **`signContract`**: **HIGH**. The authorization logic for the "company" role is flawed. Due to the boolean condition (`userData.role !== "company" && placementData.organizationId !== context.auth.uid ...`), any user with the `company` role automatically bypasses the ownership check and can electronically sign contracts for *any* placement in the database.
*   **`generatePayrollReport`**: **HIGH**. Lacks role validation. Any authenticated user can generate and download the system-wide payroll report, exposing all mentor identities, organization assignments, and total hours logged across the platform.
*   **`generateCommissionDecree`**: **HIGH**. Lacks role validation. Any user can generate a commission decree for any commission, without verification that they own the commission or have administrative rights.
*   **`fetchAresAndLink`**: **HIGH**. Fails to verify ownership of the target `placementId`. A student can link arbitrary external organizations (via ICO) to other students' placements.
*   **`createContractPDF`**: **MEDIUM**. While the function correctly uses `decodedToken.uid` for the storage path, it blindly trusts client-provided parameters (`studentName`, `companyName`, `ico`, `startDate`) to render the PDF. This enables trivial forgery of official contract documents since the data is not validated against the canonical Firestore placement record.

## 2. Binary Storage (storage.rules) & Impersonation

*   **Storage Access Control Flaw**: In `storage.rules`, the `contracts/{userId}/{fileName}` path allows read/write access if `request.auth.token.impersonatorUid != null`. This wildcard condition does not scope access to the *target* user being impersonated. If an impersonator token is issued, it grants global read/write access to *all* contracts across the platform, completely breaking horizontal isolation.
*   **Publicly Accessible URLs (Data Leakage)**: The `createContractPDF` function generates a custom token UUID and sets it via `firebaseStorageDownloadTokens`, returning a publicly accessible download URL to the client. This bypasses Firebase Storage Rules entirely. Furthermore, the token generation uses a weak, predictable RNG (`Math.random().toString(36) + Date.now()`).

## 3. Data Leakage & Error Handling

Multiple functions leak internal system states, backend stack traces, or raw error messages directly to the client when failures occur:

*   **`createContractPDF`**: Returns the raw `error.message` and `error.code` directly in the HTTP 500 JSON payload.
*   **`findMatches`**: Throws `System Error: ${error.message}` to the frontend, which could leak API keys, rate limit information, or Gemini quota exhaustion details.
*   **`generateCommissionDecree`**, **`fetchAresAndLink`**, **`routeDocument`**, and **`parseDocumentForAI`**: All append the raw Node.js `error.message` to the `functions.https.HttpsError` internal throw. Firebase serializes this and sends it back to the client, exposing backend schema details, downstream external API failures, or Out-of-Memory (OOM) constraints.

## 4. Proposed Hardening Strategy

1.  **Strict Contextual Authorization (Zero-Trust)**: Refactor all callable functions to strictly query Firestore and verify that `context.auth.uid` possesses ownership of the modified resource (e.g., `placementData.studentId === context.auth.uid`), unless the user explicitly holds an `admin` or `coordinator` custom claim.
2.  **Fix Boolean Logic in Signatures**: Correct the `signContract` validation logic to: `if (role === 'company' && placementData.organizationId !== context.auth.uid && placementData.mentorId !== context.auth.uid)`.
3.  **Patch Storage Rules**: Remove the insecure `request.auth.token.impersonatorUid != null` bypass from `storage.rules`. The standard `request.auth.uid == userId` condition natively supports secure impersonation, because the custom impersonation token's `uid` correctly maps to the target `userId`.
4.  **Remove Public Storage Tokens**: Eliminate the use of `firebaseStorageDownloadTokens` in PDF generation functions. Rely exclusively on the Firebase Client SDK to retrieve signed download URLs, inherently protected by `storage.rules`.
5.  **Sanitize Error Responses**: Implement a centralized error-handling wrapper across the `functions/` directory that securely logs the full stack trace internally via `console.error`, but only returns generic, localized exception messages (e.g., "Došlo k interní chybě při zpracování.") to the client.
