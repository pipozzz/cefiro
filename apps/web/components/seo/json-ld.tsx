/**
 * Renders a schema.org JSON-LD object as a <script> tag. Server component, so
 * the structured data is in the initial HTML for crawlers. `<` is escaped so
 * page content embedded in the data can never break out of the script tag.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script dangerouslySetInnerHTML={{ __html: json }} type="application/ld+json" />;
}
