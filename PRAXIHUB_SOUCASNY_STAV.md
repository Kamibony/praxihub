# PraxiHub: Současný Technický a Funkční Stav (As-Built)

Tento dokument slouží jako přesný a aktuální přehled reálného stavu platformy PraxiHub. Je určen pro pedagogické garanty a klíčové partnery, aby pochopili, jak systém aktuálně funguje a jak bezpečně zpracovává data, a to na základě skutečného implementovaného kódu.

## 1. Úvod a Architektura

Platforma PraxiHub je postavena na moderní "Serverless" architektuře využívající služby Firebase (Google) a Next.js. Z hlediska bezpečnosti a konzistence dat stojí na dvou klíčových pilířích:

*   **Single Source of Truth (SSOT) - Jediný zdroj pravdy:** Systém je navržen tak, aby se klíčová data (jako je jméno, e-mail nebo studijní obor) ukládala pouze na jednom místě (v profilu uživatele). Pokud systém generuje smlouvu nebo hodnocení, vždy si tato data dynamicky "natáhne" z tohoto jediného zdroje. Tím se zcela eliminuje riziko, že by na smlouvě bylo jiné jméno než v systému. Integritu těchto dat navíc neustále hlídají automatizované kontrolní skripty.
*   **Zero-Trust Bezpečnost (Nulová důvěra):** Systém nevěří ničemu, co pošle uživatel z webového prohlížeče. Každá akce (např. schválení praxe, nahrání dokumentu) je přísně kontrolována přímo na serveru pomocí tzv. Custom Claims (ověřené role skryté uvnitř bezpečnostního klíče uživatele). Běžný student nebo instituce tak nemůže nijak "podvrhnout" svá oprávnění ani získat přístup k datům ostatních.

Systém využívá bezheslové přihlašování (Magic Links), kdy uživateli přijde odkaz na e-mail. Tím odpadá nutnost pamatovat si hesla a zvyšuje se bezpečnost.

## 2. Uživatelské Role a Oprávnění

Přístup do systému je přísně rozdělen podle rolí, které jsou ověřovány na úrovni databáze (RBAC):

*   **Student (UPV vs. KPV):**
    *   Může si spravovat profil, hledat praxe, zaznamenávat si odpracované hodiny a psát reflexe.
    *   Systém striktně rozlišuje studenty oboru **UPV** (Učitelství) a **KPV** (Odborný výcvik / Klinická pedagogická praxe). Tato volba je povinná hned při registraci a kompletně mění chování systému (jaké smlouvy se generují, jak probíhá hodnocení a párování).
*   **Instituce (Školy, Mentoři, Firmy):**
    *   Mají sjednocený portál. Vidí pouze studenty, kteří k nim byli přiřazeni, a mohou jim schvalovat odpracované hodiny (výkazy).
    *   Podléhají pětiletému cyklu schvalování smluv o spolupráci (GDPR compliance).
*   **Koordinátor / Admin (Správci systému a fakulty):**
    *   Mají globální přehled nad celým systémem.
    *   Vidí tzv. Exception Dashboard (nástěnku výjimek), kde je systém upozorňuje na problémové stavy (např. praxe visící měsíc bez schválení, vypršené smlouvy škol).
    *   Mohou využít funkci "Impersonation" (převtělení), která jim umožňuje přihlásit se pohledem konkrétního studenta (např. pro rychlé vyřešení technického problému), aniž by potřebovali jeho heslo.

## 3. Klíčové Funkcionality (Features)

Systém aktuálně disponuje následujícími funkčními moduly:

*   **Chytré Párování (Matchmaking):** Databáze nejdříve předvybere vhodné instituce podle oboru studenta (UPV/KPV) a lokality. Následně AI model (Gemini) seřadí tyto školy a vygeneruje srozumitelné odůvodnění, proč je daná škola pro studenta vhodná.
*   **Generování Smluv a Tripartitní Podpisy:**
    *   Systém dynamicky generuje PDF smlouvy z dat uživatelů a škol.
    *   Aplikuje se přísné pravidlo "WORM" (Write-Once-Read-Many). Jakmile je smlouva všemi třemi stranami (Student, Škola, Fakulta) podepsána a uložena, databáze ji kryptograficky uzamkne a **nelze** ji už nijak změnit ani smazat. Každý podpis zanechává nevratnou auditní stopu.
*   **Mzdové výkazy (Payroll):**
    *   Systém automatizuje výpočet odměn pro mentory. Správce v sekci `admin/payroll` na jedno kliknutí vynásobí schválené hodiny studentů s hodinovými sazbami (které se načítají z nastavení systému).
    *   Výsledky se seskupují podle institucí a dají se okamžitě exportovat do CSV formátu pro potřeby účetního oddělení univerzity.
*   **Moduly Náslechy a Výstupy:**
    *   **Náslechy:** Interaktivní "stopky" přímo v aplikaci, kde si student během výuky měří, jak dlouho mluví učitel a jak dlouho studenti.
    *   **Výstupy:** Hodnotící matice (dle oficiálních kritérií MŠMT KRAU), které se automaticky ukládají bez přetěžování sítě.
*   **AI Reflexe a Hlasový Deník:**
    *   Studenti mohou své reflexe z praxe diktovat pomocí hlasu (přes prohlížeč).
    *   AI systém (Gemini) tyto texty zkontroluje podle rubrik KRAU a pomůže s gramatikou a formátováním. AI výstupy jsou striktně formátovány (JSON) pro stabilitu aplikace.
*   **Rychlé UI a Skeletony:**
    *   Uživatelské rozhraní je navrženo pro maximální rychlost. Při načítání dat z databáze uživatel vidí tzv. "Skeletony" (šedé obrysy prvků), které nekazí plynulost aplikace.
    *   Obsahuje temný a světlý režim, který neproblikává, a globální vyhledávací příkazovou řádku (Command Palette) pro administrátory.
*   **Zpracování Dokumentů a Menovací Dekrety:**
    *   Chytrý nahrávač na pozadí pomocí AI roztřídí nahrané smlouvy a dokumenty. Pokud si AI není jistá na více než 80 %, vždy požádá člověka o kontrolu.
    *   Pro 3. ročníky (UPV) umí systém vygenerovat PDF "Menovací dekrét" pro státní zkoušky na základě přiřazených komisí.

## 4. Mobilní Aplikace

Součástí platformy je i základní mobilní aplikace vytvořená v technologiích Expo a React Native.
*   Na rozdíl od webu (Magic Links) využívá klasické přihlašování jménem a heslem (z důvodu technických omezení tzv. deep-linkingu).
*   Přihlašovací údaje jsou bezpečně uchovávány přímo v šifrovaném úložišti telefonu (SecureStore).
*   Hlavním účelem aplikace je umožnit studentům vyfotit a bezpečně nahrát fyzické dokumenty rovnou do systému (volají se stejné zabezpečené funkce jako na webu, aplikace nekomunikuje s databází napřímo).

## 5. Testování a Stabilita

Systém je robustní a je neustále monitorován pro zajištění kvality a bezpečnosti dat:
*   **Automatizované E2E Testy (Playwright):** Aplikace má napsané end-to-end testy. Simulují průchod reálného uživatele prohlížečem, klikání na tlačítka a kontrolují, zda nedošlo k rozbití funkcionality po úpravě kódu. Systém nahrává videa z těchto testů pro snadnější hledání chyb.
*   **Integritní Auditoři:** Na pozadí (nebo manuálně administrátorem) běží Node.js skripty (např. `integrity_auditor.js`), které procházejí celou databázi a kontrolují, zda nejsou nějaká data osiřelá, či zda nebylo porušeno pravidlo Jediného zdroje pravdy (SSOT).
*   **UAT Gates (Skrývání novinek):** Jakákoliv nová funkce, která ještě nebyla schválena klientem, je obalena do speciálního "neviditelného pláště" (`<UatGate>`) a do produkční verze se pro běžné uživatele nedostane, dokud ji administrátor nezapne.
