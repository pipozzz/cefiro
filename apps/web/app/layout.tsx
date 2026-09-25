import "@/styles/globals.css";

import { Suspense } from "react";
import RegisterServiceWorker from "@/components/register-service-worker";
import { TopProgressBar } from "@/components/top-progress-bar";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import PlausibleProvider from "next-plausible";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

import { appMetadata, appViewport } from "./metadata";
import { AppThemeProvider } from "./providers/theme-provider";

export const metadata = appMetadata;
export const viewport = appViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Cookieless Plausible, proxied first-party (withPlausibleProxy in next.config)
  // so ad-blockers can't block it. Off when no domain is configured.
  const plausibleDomain = SERVER_CONFIG.PLAUSIBLE_DOMAIN?.trim();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        {plausibleDomain ? <PlausibleProvider domain={plausibleDomain} /> : null}
        <meta content="yes" name="apple-mobile-web-app-capable" />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <AppThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </AppThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
