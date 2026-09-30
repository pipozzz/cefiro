import { headers } from "next/headers";
import { AuthedAppShell } from "@/app/(app)/authed-app-shell";
import { PublicFooter } from "@/components/social/public-footer";
import { PublicHeader } from "@/components/social/public-header";

import { auth } from "@norish/auth/auth";

import { BaseProviders } from "../../providers/base-providers";

export default async function PublicCookbookLayout({ children }: { children: React.ReactNode }) {
  // Signed in → keep the app navigation (opened from Discover/feed); signed out →
  // the public chrome (header + footer). /c bypasses the auth proxy, so the cookie
  // reaches getSession.
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    return <AuthedAppShell>{children}</AuthedAppShell>;
  }

  return (
    <BaseProviders>
      <div className="flex min-h-dvh flex-col">
        <PublicHeader />
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </BaseProviders>
  );
}
