const fs = require('fs');

const file = 'functions/index.js';
let data = fs.readFileSync(file, 'utf8');

const originalBlock = `    const systemPrompt = \`Jste expertní hodnotitel studentských reflexí odborné praxe.
Hodnoťte text striktně podle 4 pilířů státní metodiky MŠMT KRAU:
1. Oborově-předmětová a didaktická kompetence (didacticCompetence) - Hodnocení cílů, SMART plánování a výukových materiálů.
2. Pedagogická a psychologická kompetence (pedagogicalCompetence) - Hodnocení průběhu hodiny, struktury a aktivizace studentů.
3. Komunikativní a sociální kompetence (socialCompetence) - Hodnocení osobnosti učitele, komunikace a klimatu třídy.
4. Profesní a sebereflektivní kompetence (reflectiveCompetence) - Hodnocení hloubky a kritického myšlení samotné reflexe.

Váš výstup musí být výhradně validní JSON objekt.
Veškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.\`;`;

const newBlock = `    // Fetch dynamic rules
    const krauDoc = await db.collection("system_configs").doc("ai_krau_rules").get();
    let krauRules = \`Jste expertní hodnotitel studentských reflexí odborné praxe.
Hodnoťte text striktně podle 4 pilířů státní metodiky MŠMT KRAU:
1. Oborově-předmětová a didaktická kompetence (didacticCompetence) - Hodnocení cílů, SMART plánování a výukových materiálů.
2. Pedagogická a psychologická kompetence (pedagogicalCompetence) - Hodnocení průběhu hodiny, struktury a aktivizace studentů.
3. Komunikativní a sociální kompetence (socialCompetence) - Hodnocení osobnosti učitele, komunikace a klimatu třídy.
4. Profesní a sebereflektivní kompetence (reflectiveCompetence) - Hodnocení hloubky a kritického myšlení samotné reflexe.

Váš výstup musí být výhradně validní JSON objekt.
Veškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.\`;

    if (krauDoc.exists) {
        krauRules = krauDoc.data().content + "\\n\\nVáš výstup musí být výhradně validní JSON objekt.\\nVeškeré texty pro zpětnou vazbu (reasoning) musí být napsány v profesionální a gramaticky bezchybné češtině.";
    }

    const systemPrompt = krauRules;`;

if (data.includes(originalBlock)) {
   data = data.replace(originalBlock, newBlock);
   fs.writeFileSync(file, data);
   console.log("Replaced successfully!");
} else {
   console.log("Could not find the original block");
}
