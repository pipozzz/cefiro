import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@norish/auth/auth";
import { getProfileByUserId } from "@norish/db/repositories/user-profiles";

import { DiscoverClient } from "./discover-client";
import { DiscoverHubLinks } from "./hub-links";

// Server wrapper: discovery is public, but a signed-in reader gets a unified
// search that also covers their own library. `isAuthed` decides whether the
// authed-only "Your recipes" query runs (it needs the app-shell providers,
// which only mount for signed-in visitors — see discover/layout.tsx).
export default async function DiscoverPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // First run: a signed-in reader who has never set up a public profile is sent
  // through onboarding (profile → cooks → recipe), so everyone — not just
  // invited users — gets the follow-suggestions step that seeds their feed. The
  // check is by profile existence (not visibility), so a reader who later made
  // their profile private is never looped back here. Discovery is the landing,
  // so this is the one choke point every new signup passes through.
  if (session?.user) {
    const profile = await getProfileByUserId(session.user.id);

    if (!profile) {
      redirect("/welcome?next=/discover");
    }
  }

  return (
    <>
      <DiscoverClient isAuthed={!!session?.user} />
      {/* Crawlable links to the SSR cuisine/category hubs — see hub-links.tsx. */}
      <DiscoverHubLinks />
    </>
  );
}
