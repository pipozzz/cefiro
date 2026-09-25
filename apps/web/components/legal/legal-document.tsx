import type { LegalDocument } from "./legal-content";

/**
 * Renders a legal document (Terms or Privacy) as a readable article. Content is
 * plain text from `legal-content.ts`; this only handles layout and typography.
 */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="prose-legal mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-foreground text-3xl font-bold">{doc.title}</h1>
      <p className="text-default-500 mt-1 text-sm">
        {doc.updatedLabel}: {doc.version}
      </p>

      {doc.intro.map((paragraph, i) => (
        <p key={i} className="text-default-700 mt-6 leading-relaxed">
          {paragraph}
        </p>
      ))}

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-foreground text-lg font-semibold">{section.heading}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i} className="text-default-700 mt-2 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
