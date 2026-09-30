"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the About page body (and every custom CMS page), which admins author
 * as Markdown. Kept minimal (headings, paragraphs, lists, links, emphasis) with
 * the site's typography; it SSRs to real HTML, so the copy is in the initial
 * payload for crawlers. Links are treated as untrusted admin/user input, hence
 * rel="nofollow noopener".
 *
 * GFM is enabled so that a bare email or URL an admin types (e.g.
 * `kontakt@nasakuchyna.sk`) becomes a clickable link automatically — as authors
 * expect from a Ghost-like editor — rather than rendering as plain text.
 */
export function AboutMarkdown({ children }: { children: string }) {
  return (
    <div className="text-default-700 mt-6 leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="text-foreground mt-8 text-2xl font-bold">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-foreground mt-8 text-lg font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-foreground mt-6 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="mt-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mt-4 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1 pl-6">{children}</ol>,
          a: ({ href, children }) => (
            <a
              className="text-primary hover:underline"
              href={href}
              rel="nofollow noopener noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
