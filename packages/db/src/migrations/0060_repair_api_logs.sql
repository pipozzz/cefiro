-- Repair migration.
--
-- The `api_logs` CREATE TABLE was added to migration 0009 *after* that
-- migration had already been applied to some databases (e.g. production). The
-- Drizzle migrator keys off the recorded hash of each already-applied
-- migration, so it never re-ran 0009 and the table was never created there —
-- the API logger then fails on every request with
-- `relation "api_logs" does not exist`.
--
-- This is a fresh migration (new hash) so the migrator applies it everywhere,
-- and every statement is idempotent so it is a harmless no-op on databases
-- that already have the table (fresh installs, local dev).
CREATE TABLE IF NOT EXISTS "api_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"procedure" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text,
	"duration_ms" integer,
	"success" text DEFAULT 'true' NOT NULL,
	"error_code" text,
	"error_message" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'api_logs_user_id_user_id_fk'
	) THEN
		ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_logs_procedure_idx" ON "api_logs" USING btree ("procedure");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_logs_user_id_idx" ON "api_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_logs_created_at_idx" ON "api_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_logs_success_idx" ON "api_logs" USING btree ("success");
