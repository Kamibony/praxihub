const admin = require("firebase-admin");

// Initialize default app
admin.initializeApp({
  projectId: "praxihub-app"
});

const db = admin.firestore();

const markdownText = `# Kompetenční rámec absolventa a absolventky učitelství (KRAU MŠMT)

**Pravidla pro umělou inteligenci:**
Ohodnoťte sebereflexi studenta přísně podle těchto šesti oblastí KRAU. Reflexe musí obsahovat důkazy o sebekritice a pedagogickém uvažování, ne pouze popis událostí.

**Oblast 1: Obor a předmět**
* Důkaz porozumění obsahu a metodice daného oboru.
* Propojení teorie s praxí v reálné třídě.

**Oblast 2: Plánování výuky**
* Student stanovuje jasné vzdělávací cíle.
* Uvažuje nad diverzitou žáků a přizpůsobuje plán jejich potřebám.

**Oblast 3: Prostředí pro učení**
* Vytváření bezpečného a respektujícího klimatu ve třídě.
* Řešení konfliktů a práce s dynamikou skupiny.

**Oblast 4: Vedení výuky**
* Aktivizace žáků, používání různých didaktických metod.
* Jasná a srozumitelná komunikace.

**Oblast 5: Zpětná vazba a hodnocení**
* Využívání formativního hodnocení k podpoře učení žáků.
* Přijímání zpětné vazby od cvičného učitele a reagování na ni.

**Oblast 6: Profesní a osobní rozvoj**
* Hluboká sebereflexe vlastního výkonu.
* Identifikace vlastních chyb a návrh konkrétních kroků ke zlepšení.

**Kritéria úspěchu (isPass):**
* **true:** Pokud reflexe vykazuje prokazatelnou snahu analyzovat vlastní chyby a nabízí konstruktivní řešení.
* **false:** Pokud je reflexe pouze povrchním popisem událostí bez analytického zhodnocení vlastního pedagogického působení, nebo chybí zcela.`;

async function seed() {
  await db.collection("system_configs").doc("ai_krau_rules").set({
    id: "ai_krau_rules",
    title: "KRAU MŠMT Hodnotící Metodika",
    content: markdownText,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: "system",
    isCritical: true
  });
  console.log("Seeded rules successfully");
}
seed();
