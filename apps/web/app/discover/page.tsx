import { headers } from "next/headers";

import { auth } from "@norish/auth/auth";

import { DiscoverClient } from "./discover-client";

// Server wrapper: discovery is public, but a signed-in reader gets a unified
// search that also covers their own library. `isAuthed` decides whether the
// authed-only "Your recipes" query runs (it needs the app-shell providers,
// which only mount for signed-in visitors — see discover/layout.tsx).
export default async function DiscoverPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return <DiscoverClient isAuthed={!!session?.user} />;
}
