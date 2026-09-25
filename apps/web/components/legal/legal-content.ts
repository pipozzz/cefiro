import { LEGAL_VERSION } from "@norish/shared/lib/legal";

/**
 * Terms of Service and Privacy Policy content, in Slovak and English.
 *
 * DRAFT — starting text, NOT legal advice. Have a lawyer review before launch
 * and replace the [BRACKETED] placeholders (operator identity, contact email,
 * governing-law specifics). `sk` is served on the Slovak locale; every other
 * locale falls back to `en`.
 */

export interface LegalSection {
  heading: string;
  /** Paragraphs; each renders as its own <p>. */
  body: string[];
}

export interface LegalDocument {
  title: string;
  updatedLabel: string;
  /** ISO date the version corresponds to. */
  version: string;
  intro: string[];
  sections: LegalSection[];
}

const OPERATOR = "[Prevádzkovateľ / Operator]";
const CONTACT = "[kontakt@nasakuchyna.sk]";

export const TERMS: Record<"sk" | "en", LegalDocument> = {
  sk: {
    title: "Podmienky používania",
    updatedLabel: "Naposledy aktualizované",
    version: LEGAL_VERSION,
    intro: [
      `Tieto podmienky používania upravujú používanie služby Naša Kuchyňa („služba“), ktorú prevádzkuje ${OPERATOR}. Vytvorením účtu alebo používaním služby s týmito podmienkami súhlasíte.`,
    ],
    sections: [
      {
        heading: "1. Účet",
        body: [
          "Na používanie väčšiny funkcií potrebujete účet. Zodpovedáte za zachovanie dôvernosti svojich prihlasovacích údajov a za všetku aktivitu na svojom účte. Musíte mať aspoň 16 rokov, prípadne súhlas zákonného zástupcu.",
        ],
      },
      {
        heading: "2. Váš obsah a licencia",
        body: [
          "Vlastníctvo obsahu, ktorý pridáte (recepty, fotografie, texty, komentáre), zostáva vám.",
          "Pridaním obsahu udeľujete prevádzkovateľovi nevýhradnú, celosvetovú, bezodplatnú a sublicencovateľnú licenciu na jeho hosťovanie, ukladanie, reprodukciu, úpravu potrebnú na zobrazenie, verejné zobrazenie a šírenie v rozsahu potrebnom na prevádzku a propagáciu služby (napr. zobrazenie vo verejnom objavovaní, náhľady pri zdieľaní, vyhľadávanie). Licencia trvá, kým obsah v službe ponechávate; po jeho odstránení sa v primeranom čase prestane používať (okrem záloh a už zdieľaných kópií).",
          "Za obsah, ktorý zverejníte, zodpovedáte vy a vyhlasujete, že naň máte potrebné práva.",
        ],
      },
      {
        heading: "3. Importované a cudzie recepty",
        body: [
          "Import receptu z externého zdroja do súkromnej knižnice je určený na osobné použitie. Zverejniť importovaný recept smiete len vtedy, ak ide o vašu vlastnú úpravu alebo na jeho zverejnenie máte právo — najmä fotografie a autorské texty zdroja môžu podliehať autorským právam tretích strán.",
          "Nezverejňujte obsah, ktorý porušuje práva iných. Na základe oznámenia o porušení práv môžeme obsah odstrániť a opakovaným porušovateľom zrušiť účet.",
        ],
      },
      {
        heading: "4. Pravidlá používania",
        body: [
          "Službu nesmiete zneužívať: nahrávať nezákonný, škodlivý alebo zavádzajúci obsah, obchádzať zabezpečenie, automatizovane sťahovať údaje bez súhlasu ani zasahovať do jej prevádzky.",
        ],
      },
      {
        heading: "5. Zrušenie",
        body: [
          "Svoj účet môžete kedykoľvek zrušiť. Pri porušení týchto podmienok môžeme prístup pozastaviť alebo ukončiť.",
        ],
      },
      {
        heading: "6. Bez záruk a obmedzenie zodpovednosti",
        body: [
          "Služba sa poskytuje „tak, ako je“, bez záruk. V rozsahu povolenom právom prevádzkovateľ nezodpovedá za nepriame či následné škody vzniknuté používaním služby. Recepty, výživové a alergénové údaje sú orientačné; overte si ich, najmä pri zdravotných obmedzeniach.",
        ],
      },
      {
        heading: "7. Zmeny a rozhodné právo",
        body: [
          "Tieto podmienky môžeme aktualizovať; na podstatné zmeny upozorníme a označíme ich novou verziou. Riadia sa právom Slovenskej republiky.",
        ],
      },
      {
        heading: "8. Kontakt",
        body: [`Otázky k týmto podmienkam: ${CONTACT}.`],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updatedLabel: "Last updated",
    version: LEGAL_VERSION,
    intro: [
      `These Terms govern your use of Naša Kuchyňa (the “Service”), operated by ${OPERATOR}. By creating an account or using the Service you agree to these Terms.`,
    ],
    sections: [
      {
        heading: "1. Your account",
        body: [
          "You need an account for most features. You are responsible for keeping your credentials confidential and for activity on your account. You must be at least 16, or have a guardian’s consent.",
        ],
      },
      {
        heading: "2. Your content and the licence you grant",
        body: [
          "You keep ownership of the content you add (recipes, photos, text, comments).",
          "By adding content you grant the operator a non-exclusive, worldwide, royalty-free, sublicensable licence to host, store, reproduce, make display-necessary adaptations of, publicly display and distribute it as needed to run and promote the Service (e.g. public discovery, share previews, search). The licence lasts while you keep the content on the Service; after you delete it, use stops within a reasonable time (excluding backups and copies already shared).",
          "You are responsible for the content you publish and confirm you have the rights to it.",
        ],
      },
      {
        heading: "3. Imported and third-party recipes",
        body: [
          "Importing a recipe from an external source into your private library is for personal use. You may publish an imported recipe only if it is your own adaptation or you otherwise have the right to — the source’s photos and written text in particular may be protected by third-party copyright.",
          "Do not publish content that infringes others’ rights. We may remove content on a valid infringement notice and terminate repeat infringers.",
        ],
      },
      {
        heading: "4. Acceptable use",
        body: [
          "Don’t misuse the Service: no unlawful, harmful or misleading content, no bypassing security, no automated scraping without permission, and no interfering with its operation.",
        ],
      },
      {
        heading: "5. Termination",
        body: [
          "You may delete your account at any time. We may suspend or terminate access for breach of these Terms.",
        ],
      },
      {
        heading: "6. No warranty and limitation of liability",
        body: [
          "The Service is provided “as is”, without warranties. To the extent permitted by law, the operator is not liable for indirect or consequential damages arising from your use. Recipes and nutrition/allergen data are indicative; verify them, especially for health needs.",
        ],
      },
      {
        heading: "7. Changes and governing law",
        body: [
          "We may update these Terms; we’ll flag material changes and mark them with a new version. They are governed by the laws of the Slovak Republic.",
        ],
      },
      {
        heading: "8. Contact",
        body: [`Questions about these Terms: ${CONTACT}.`],
      },
    ],
  },
};

export const PRIVACY: Record<"sk" | "en", LegalDocument> = {
  sk: {
    title: "Zásady ochrany súkromia",
    updatedLabel: "Naposledy aktualizované",
    version: LEGAL_VERSION,
    intro: [
      `Tieto zásady opisujú, aké osobné údaje služba Naša Kuchyňa spracúva a ako. Prevádzkovateľom je ${OPERATOR}.`,
    ],
    sections: [
      {
        heading: "1. Aké údaje spracúvame",
        body: [
          "Údaje účtu (e-mail — uložený šifrovane, meno, prihlasovacie údaje), obsah, ktorý vytvoríte (recepty, fotografie, komentáre), a technické údaje o používaní. Analytika je cookieless (Plausible) a nevytvára profil jednotlivca.",
        ],
      },
      {
        heading: "2. Na čo údaje používame",
        body: [
          "Na poskytovanie a zabezpečenie služby, zobrazovanie vášho obsahu podľa zvolenej viditeľnosti, zlepšovanie funkcií a komunikáciu k službe. Súbory cookie používame na prihlásenie a základnú funkčnosť.",
        ],
      },
      {
        heading: "3. Sprostredkovatelia",
        body: [
          "Na prevádzku využívame poskytovateľov: hosting a úložisko (vrátane objektového úložiska pre médiá), Voyage AI na výpočet vektorov pre sémantické objavovanie, Plausible na anonymnú analytiku a e-mailového poskytovateľa na systémové e-maily (napr. pozvánky). Zdieľame len údaje nevyhnutné pre danú službu.",
        ],
      },
      {
        heading: "4. Vaše práva (GDPR)",
        body: [
          "Máte právo na prístup k svojim údajom, ich opravu, vymazanie, prenosnosť a namietanie proti spracúvaniu. Účet a jeho obsah môžete vymazať; na uplatnenie práv nás kontaktujte.",
        ],
      },
      {
        heading: "5. Uchovávanie",
        body: [
          "Údaje uchovávame, kým máte účet, a následne ich v primeranom čase odstránime, okrem prípadov, keď je uchovávanie potrebné zo zákona.",
        ],
      },
      {
        heading: "6. Kontakt",
        body: [`Otázky k ochrane súkromia: ${CONTACT}.`],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updatedLabel: "Last updated",
    version: LEGAL_VERSION,
    intro: [
      `This policy describes what personal data Naša Kuchyňa processes and how. The operator is ${OPERATOR}.`,
    ],
    sections: [
      {
        heading: "1. What we process",
        body: [
          "Account data (email — stored encrypted, name, credentials), the content you create (recipes, photos, comments), and technical usage data. Analytics are cookieless (Plausible) and do not build an individual profile.",
        ],
      },
      {
        heading: "2. How we use it",
        body: [
          "To provide and secure the Service, display your content at your chosen visibility, improve features, and send you service communications. We use cookies for sign-in and core functionality.",
        ],
      },
      {
        heading: "3. Processors",
        body: [
          "We rely on providers to run the Service: hosting and storage (including object storage for media), Voyage AI to compute vectors for semantic discovery, Plausible for anonymous analytics, and an email provider for system email (e.g. invites). We share only the data each service needs.",
        ],
      },
      {
        heading: "4. Your rights (GDPR)",
        body: [
          "You have the right to access, rectify, erase, port and object to the processing of your data. You can delete your account and its content; contact us to exercise your rights.",
        ],
      },
      {
        heading: "5. Retention",
        body: [
          "We keep your data while you have an account and delete it within a reasonable time afterwards, except where retention is required by law.",
        ],
      },
      {
        heading: "6. Contact",
        body: [`Privacy questions: ${CONTACT}.`],
      },
    ],
  },
};
