import { redirect } from "next/navigation";

// Discovery is the primary recipe-search surface and the app's landing. The
// personal library now lives at /library; the root just forwards there.
// (Anonymous visitors are already sent to /discover by the auth proxy.)
export default function Home() {
  redirect("/discover");
}
