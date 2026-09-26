import { headers } from "next/headers";
import { AuthedAppShell } from "@/app/(app)/authed-app-shell";

import { auth } from "@norish/auth/auth";

import { BaseProviders } from "../../providers/base-providers";

export default async function PublicCookbookLayout({ children }: { children: React.ReactNode }) {
  // Signed in → keep the app navigation (opened from Discover/feed); signed out →
  // the public layout. /c bypasses the auth proxy, so the cookie reaches getSession.
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    return <AuthedAppShell>{children}</AuthedAppShell>;
  }

  return (
    <BaseProviders>
      <div className="min-h-dvh">{children}</div>
    </BaseProviders>
  );
}
