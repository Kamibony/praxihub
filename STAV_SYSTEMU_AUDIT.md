# AUDIT STAVU SYSTÉMU: Komplexní zpráva o stavu architektury a UX

**Datum:** 2025
**Vypracoval:** Vedoucí QA a Frontend Architekt
**Cíl dokumentu:** Objektivní zhodnocení aktuálního stavu refaktorizace frontendu (Fáze 1 a 2), identifikace technického dluhu a definice doporučených kroků pro následující sprint.

---

## 1. Manažerské shrnutí (Executive Summary)

Projekt PraxiHub prošel významnou fází transformace zaměřenou na modernizaci uživatelského rozhraní (UI) a konsolidaci datových toků. Cílem nedávných fází (Fáze 1 a 2) byla implementace "Master Blueprint" designu (světlý motiv, Glassmorphism, fixní postranní panel) a vyřešení kritických chyb v routování, zejména nekonečných přesměrování (tzv. "State Ghosting") během onboarding procesu studentů.

Aktuálně je systém ve stavu funkčního prototypu s implementovanými hlavními vizuálními změnami, avšak vykazuje značný technologický dluh na pomezí integrace starého a nového designového systému. Přechod na striktní "Single Source of Truth" (SSOT) v rámci autentizace a správy stavu uživatele (`AuthContext.tsx`) položil dobrý základ, ale povrchové vrstvy aplikace (jednotlivé moduly) stále nesou rezidua starého kódu, což negativně ovlivňuje konzistenci a robustnost aplikace. Zásadním rizikem je v současnosti nestabilita E2E testovacího frameworku (Playwright) v kombinaci s lokálními emulátory Firebase.

---

## 2. Co aktuálně funguje (Stable Features)

*   **Globální AppShell a Layout:** Nový hlavní wrapper (`AppShell.tsx`) integrující fixní 300px levý postranní panel a plynulý obsahový prostor (`flex-1`) s horní hlavičkou je plně funkční a implementovaný.
*   **Architektura autentizace (AuthContext):** Byl úspěšně zaveden globální `AuthContext`, který slučuje data z Firebase Auth a příslušných Firestore dokumentů. Tím byl vyřešen problém s "Ghostingem" stavů, který dříve způsoboval nekonečné cykly přesměrování mezi stránkami `/dashboard` a `/onboarding`.
*   **Designové Primitiva a Tailwind Konfigurace:** Základní kameny nového vizuálu (barvy `brand-500`, globální font Poppins, měkké modrošedé pozadí `#f8fafc`) jsou korektně nastaveny v `tailwind.config.js` a `globals.css`.
*   **Administrátorská Impersonace (Role-masking):** Zabezpečené maskování rolí přes Cloud Function `getImpersonationToken` a vizuální banner pro bezpečné opuštění relace (`ImpersonationBanner.tsx`) funguje spolehlivě a umožňuje bezpečné testování workflow.
*   **Pokročilé Moduly:** "Smart Uploader" s využitím Gemini AI pro kategorizaci dokumentů a "Live Tracker" (Náslechy) vykazují stabilitu a funkčnost dle specifikace.

---

## 3. Kritické chyby a technický dluh (What is Broken / Tech Debt)

Buďme k sobě brutálně upřímní, systém aktuálně trpí několika kritickými nedostatky, které brzdí další rozvoj:

*   **Rozbitý Testovací Framework (Playwright & Emulátory):** Architektura Playwright testů naráží na limity při startu Java-based Firebase emulátorů. "Osiřelé" procesy blokují porty (3000, 4000, 8080, atd.), což vede k nespolehlivému a "flaky" chování CI/CD pipelin. Skripty jako `run-tests.sh` a globální setup pro Playwright vyžadují robustnější health-checky a správu procesů.
*   **Neuzavřená Datová Normalizace:** Ačkoliv padlo rozhodnutí přejít na SSOT (Single Source of Truth), skript `integrity_auditor.js` stále není plně vymáhán. V UI komponentách (např. přístupy k datům v dashboardech) se mohou objevovat pozůstatky spoléhající na starou, denormalizovanou strukturu (např. redundantní čtení `major` vs. `studentMajor`).
*   **Geometrie a Flexbox Anomálie:** Vynucení dvoustloupcového layoutu (Master Blueprint) na některé starší, "monolitické" moduly způsobuje problémy s přetečením obsahu na ose X (horizontální scrollování). Kontejnerům chybí důsledné použití `min-w-0` a `overflow-hidden`.
*   **Zranitelnosti AI Modulů:** Podle auditu `AI_AGENT_AUDIT.md` přetrvávají rizika tzv. "prompt injection" (přímé zřetězení uživatelského vstupu do systémového promptu) a chybí "rate-limiting" pro API dotazy na Gemini. Stejně tak nejsou dostatečně ošetřeny chybové stavy při špatně formátovaném JSON výstupu z AI.
*   **Závislost na Mocks (ARES API):** Cloud Function `fetchAresAndLink` se stále spoléhá na testovací simulovaná data (mocks) místo produkčního volání reálného ARES REST API (`https://ares.gov.cz/...`).

---

## 4. Zhodnocení UX/UI a Konzistence (Design System Audit)

*   **Koexistence Světlého a Tmavého Motivu:** Aplikace momentálně balancuje na hraně. Zatímco globální AppShell a nové komponenty plně adoptovaly světlý Glassmorphism (`bg-[#f8fafc]`, čisté karty), specifické sekce (jako `StudentDashboard` nebo `Admin Document Center`) si drží původní tmavý motiv (`bg-slate-900`). Tento kontrast je matoucí a narušuje kognitivní tok uživatele.
*   **Glassmorphism vs. Čitelnost:** Extenzivní použití poloprůhledných komponent (`bg-white/85`, `backdrop-blur`) je sice vizuálně atraktivní, ale v místech s vysokou hustotou dat (tabulky, formuláře) snižuje čitelnost (kontrastní poměr).
*   **Zastaralé UX Vzory:** Systém stále používá dlouhé stránkující se formuláře. Implementace moderních principů, jako je "Progressive Disclosure" (postupné odkrývání informací) a kontextuální plovoucí tlačítka (FAB), je zatím jen v rovině návrhu (`UI_UX_Simplification_Proposal.md`). Tabulky nejsou plně transformovány do preferovaného "action-centric" a "row-as-a-card" vzoru.
*   **Kognitivní Zátěž:** Dashboardy zobrazují uživatelům příliš mnoho irelevantních možností najednou. Chybí jasné, dominantní CTA (Call to Action) tlačítko typu: *"Zde je jediná věc, kterou musíte nyní udělat."*

---

## 5. Doporučený postup (Actionable Next Steps)

Pro bezpečný posun do Fáze 7 a zajištění dlouhodobé stability systému doporučuji pro nejbližší sprinty stanovit tyto priority:

1.  **[KRITICKÉ] Stabilizace E2E Testování:** Přepsat `tests/global-setup.ts` tak, aby před startem testů agresivně čistil zablokované porty emulátorů. Znovu aktivovat Playwright testy naplno (odstranit `echo` mockování z `package.json`). *Žádný další vývoj nesmí pokračovat, dokud nebude CI/CD zelené.*
2.  **[VYSOKÁ PRIORITA] Sjednocení Vizuálu (Ústup od Dark Mode):** Dokončit migraci modulů jako je `StudentDashboard` z tmavého `bg-slate-900` do sjednoceného světlého AppShell standardu (`bg-[#f8fafc]`). Odstranit reziduální CSS třídy pro tmavý motiv tam, kde to není vysloveně nutné z důvodu accessibility.
3.  **[VYSOKÁ PRIORITA] Dokončení "Big Bang" Datové Migrace:** Spustit produkční čistku (odstranění UAT dat) a plně nasadit `integrity_auditor.js` do CI pipeliny, čímž se striktně vynutí SSOT architektura.
4.  **[STŘEDNÍ PRIORITA] Oprava Geometrie AppShellu:** Aplikovat pravidlo `min-w-0 max-w-full overflow-hidden` na flexibilní obsahový kontejner v `AppShell.tsx` a odstranit tak horizontální scrollování u širokých tabulek.
5.  **[STŘEDNÍ PRIORITA] Zapojení Produkčního ARES API:** Refaktorovat Cloud Function `fetchAresAndLink` a nahradit statická data reálným Axios voláním na vládní endpoint ARES.
6.  **[NIŽŠÍ PRIORITA] Zabezpečení AI:** Implementovat asanaci vstupů (stripping skrytých znaků) a rate-limiting nad Cloud Functions komunikujícími s modelem Gemini.

Teprve po prokazatelném vyřešení bodů 1, 2 a 3 bude architektura připravena na robustní implementaci nových funkcionalit (jako jsou E-Portfolia nebo Tripartitní digitální podpisy).
