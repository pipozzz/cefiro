import { SharingManager } from "./sharing-manager";

// Bulk sharing manager, under the app shell (auth handled by the (app) layout /
// proxy). Lets an owner turn many library recipes public at once.
export default function LibrarySharingPage() {
  return <SharingManager />;
}
