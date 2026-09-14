import { NextResponse } from "next/server";
import { serveRecipeMedia } from "@/lib/recipe-media";
import { getSharedRecipeMediaCacheControl } from "@/lib/recipe-share-access";
import { getViewableRecipeRefBySlug } from "@norish/db/repositories/user-profiles";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await params;

  if (!slug?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ref = await getViewableRecipeRefBySlug(slug);

  if (!ref) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return serveRecipeMedia(req, ref.recipeId, filename, getSharedRecipeMediaCacheControl());
}
