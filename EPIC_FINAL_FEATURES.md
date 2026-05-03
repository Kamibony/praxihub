# EPIC_FINAL_FEATURES.md: Finalizing PraxiHub v1.0

This document outlines the detailed action plan and technical specification for implementing the final 5 features required to bring PraxiHub v1.0 to 100% feature completion according to the original BRD.

## 1. Live E-Portfolio
**Shareable student profiles with Skill Matrix and Digital Badges.**

* **Proposed Implementation Strategy:**
  * **Backend (Firebase):** Create a new `portfolios` subcollection under `users/{uid}/` or extend the `users` document to store public-facing data (Skill Matrix, achieved Badges). Ensure `firestore.rules` allows public read access if a specific `isPublic` flag is set to true.
  * **Frontend (Next.js):** Create a dynamic public route (e.g., `/p/[studentId]`) in `apps/web/app/p/[studentId]/page.tsx`. This page will fetch and display the user's portfolio data, badges, and evaluated reflections without requiring authentication.
  * **Badges System:** Implement a Cloud Function that listens for placement state changes (e.g., transitioning to `FINAL_EXAM` or `CLOSED` with a high grade) and automatically awards digital badges by updating the user's profile.
* **Dependency Map:** Independent, but ideally requires Placements and Reflections to be completed to populate the portfolio with meaningful data.
* **UI/UX Impact:** Requires a new, highly polished, read-only view. Will use the established dark slate theme, Glassmorphism cards, and expressive emojis (🎓, 🌟, 💼). Must be completely responsive for mobile viewing (often shared via mobile devices).
* **Technical Risks:** Data privacy. We must strictly ensure that only explicitly shared data is exposed on the public route. Unintended data leaks (e.g., exposing personal emails or private coordinator notes) are the primary risk.

## 2. Zero-Cost Voice Diaries
**Students dictate logs via mobile using free HTML5 Web Speech API; AI fixes grammar.**

* **Proposed Implementation Strategy:**
  * **Frontend (Next.js):** Integrate the HTML5 `SpeechRecognition` API (or `webkitSpeechRecognition` for broader compatibility) within the "Add Log" modal in the Student Dashboard. Add a prominent microphone button (🎙️) to start/stop dictation.
  * **AI Integration:** When dictation finishes, send the raw transcript to a new Cloud Function (`enhanceVoiceLog`) or directly to an existing AI utility function that uses `gemini-2.5-flash` to correct grammar, punctuate, and format the text into formal Czech before saving it to Firestore.
* **Dependency Map:** Depends on the existing Placement Logging feature.
* **UI/UX Impact:** Adds a "Dictate" (🎙️ Nadiktovat) button next to the text area. Needs visual feedback (e.g., a pulsating animation or audio waves) while recording is active, and a loading state while AI is processing the transcript.
* **Technical Risks:** Cross-browser compatibility of the Web Speech API (Safari iOS support can be spotty or require specific user interactions). Ambient noise in schools might result in poor transcription quality. The AI prompt must be carefully tuned to correct grammar without hallucinating new information.

## 3. Smart AI Matchmaking
**AI recommends practice schools based on the student's major/past skills.**

* **Proposed Implementation Strategy:**
  * **Backend (Cloud Functions):** Create a Callable Cloud Function `suggestInstitutions`. It will retrieve the student's profile (major, past skills from E-Portfolio, location preference) and query the `organizations` or `institutions` collection for available placements.
  * **AI Processing:** Pass the student profile and a list of available institutions to `gemini-2.5-pro` (or use local heuristics combined with AI embeddings if the dataset is large) to score and rank the top 3-5 best matches.
  * **Frontend (Next.js):** Add a "Doporučené praxe" (✨ Doporučené praxe) section in the Student Dashboard (when in `DRAFT` or `PENDING_MATCH` state).
* **Dependency Map:** Depends on the E-Portfolio/Skill Matrix data being populated, and requires a robust database of Institutions with well-defined focus areas.
* **UI/UX Impact:** A new carousel or list view of recommended institutions in the Student Dashboard with AI-generated reasoning snippets ("Proč se k vám hodí: ...").
* **Technical Risks:** AI latency. Passing large lists of institutions to Gemini could be slow or hit token limits. A hybrid approach (pre-filtering via Firestore queries by region/major, then AI ranking) will be necessary.

## 4. Optional "QR Hub"
**Security QR seals on PDFs and quick-scan for mentors.**

* **Proposed Implementation Strategy:**
  * **PDF Generation (Cloud Functions):** Integrate a library like `qrcode` into the existing PDF generation Cloud Function (e.g., Final Exam decrees or Contracts). Generate a QR code containing a secure verification URL (e.g., `https://praxihub.cz/verify/[docId]`).
  * **Frontend Verification:** Create a lightweight public verification route (`/verify/[docId]`) that checks the document's hash or ID against the `audit_logs` or document metadata to confirm authenticity.
  * **Mentor Quick-Scan:** Provide a scanner UI in the mobile app or web app (using `html5-qrcode`) for mentors to quickly access a student's placement record.
* **Dependency Map:** Independent, but enhances the existing Tripartite Digital Signatures and Document Center.
* **UI/UX Impact:** QR codes visually embedded in PDFs. A new scanning interface (📷 Skener) in the Institution Dashboard for quick access.
* **Technical Risks:** Ensuring the verification URL is secure and cannot be easily spoofed. Handling camera permissions and mobile browser compatibility for the web-based QR scanner.

## 5. Ping System (Assistant)
**Friendly automated email reminders (Days 7, 14, 21) to schools for pending approvals.**

* **Proposed Implementation Strategy:**
  * **Backend (Cloud Functions - Scheduler):** Create a scheduled Cloud Function (`cronPingReminders`) that runs daily (e.g., via `pubsub.schedule('0 8 * * *')`).
  * **Logic:** The function queries the `placements` collection for documents in `PENDING_INSTITUTION` or `PENDING_ORG_APPROVAL` states. It calculates the days elapsed since the last state change.
  * **Email Trigger:** If the elapsed time matches 7, 14, 21 days, use Firebase Extensions (Trigger Email) or SendGrid/Nodemailer to send a localized, friendly email reminder to the institution's contact email. Log the ping in the `audit_logs` to prevent duplicate sending.
* **Dependency Map:** Depends on the Placement State Machine and Institution assignments.
* **UI/UX Impact:** No direct UI changes, but perhaps a small indicator in the Coordinator Dashboard showing when the last reminder was sent (⏱️ Odeslána upomínka).
* **Technical Risks:** Cloud Scheduler quotas and execution time limits. The function must handle potential failures gracefully and process queries in batches to avoid timeouts if the number of pending placements grows large. Ensure emails don't end up in spam.

---

## Recommended Sprint Order

To implement these features logically and minimize friction, the following sequence is recommended:

1. **Sprint 1: Ping System (Assistant)**
   * **Why:** High business value for reducing bottlenecked placements. Independent of UI changes. Strengthens backend reliability.
2. **Sprint 2: Zero-Cost Voice Diaries**
   * **Why:** Highly requested usability feature for students. Can be developed and tested iteratively on the frontend without major database schema changes.
3. **Sprint 3: Live E-Portfolio**
   * **Why:** Establishes the public-facing data structure and prepares the Skill Matrix foundation needed for matchmaking.
4. **Sprint 4: Smart AI Matchmaking**
   * **Why:** Heavily depends on the structured data introduced by the E-Portfolio. High complexity, best tackled when the data model is stable.
5. **Sprint 5: Optional "QR Hub"**
   * **Why:** A "nice-to-have" security and convenience feature. Can be implemented last as an enhancement to the existing document and signing flows.