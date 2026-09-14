CREATE TYPE "public"."recipe_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"bio" text,
	"avatar_url" text,
	"location" text,
	"website_url" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "visibility" "recipe_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_profiles_handle" ON "user_profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_is_public" ON "user_profiles" USING btree ("is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recipes_slug" ON "recipes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_recipes_visibility_published_at" ON "recipes" USING btree ("visibility","published_at" DESC NULLS LAST);