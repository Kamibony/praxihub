# Centrum dokumentů administrátora

## Přehled
Centrum dokumentů je centrálním uzlem pro administrátory k řízení pravidel AI, importu seznamů studentů, správě šablon smluv a udržování archivů shody.

## 1. Chytré nahrávání a AI Router
Chytré nahrávání inteligentně směruje nahrané soubory do jejich správných cílů.

**Odolnost API (Ošetření 429 Errors):**
Funkce AI směrování používá Google Generative AI. Pokud API vrátí HTTP 429 stavový kód nebo zprávu o vyčerpání kvóty, systém ji elegantně odchytí a vyhodí `functions.https.HttpsError('resource-exhausted', ...)`. Frontend tuto chybu zachytí a zobrazí uživatelsky přívětivou toast zprávu: "Omlouváme se, ale AI služby jsou momentálně přetížené (byl vyčerpán limit požadavků). Zkuste to prosím znovu za chvíli.". Toto zabraňuje neošetřeným výjimkám a nekonečným opakovaným pokusům.

## 2. AI Knowledge Base
Administrátoři mohou aktualizovat kritéria pro hodnocení AI pro UPV a KPV. Tato sekce umožňuje aktualizaci pravidel (úryvků), která vedou AI při hodnocení reflexí a dalších odevzdaných prací studentů.

## 3. Roster Import
Administrátoři mohou hromadně importovat seznamy studentů přes CSV.

**Integrita dat (Pravidla stavového automatu):**
Během Roster Import systém přísně uplatňuje Pravidla stavového automatu. Aby se předešlo stavům "Ghost" (uživatelé existující bez správného kontextu pracovního postupu), proces importu povinně přiřazuje nároky `UPV` nebo `KPV` na základě kontextu importu. To zajišťuje, že každý importovaný uživatel je správně nasměrován na onboarding a dashboard odpovídajícího oboru.

## 4. Template Manager
Spravuje šablony dokumentů (např. smlouvy) používané napříč platformou.

**Stavové závislosti (Generování smluv):**
UI a byznys logika uplatňují přísné stavové závislosti. Generování smlouvy může nastat pouze tehdy, když je stáž ve stavu `ORG_APPROVED`. UI podmíněně vykresluje odkazy/tlačítka pro generování na základě tohoto předpokladu a backend tento stav ověřuje před povolením zpracování šablony.

## 5. Compliance Archive
Bezpečné úložiště pro ukládání a načítání dokumentů o shodě. Dokumenty nahrané sem slouží čistě pro archivační účely a NEJSOU analyzovány umělou inteligencí. Pro úpravu pravidel hodnocení přejděte na záložku "AI Knowledge Base".
