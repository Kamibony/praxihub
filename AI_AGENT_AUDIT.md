# AI Agent Resiliency & Cognitive Telemetry Audit

This document provides a read-only audit of the AI and cognitive integrations within the application, focusing on architectural resilience, security, and fallback mechanisms.

## 1. Prompt Security & Injection

**Vulnerability Assessment: HIGH RISK**

*   **Chatbot (`chatWithAI`):** The system prompt is passed as the first "user" message in the chat history rather than utilizing the Gemini model's native `systemInstruction` parameter. The user's input (`userMessage`) is appended directly via `sendMessage()`. There is no input length limit or sanitization for `userMessage`, making it highly susceptible to Prompt Injection (e.g., "Ignore all previous instructions...").
*   **Document Analysis (`evaluateReflection`, `routeDocument`, `parseDocumentForAI`, `analyzeContract`):** User-supplied text (such as student reflections or parsed document text) is concatenated directly with the system prompt (e.g., `` `${systemPrompt}\n\nText reflexe:\n${reflectionText}` ``). This structure allows adversarial users to inject instructions within their submitted documents, potentially overriding the evaluation rules or routing logic to force a specific outcome.
*   **Sanitization:** While `routeDocument` and `parseDocumentForAI` strip zero-width characters (e.g., `/[\u200B-\u200D\uFEFF]/g`), they do not sanitize for prompt injection vectors. The `chatWithAI` and `evaluateReflection` endpoints do not perform any sanitization.

**Hardening Proposals:**
*   Migrate all system prompts to the native `systemInstruction` field in the Gemini API configuration.
*   Implement strict input validation and sanitization for all user-provided strings before sending them to the LLM.
*   Use clear delimiters (e.g., `--- USER TEXT ---`) to separate instructions from user content.

## 2. Semantic Self-Healing & Fallbacks

**Vulnerability Assessment: MEDIUM RISK**

*   **Structured Outputs:** The integrations correctly utilize Gemini's `responseSchema` and `responseMimeType: "application/json"` to enforce JSON output formats. This significantly reduces the risk of malformed responses.
*   **Error Handling & Degradation:**
    *   In `analyzeContract`, if the AI throws an error (e.g., timeout or parsing failure), the system updates the contract status directly to `"REJECTED"` and stores the error message. This is a hard failure rather than a graceful degradation (e.g., routing to a human reviewer as "NEEDS_MANUAL_REVIEW").
    *   In `findMatches` and `evaluateReflection`, errors during JSON parsing or generation trigger an immediate `HttpsError`, returning a generic failure to the frontend without any retry mechanism or fallback to a simpler heuristic model.
    *   In `chatWithAI`, the lack of a response throws an internal error, which the frontend handles by displaying "AI momentálně neodpovídá.", but there are no retries or exponential backoff mechanisms.
*   **Missing Telemetry:** If an LLM call fails, the error is logged to Cloud Functions console, but there is no centralized cognitive telemetry or dashboard to alert administrators of anomalous AI behavior (such as elevated failure rates).

**Hardening Proposals:**
*   Implement a retry mechanism with exponential backoff for transient AI API errors (e.g., `429 Too Many Requests`, `503 Service Unavailable`).
*   Instead of "REJECTED" on failure in autonomous logic, use a fallback state like "NEEDS_MANUAL_REVIEW" to keep the workflow moving without penalizing the user.
*   Add a generic try-catch fallback parser that can attempt to extract JSON using regex if the LLM ignores `responseMimeType`.

## 3. Token Management & Rate Limiting

**Vulnerability Assessment: HIGH RISK**

*   **Context Window Management:**
    *   `routeDocument` and `parseDocumentForAI` intelligently truncate input texts using `.substring(0, 30000)` and `.substring(0, 80000)` to prevent context window overflow.
    *   However, `evaluateReflection` and `chatWithAI` do not limit the user input length. A malicious user could send a multi-megabyte string, causing a `400 Bad Request` from the Gemini API or a massive token consumption spike.
    *   In `Chatbot.tsx`, the frontend does not send conversation history; `chatWithAI` processes only the current user message and the system prompt. This prevents infinite context accumulation, but it also means the chatbot has zero memory of the conversation.
*   **Rate Limiting & Unbounded Consumption:**
    *   There are no application-level rate limits (e.g., via Firebase App Check, Redis, or Firestore tokens) on callable endpoints like `chatWithAI`, `evaluateReflection`, or `generateShowcaseNarration`. An authenticated user (or unauthenticated, in the case of some endpoints) could run a script to repeatedly ping these endpoints, leading to unbounded API billing costs (Denial of Wallet).
    *   `chatWithAI` defaults to "visitor" for unauthenticated users, meaning anyone on the internet can invoke this LLM endpoint without restrictions.

**Hardening Proposals:**
*   Implement Firebase App Check on all callable Cloud Functions to prevent unauthorized script access.
*   Implement server-side rate limiting (e.g., max 10 messages per minute per user) stored in Firestore or Memory.
*   Enforce hard character limits on all user text inputs (e.g., maximum 5,000 characters for chat messages and reflections) before they reach the LLM API.
*   Modify `chatWithAI` to accept and manage a rolling window of recent conversation history to provide contextual responses without blowing up token usage.
