import "@/styles/globals.css";

import { Suspense } from "react";
import RegisterServiceWorker from "@/components/register-service-worker";
import { TopProgressBar } from "@/components/top-progress-bar";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { appMetadata, appViewport } from "./metadata";
import { AppThemeProvider } from "./providers/theme-provider";

export const metadata = appMetadata;
export const viewport = appViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
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
