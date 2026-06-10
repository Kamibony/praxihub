# Manuální QA Runbook: UAT s rychlým přepínáním / Zastupováním (Impersonation)

Tento runbook vede testery Quality Assurance a User Acceptance Testing (UAT) skrze ověřování životních cyklů end-to-end (E2E) s využitím vestavěné funkce PraxiHub pro zastupování administrátorem (Admin Impersonation). To umožňuje rychlé testování víceuživatelských pracovních postupů bez nutnosti používat více prohlížečů nebo se přihlašovat a odhlašovat s různými přihlašovacími údaji.

## Předpoklady
1. Musíte být přihlášeni pomocí administrátorského účtu (`role: 'admin'`).
2. Seznamte se s **Impersonation Bannerem**: Při zastupování uživatele se v horní části obrazovky zobrazí banner. Zastupování můžete kdykoli ukončit kliknutím na tlačítko v tomto banneru.

---

## Scénář A: E2E životní cyklus UPV

Tento scénář ověřuje tok pro studenta s oborem **UPV**, od schválení organizace s automatickým přeskočením smlouvy rovnou k logování hodin, a nakonec k ověření mezd koordinátorem.

### Fáze 1: Student UPV - Žádost o organizaci

1. **Zahájit zastupování:**
   - Přejděte na seznam administrátorských uživatelů: `/admin/users`
   - Použijte vyhledávání nebo filtry k nalezení studenta s oborem **UPV**.
   - Klikněte na řádek studenta pro otevření CRM panelu na pravé straně.
   - Klikněte na tlačítko: **"Přihlásit se jako tento uživatel"**.

2. **Ověřit stav studenta:**
   - Měli byste být přesměrováni na Student Dashboard (`/student/dashboard`).
   - Podívejte se na Impersonation Banner v horní části pro potvrzení, že zastupujete.
   - **Ověření 1:** Zkontrolujte text se jménem studenta. Ujistěte se, že odpovídá vybranému studentovi. Očekávaný vizuální stav: Jméno studenta je zobrazeno bílým tučným písmem.
   - **Ověření 2:** Zkontrolujte odznak oboru. Musí zobrazovat **UPV**. Očekávaný vizuální stav: Modrý odznak s "UPV". *Záloha:* Pokud chybí, zobrazí se "Chybí obor".

3. **Zažádat o schválení organizace:**
   - Na domovské stránce vyplňte formulář "Vyberte organizaci" a odešlete žádost.
   - Systém přejde do stavu "Čeká se na schválení organizace" (PENDING_ORG_APPROVAL).

4. **Schválení organizace Koordinátorem:**
   - Otevřete nové okno (nebo dočasně ukončete zastupování) a jako Administrátor/Koordinátor přejděte na Dashboard.
   - Najděte žádost ve skupině zobrazení "Vyžaduje akci" (Action Required).
   - Najděte žádost studenta a schvalte ji.
   - **Klíčový krok:** Protože má student obor UPV, systém automaticky přeskočí proces podepisování smlouvy a přejde přímo do stavu "APPROVED" (Odblokování vykazování hodin).
   - Vraťte se k zastupování studenta na jeho Dashboard.

### Fáze 2: Vykazování hodin a schválení mentorem

Protože studenti oboru UPV nevyžadují smlouvu, modul pro vykazování hodin se odemkne okamžitě po schválení organizace.

1. **Vykázat hodiny (Student):**
   - Vraťte se na Student Dashboard (změňte roli zpět na studenta).
   - Ověřte, že modul pro vykazování hodin je k dispozici bez nutnosti nahrání smlouvy.
   - Použijte modul pro vykazování hodin na domovské stránce k zápisu požadovaných hodin.

2. **Schválit hodiny (Instituce):**
   - Zastupujte opět Instituci.
   - Na Institution Dashboard vyhledejte sekci "Čeká na schválení".
   - Schvalte hodiny vykázané studentem.

### Fáze 4: Koordinátor - Ověření mezd

1. **Změnit roli:**
   - Zastavte zastupování Instituce pomocí horního banneru kliknutím na **"Návrat do Adminu"**.
   - Jste zpět ve vaší administrátorské relaci. (Pokud chcete testovat specificky jako koordinátor, můžete zastupovat uživatele s rolí koordinátora, ale admini mají také přístup).

2. **Ověřit mzdy:**
   - Přejděte do modulu Mzdy: `/admin/payroll`.
   - **Ověření 1:** Najděte řádek pro instituci v tabulce mezd.
   - **Ověření 2:** Potvrďte shodu názvu instituce ve sloupci s názvem instituce.
   - **Ověření 3:** Zkontrolujte sloupec "Schválené hodiny (UPV)". Ověřte, že schválené hodiny přesně odpovídají dokončeným datům studenta UPV. Zajistěte, že dynamický výpočet (hodiny * sazba) odpovídá systémovým konfiguracím.

---

## Scénář B: E2E životní cyklus KPV

Tento scénář sleduje stejný cyklus ověřování, ale specificky se zaměřuje na studenta **KPV**. Všimněte si, že KPV odpovídá roli/misi "Odborný výcvik" (OV).

### Fáze 1: Student KPV - Generování smlouvy

1. **Zahájit zastupování:**
   - Přejděte na `/admin/users`.
   - Najděte studenta s oborem **KPV**.
   - Klikněte na jeho řádek a klikněte na **"Přihlásit se jako tento uživatel"**.

2. **Ověřit stav studenta:**
   - **Ověření 1:** Zkontrolujte jméno studenta.
   - **Ověření 2:** Zkontrolujte odznak oboru. **Klíčový rozdíl:** Zde musí být zobrazeno **KPV**.

3. **Zažádat o schválení organizace:**
   - Na domovské stránce vyplňte formulář "Vyberte organizaci" a odešlete žádost.
   - Díky Fast-Track ARES integraci by se organizace měla automaticky schválit (nebo přejde na manuální schválení, pokud ARES selže).

4. **Schválení organizace Koordinátorem (pokud ARES selhal):**
   - Pokud se žádost neschválila automaticky, ukončete zastupování, schvalte žádost jako administrátor a vraťte se k zastupování studenta.

5. **Generovat a nahrát smlouvu:**
   - Nyní by se na nástěnce studenta měla zobrazit sekce "Získat smlouvu".
   - Klikněte na tlačítko s nápisem "Generovat novou smlouvu" (nebo "+ Nová smlouva / Opravit" v hlavičce).
   - Dokončete průvodce smlouvou specifického pro KPV. *Poznámka: KPV smlouvy mohou mít odlišné podmínky nebo parametry hodnocení ve srovnání s UPV.*
   - Odešlete smlouvu. Ujistěte se, že se vygenerovalo a stáhlo PDF.
   - **Klíčový krok:** Student poté musí nahrát fyzicky/digitálně podepsanou kopii zpět na Dashboard prostřednictvím sekce pro nahrávání. Ujistěte se, že tato akce změní stav umístění na "ANALYZING" (Analyzuje se). *Při selhání:* Pokud nahrávání selže, pořiďte snímek obrazovky s chybou v konzoli (Network tab) a založte bug ticket na komponentu 'Generování smlouvy'.

### Fáze 2: Přiřazená instituce - Podpis smlouvy

1. **Změnit roli:**
   - Klikněte na **"Návrat do Adminu"**. Přejděte na `/admin/users` a zastupujte **Instituci** přiřazenou studentovi KPV.

2. **Ověřit přiřazení:**
   - Na Institution Dashboard (`/institution/dashboard`) najděte kartu přiřazeného studenta.
   - **Ověření 1:** Zkontrolujte jméno studenta.
   - **Ověření 2:** Zkontrolujte odznak oboru. Musí explicitně zobrazovat **KPV**.

3. **Podepsat smlouvu:**
   - Dokončete proces podpisu pro smlouvu KPV nahranou studentem. *Při selhání:* Pokud je tlačítko pro podpis neaktivní (disabled), ověřte, zda je smlouva skutečně ve stavu 'ANALYZING'. Pokud ano, založte bug ticket na Dashboard Instituce.

### Fáze 3: Vykazování hodin a schválení mentorem

1. **Vykázat hodiny (Student):**
   - Změňte roli zpět na studenta KPV.
   - Zapište požadované hodiny praxe pomocí modulu pro vykazování hodin na domovské stránce.

2. **Schválit hodiny (Instituce):**
   - Změňte roli zpět na Instituci.
   - Schvalte studentem vykázané hodiny v sekci "Čeká na schválení".

### Fáze 4: Koordinátor - Ověření mezd

1. **Změnit roli:**
   - Klikněte na **"Návrat do Adminu"**.

2. **Ověřit mzdová data:**
   - Přejděte na `/admin/payroll`.
   - Najděte řádek instituce v tabulce mezd.
   - **Klíčový rozdíl:** Na rozdíl od Scénáře A ověřte hodiny a výplaty specificky pro **kategorie KPV** ("Schválené hodiny (KPV)"). Ujistěte se, že časové záznamy KPV jsou správně kategorizovány a nepromítají se do výpočtů mezd UPV.

---

## Scénář C: Nové základní a systémové kontroly

Tato část pokrývá ověřování nových architektonických a designových realit platformy, včetně UI/UX, rozložení, ARES API, regresí a kritických pracovních postupů.

### 1. UX/UI & Design System (Konzistence Light Glassmorphism)
Aplikace se striktně drží filozofie 'Master Blueprint'. Zkontrolujte následující:
- **Kontrola globálního motivu:** Ověřte, že výchozí stav uživatelského rozhraní je světlý motiv (`bg-[#f8fafc]`) a využívá primární barvu značky Indigo/Violet (`brand-500: #6366f1`).
- **Prvky Glassmorphism:** Zkontrolujte hlavičkové prvky na přítomnost třídy `backdrop-blur-12px`.
- **Zapouzdření tmavého režimu:** Určitá modulární zobrazení jako `/student/dashboard` a `/admin/documents` jsou záměrně zapouzdřena jako tmavé motivy (např. `bg-slate-900/30`, `backdrop-blur-8px`, silně zaoblené modaly `rounded-[2.5rem]`). Zkontrolujte, zda styly starého tmavého režimu nepronikají do globálního světlého AppShellu.
- **Kontrola kontrastu:** Ověřte kontrast textu přes skleněné (glassmorphism) pozadí.
- **Akční tabulky:** Přejeďte myší přes řádky tabulky a potvrďte, že primární akční tlačítka se správně zobrazují při najetí myší (hover).

### 2. Omezení rozložení (Geometrie AppShell)
AppShell využívá dvousloupcové rozložení sestávající z pevného postranního panelu o šířce 300px a plynulé hlavní oblasti obsahu.
- **Žádné horizontální scrollování:** Ověřte, že napříč různými velikostmi obrazovky (Desktop, Tablet, Mobile) nedochází k žádnému horizontálnímu scrollování. Kořenový kontejner musí vynucovat `overflow-x-hidden` a obal plynulého hlavního obsahu musí používat `min-w-0 max-w-full overflow-hidden`.
- **Sbalení postranního panelu:** Na menších zařízeních ověřte, že se 300px pevný postranní panel správně skryje/sbalí do responzivního vzoru.

### 3. Integrace ARES API
Aplikace využívá REST API ARES k automatickému načítání detailů o instituci.
- **Test platného IČO:** Přejděte na formulář pro vytvoření/úpravu Instituce. Zadejte platné IČO (např. `00023337`). Formulář by měl automaticky vyplnit oficiální název, adresu a právní detaily instituce.
- **Test neplatného IČO:** Zadejte neplatné nebo neexistující IČO (např. `99999999`). Ověřte, že se zobrazí jasná chybová zpráva a systém nespadne ani částečně nevyplní nesprávná data.

### 4. Regresní kontroly
- **Globální dokumenty (Admin Dashboard):** Přejděte na Admin Dashboard. Ověřte, že starý modul "Globální dokumenty" ve webovém rozhraní zcela chybí. Administrátorské dokumenty jsou nyní uloženy výhradně pod `/global_documents/{category}/{dept}/{fileName}`.
- **Staré adresáře:** Ujistěte se, že neexistují žádné aktivní odkazy na zrušené kořenové složky jako `templates/`, `compliance/` nebo `methodologies/`.

### 5. Pracovní postupy registrace a onboardingu (KRITICKÉ)
Ověřte end-to-end scénáře vytváření uživatelů pro všechny hlavní role. Aplikace využívá Magic Links pro primární webovou autentizaci.

#### A. Cesty k samostatné registraci
1. **Registrace studenta:** Přejděte na `/signup` a vyberte roli Student. Dokončete formulář a ověřte, že je odeslán email s Magic Link. Klikněte na odkaz a ověřte, že vstoupíte do procesu `/onboarding`, kde vyberete svůj obor (UPV vs KPV) a dokončíte nastavení profilu.
2. **Registrace instituce:** Přejděte na `/signup` a vyberte roli Instituce. Dokončete formulář, potvrďte email a ověřte, že jste přesměrováni do specifického onboarding toku pro instituci pro zadání detailů jako kapacita a kritéria KRAU.

#### B. Cesty k vytvoření administrátorem
1. **Manuální vytvoření uživatele:** Jako Admin (`role: 'admin'`) přejděte na `/admin/users`.
2. **Pozvat uživatele:** Použijte administrátorský panel k manuálnímu pozvání/vytvoření nového účtu Koordinátora nebo Instituce. Ověřte, že uživatel obdrží pozvánku e-mailem a může si hladce nastavit svůj účet.

#### C. Ověření směrování rolí
Po dokončení onboardingu nebo přihlášení:
- **Role Student:** Ověřte úspěšné přesměrování na `/student/dashboard`. Zkontrolujte 3-stavový interaktivní semafor mapovaný na stav umístění.
- **Role Instituce:** Ověřte úspěšné přesměrování na `/institution/dashboard`.
- **Role Koordinátor/Admin:** Ověřte úspěšné přesměrování na `/admin/dashboard`.
