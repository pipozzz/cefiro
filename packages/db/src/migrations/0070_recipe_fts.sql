CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_fts" ON "recipes"
  USING gin (to_tsvector('simple', f_unaccent(coalesce("name", '') || ' ' || coalesce("description", ''))));
