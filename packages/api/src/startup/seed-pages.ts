import { eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { createPage, isPageSlugTaken } from "@norish/db/repositories/pages";
import { getServerOwnerId } from "@norish/db/repositories/users";
import { serverConfig } from "@norish/db/schema";
import { invalidatePublishedPageSlugs } from "@norish/shared-server/cache/pages";
import { serverLogger } from "@norish/shared-server/logger";
import { LEGAL_VERSION } from "@norish/shared/lib/legal";

/**
 * Migrate the formerly-hardcoded About / Terms / Privacy routes into the custom
 * pages CMS. On first boot after the migration each is created as a published
 * page at its existing root URL (/about, /terms, /privacy), so the links in the
 * footer and sign-up form keep working — now served by the CMS and editable in
 * the admin Pages card.
 *
 * Idempotent: a slug that already exists (seeded here before, or created by an
 * admin) is left untouched, so this never clobbers edited content. Single
 * language (Slovak) by design — the CMS is single-language; the admin can edit
 * or translate afterwards.
 */

const ABOUT_META =
  "Naša Kuchyňa je komunitná platforma na objavovanie, zdieľanie a plánovanie domácich receptov.";

/** Shipped Slovak About copy — the fallback when nothing was ever set. */
const DEFAULT_ABOUT_TITLE = "O nás";
const DEFAULT_ABOUT_BODY = `Naša Kuchyňa je komunitná platforma na objavovanie, zdieľanie a plánovanie domácich receptov. Chceme, aby mali slovenské recepty pekné a prehľadné miesto, kde je jedlo vždy na dosah — a kde varenie spája.

## Prečo Naša Kuchyňa

Dobré recepty často zapadnú v záplave príspevkov na sociálnych sieťach alebo sa stratia v papierových zošitoch. Naša Kuchyňa ich dáva na jedno miesto: objavuj recepty podľa kategórie, kuchyne či tém, plánuj jedlá, tvor nákupné zoznamy a var spolu s domácnosťou.

Zakladáme si na skutočných domácich receptoch od komunity a na tom, aby bol obsah prehľadný a rešpektoval práva autorov.

## Kto za tým stojí

Naša Kuchyňa je projekt spoločnosti Spertulo s. r. o.

## Napíšte nám

Máte otázku, nápad alebo spätnú väzbu? Ozvite sa nám na [kontakt@nasakuchyna.sk].`;

const UPDATED_LABEL = `_Naposledy aktualizované: ${LEGAL_VERSION}_`;

const TERMS_BODY = `Tieto podmienky používania upravujú používanie služby Naša Kuchyňa („služba“), ktorú prevádzkuje [Prevádzkovateľ / Operator]. Vytvorením účtu alebo používaním služby s týmito podmienkami súhlasíte.

${UPDATED_LABEL}

## 1. Účet

Na používanie väčšiny funkcií potrebujete účet. Zodpovedáte za zachovanie dôvernosti svojich prihlasovacích údajov a za všetku aktivitu na svojom účte. Musíte mať aspoň 16 rokov, prípadne súhlas zákonného zástupcu.

## 2. Váš obsah a licencia

Vlastníctvo obsahu, ktorý pridáte (recepty, fotografie, texty, komentáre), zostáva vám.

Pridaním obsahu udeľujete prevádzkovateľovi nevýhradnú, celosvetovú, bezodplatnú a sublicencovateľnú licenciu na jeho hosťovanie, ukladanie, reprodukciu, úpravu potrebnú na zobrazenie, verejné zobrazenie a šírenie v rozsahu potrebnom na prevádzku a propagáciu služby (napr. zobrazenie vo verejnom objavovaní, náhľady pri zdieľaní, vyhľadávanie). Licencia trvá, kým obsah v službe ponechávate; po jeho odstránení sa v primeranom čase prestane používať (okrem záloh a už zdieľaných kópií).

Za obsah, ktorý zverejníte, zodpovedáte vy a vyhlasujete, že naň máte potrebné práva.

## 3. Importované a cudzie recepty

Import receptu z externého zdroja do súkromnej knižnice je určený na osobné použitie. Zverejniť importovaný recept smiete len vtedy, ak ide o vašu vlastnú úpravu alebo na jeho zverejnenie máte právo — najmä fotografie a autorské texty zdroja môžu podliehať autorským právam tretích strán.

Nezverejňujte obsah, ktorý porušuje práva iných. Na základe oznámenia o porušení práv môžeme obsah odstrániť a opakovaným porušovateľom zrušiť účet.

## 4. Pravidlá používania

Službu nesmiete zneužívať: nahrávať nezákonný, škodlivý alebo zavádzajúci obsah, obchádzať zabezpečenie, automatizovane sťahovať údaje bez súhlasu ani zasahovať do jej prevádzky.

## 5. Zrušenie

Svoj účet môžete kedykoľvek zrušiť. Pri porušení týchto podmienok môžeme prístup pozastaviť alebo ukončiť.

## 6. Bez záruk a obmedzenie zodpovednosti

Služba sa poskytuje „tak, ako je“, bez záruk. V rozsahu povolenom právom prevádzkovateľ nezodpovedá za nepriame či následné škody vzniknuté používaním služby. Recepty, výživové a alergénové údaje sú orientačné; overte si ich, najmä pri zdravotných obmedzeniach.

## 7. Zmeny a rozhodné právo

Tieto podmienky môžeme aktualizovať; na podstatné zmeny upozorníme a označíme ich novou verziou. Riadia sa právom Slovenskej republiky.

## 8. Kontakt

Otázky k týmto podmienkam: [kontakt@nasakuchyna.sk].`;

const PRIVACY_BODY = `Tieto zásady opisujú, aké osobné údaje služba Naša Kuchyňa spracúva a ako. Prevádzkovateľom je [Prevádzkovateľ / Operator].

${UPDATED_LABEL}

## 1. Aké údaje spracúvame

Údaje účtu (e-mail — uložený šifrovane, meno, prihlasovacie údaje), obsah, ktorý vytvoríte (recepty, fotografie, komentáre), a technické údaje o používaní. Analytika je cookieless (Plausible) a nevytvára profil jednotlivca.

## 2. Na čo údaje používame

Na poskytovanie a zabezpečenie služby, zobrazovanie vášho obsahu podľa zvolenej viditeľnosti, zlepšovanie funkcií a komunikáciu k službe. Súbory cookie používame na prihlásenie a základnú funkčnosť.

## 3. Sprostredkovatelia

Na prevádzku využívame poskytovateľov: hosting a úložisko (vrátane objektového úložiska pre médiá), Voyage AI na výpočet vektorov pre sémantické objavovanie, Plausible na anonymnú analytiku a e-mailového poskytovateľa na systémové e-maily (napr. pozvánky). Zdieľame len údaje nevyhnutné pre danú službu.

## 4. Vaše práva (GDPR)

Máte právo na prístup k svojim údajom, ich opravu, vymazanie, prenosnosť a namietanie proti spracúvaniu. Účet a jeho obsah môžete vymazať; na uplatnenie práv nás kontaktujte.

## 5. Uchovávanie

Údaje uchovávame, kým máte účet, a následne ich v primeranom čase odstránime, okrem prípadov, keď je uchovávanie potrebné zo zákona.

## 6. Kontakt

Otázky k ochrane súkromia: [kontakt@nasakuchyna.sk].`;

type SeedPage = { slug: string; title: string; body: string; metaDescription: string };

/** Read the previously admin-editable About copy (Slovak), if it was ever set. */
async function loadStoredAbout(): Promise<{ title: string; body: string }> {
  try {
    const row = await db.query.serverConfig.findFirst({
      where: eq(serverConfig.key, "about_content"),
    });

    const sk = (row?.value as { sk?: { title?: string; body?: string } } | null)?.sk;

    if (sk?.title && sk?.body) {
      return { title: sk.title, body: sk.body };
    }
  } catch (err) {
    serverLogger.warn({ err }, "Could not read stored About content; using default");
  }

  return { title: DEFAULT_ABOUT_TITLE, body: DEFAULT_ABOUT_BODY };
}

export async function seedStaticPages(): Promise<void> {
  const about = await loadStoredAbout();

  const seeds: SeedPage[] = [
    { slug: "about", title: about.title, body: about.body, metaDescription: ABOUT_META },
    {
      slug: "terms",
      title: "Podmienky používania",
      body: TERMS_BODY,
      metaDescription: "Podmienky používania služby Naša Kuchyňa.",
    },
    {
      slug: "privacy",
      title: "Zásady ochrany súkromia",
      body: PRIVACY_BODY,
      metaDescription: "Ako Naša Kuchyňa spracúva osobné údaje a vaše práva podľa GDPR.",
    },
  ];

  const ownerId = await getServerOwnerId();
  let created = 0;

  for (const seed of seeds) {
    if (await isPageSlugTaken(seed.slug)) {
      continue;
    }

    await createPage(
      {
        slug: seed.slug,
        title: seed.title,
        body: seed.body,
        metaDescription: seed.metaDescription,
        status: "published",
      },
      ownerId
    );
    created++;
    serverLogger.info({ slug: seed.slug }, "Seeded static page into the CMS");
  }

  if (created > 0) {
    await invalidatePublishedPageSlugs();
    serverLogger.info({ count: created }, "Migrated static pages into the CMS");
  }
}
