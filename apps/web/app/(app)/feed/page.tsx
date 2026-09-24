import { redirect } from "next/navigation";

/**
 * The standalone feed is gone — it lives on as the "Following" (Sledované) tab
 * of Discover. Keep the route as a redirect so old links / bookmarks still land
 * somewhere sensible.
 */
export default function FeedPage() {
  redirect("/discover");
}
