/**
 * "About" page content, in Slovak and English (`sk` on the Slovak locale, every
 * other locale falls back to `en`) — same lightweight approach as the legal
 * pages.
 *
 * DRAFT: the mission copy is generic and safe to ship, but the [BRACKETED]
 * placeholders are real facts only the operator can supply — who is behind the
 * project and the contact address. Replace them before relying on this for
 * E-A-T; leaving a bracket visible is intentional so it is not forgotten.
 */

export interface AboutSection {
  heading: string;
  /** Paragraphs; each renders as its own <p>. */
  body: string[];
}

export interface AboutDocument {
  title: string;
  intro: string[];
  sections: AboutSection[];
}

const OPERATOR_SK = "Naša Kuchyňa je projekt spoločnosti Spertulo s. r. o.";
const OPERATOR_EN = "Naša Kuchyňa is a project by Spertulo s. r. o.";
// Contact address still to confirm before launch.
const CONTACT = "[kontakt@nasakuchyna.sk]";

export const ABOUT: Record<"sk" | "en", AboutDocument> = {
  sk: {
    title: "O nás",
    intro: [
      "Naša Kuchyňa je komunitná platforma na objavovanie, zdieľanie a plánovanie domácich receptov. Chceme, aby mali slovenské recepty pekné a prehľadné miesto, kde je jedlo vždy na dosah — a kde varenie spája.",
    ],
    sections: [
      {
        heading: "Prečo Naša Kuchyňa",
        body: [
          "Dobré recepty často zapadnú v záplave príspevkov na sociálnych sieťach alebo sa stratia v papierových zošitoch. Naša Kuchyňa ich dáva na jedno miesto: objavuj recepty podľa kategórie, kuchyne či tém, plánuj jedlá, tvor nákupné zoznamy a var spolu s domácnosťou.",
          "Zakladáme si na skutočných domácich receptoch od komunity a na tom, aby bol obsah prehľadný a rešpektoval práva autorov.",
        ],
      },
      {
        heading: "Kto za tým stojí",
        body: [OPERATOR_SK],
      },
      {
        heading: "Napíšte nám",
        body: [`Máte otázku, nápad alebo spätnú väzbu? Ozvite sa nám na ${CONTACT} — potešíme sa.`],
      },
    ],
  },
  en: {
    title: "About us",
    intro: [
      "Naša Kuchyňa is a community platform for discovering, sharing and planning home recipes. We want home cooking to have a clean, welcoming place where the food is always front and centre — and where cooking brings people together.",
    ],
    sections: [
      {
        heading: "Why Naša Kuchyňa",
        body: [
          "Good recipes often get buried in social-media feeds or lost in paper notebooks. Naša Kuchyňa brings them together: discover recipes by category, cuisine or theme, plan your meals, build shopping lists, and cook together with your household.",
          "We are built around real home recipes from the community, and on keeping content clean and respectful of authors' rights.",
        ],
      },
      {
        heading: "Who is behind it",
        body: [OPERATOR_EN],
      },
      {
        heading: "Get in touch",
        body: [
          `Have a question, an idea or feedback? Reach us at ${CONTACT} — we'd love to hear from you.`,
        ],
      },
    ],
  },
};
