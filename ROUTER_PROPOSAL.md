# Architectural Proposal: Intelligent Document Router

## 1. Current State Analysis
The Admin Document Center currently operates with a complex, tabbed UI that requires manual selection of destination and intent.
There are 4 main categories, combined with 2 department scopes (UPV, KPV), resulting in 8 distinct endpoints:
- **AI Knowledge Base (UPV/KPV)**: Used for setting AI evaluation rules. Files uploaded here are parsed on the client (via `parseDocumentForAI` cloud function), and the resulting text (metodika, uznatelnost, kompetencni_ramec) is appended to the UI textareas for manual review and subsequent saving to the `system_configs` Firestore collection (documents: `ai_rules_upv`, `ai_rules_kpv`).
- **Roster Import (UPV/KPV)**: Excel/CSV files are processed via the `VisualMappingImport` component to create/update user accounts and placements. This involves client-side reading and mapping, followed by calling a backend import function.
- **Template Manager (UPV/KPV)**: Files (PDF, DOCX, PPTX) uploaded here are directly stored in Firebase Storage under `global_documents/templates/{dept}/{filename}`.
- **Compliance Archive (UPV/KPV)**: Files (PDF, DOCX, PPTX) uploaded here are directly stored in Firebase Storage under `global_documents/compliance/{dept}/{filename}`.

## 2. Routing Logic Design
The Gemini prompt for the "Smart Uploader" needs to analyze the raw text/content of the document (or initial parsed rows for spreadsheets) to determine its category and department.

**Prompt Structure:**
- **Role**: You are an expert Document Classification AI for a university placement system.
- **Input**: The extracted text of a document or the first few rows of a spreadsheet.
- **Task**: Classify the document into exactly one of the following endpoints.
- **Categories**:
    1. `AI_RULE`: Contains methodologies, competency frameworks, or recognition rules (Metodika, Kompetenční rámec, Uznatelnost).
    2. `ROSTER`: Contains lists of students, IDs, emails, hours, or organization details (typically from Excel/CSV).
    3. `TEMPLATE`: Contains blank forms, placeholders (e.g., "[Jméno]", "Zde doplňte"), or generic templates for student/mentor use.
    4. `COMPLIANCE`: Contains signed framework agreements, contracts, or legal compliance documents between the university and institutions.
- **Department Scope**: Determine if the document relates to:
    1. `UPV`: Učitelství (Teaching). Keywords: učitel, škola, pedagogika, didaktika.
    2. `KPV`: Poradenství (Counseling). Keywords: poradenství, poradce, psychologie.
    3. `UNKNOWN`: If not explicitly clear.
- **Output Schema (JSON)**:
  ```json
  {
    "category": "AI_RULE | ROSTER | TEMPLATE | COMPLIANCE | UNKNOWN",
    "department": "UPV | KPV | UNKNOWN",
    "confidence": 0-100,
    "reasoning": "Short explanation of the classification."
  }
  ```

## 3. Data Flow
1. **User Action**: The admin drops a file into the unified "Smart Uploader" dropzone in the UI.
2. **Initial Parsing**:
   - If PDF/DOCX: The frontend reads the file as base64 and calls a new backend function `routeDocument`.
   - If XLSX/CSV: The frontend reads the first few rows to extract a sample, then calls `routeDocument`.
3. **AI Classification (`routeDocument` Cloud Function)**:
   - Uses `pdf-parse`/`mammoth` (or reads the CSV sample) to extract text.
   - Calls the Gemini API with the Routing Logic Prompt.
   - Receives the JSON classification output.
4. **Action Routing**:
   - If `category` is `AI_RULE`: The function proceeds to parse the 3 sub-sections (metodika, uznatelnost, kompetencni_ramec) using the existing extraction logic and returns them to the frontend to populate the AI Knowledge Base textareas for manual review.
   - If `category` is `ROSTER`: The function returns a signal to the frontend to open the `VisualMappingImport` component, pre-filling the detected department and passing the file object.
   - If `category` is `TEMPLATE` or `COMPLIANCE`: The function returns a signal to the frontend with the recommended storage path (e.g., `global_documents/templates/{dept}/{filename}`).
5. **Admin Confirmation**: The UI presents the AI's decision to the admin (e.g., "AI rozpoznalo tento dokument jako Šablonu pro UPV. Souhlasíte?").
6. **Execution**: Upon confirmation, the final action is executed (saving to Firestore, executing the roster import, or uploading to Storage).

## 4. UI/UX Impact
- **Unified Upload Zone**: Replace the individual file inputs in each tab with a prominent, global drag-and-drop zone at the top of the Admin Document Center.
- **Keep Tabs for Viewing**: The existing tabs (AI Knowledge Base, Roster Import, Template Manager, Compliance Archive) should remain, but their primary purpose will shift from "uploading" to "viewing and managing" existing data.
- **AI Feedback & Confirmation Modal**: When a file is dropped, show a loading state ("🤖 AI analyzuje dokument..."). Once classified, present a clear, localized modal:
    - "✨ Zjistili jsme, že jde o **Metodiku (UPV)**."
    - "Chcete data vložit do AI Knowledge Base?"
    - Buttons: [Ano, vložit] [Ne, vybrat ručně]
- **Manual Override**: If the admin clicks "Ne, vybrat ručně", provide a simple dropdown menu to manually select the destination (Category and Department).

## 5. Risks & Fallbacks
- **Risk: Low Confidence / Misclassification**: Gemini might not accurately determine the category or department, especially for ambiguous documents.
  - **Fallback**: Enforce a confidence threshold (e.g., > 80%). If below, default to `UNKNOWN` and immediately prompt the admin to manually select the destination.
- **Risk: File Size Limits**: Very large PDFs or Excel files might hit Cloud Function payload limits or Gemini token limits.
  - **Fallback**: For text extraction, limit the parsed text to the first N characters (e.g., 30,000 as currently done). For Excel, only sample the header and first 5 rows.
- **Risk: Cost**: Routing every file through Gemini adds API costs.
  - **Mitigation**: Use `gemini-2.5-flash` for the initial fast routing classification, as it is cheaper and faster. Only use `gemini-2.5-pro` for the deep extraction of AI rules if classified as such.
