import "./globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

const title = "Cefiro: any recipe, any source.";
const description =
  "The open-source recipe app for families & friends. Import recipes from any link, plan your meals together, and keep your grocery lists in sync when shopping together. Free, open source and self-hostable.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cefiro.spertulo.sk"),
  title: {
    default: title,
    template: "%s | Cefiro",
  },
  description,
  applicationName: "Cefiro",
  keywords: [
    "recipe app",
    "meal planning",
    "self-hosted",
    "open source",
    "nutrition tracking",
    "grocery list",
    "household recipes",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "https://cefiro.spertulo.sk",
    siteName: "Cefiro",
    title,
    description,
    images: [{ url: "/screenshots/og.jpg", width: 1200, height: 630, alt: "Cefiro" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/screenshots/og.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffef7" },
    { media: "(prefers-color-scheme: dark)", color: "#336640" },
  ],
};

// Scroll reveals hide their content until observed. Marking the document as
// scripted lets that rule apply only where JS can undo it, so a scripting-free
// browser still gets a fully readable page.
const markScripted = `document.documentElement.classList.add("js")`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: markScripted }} />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
