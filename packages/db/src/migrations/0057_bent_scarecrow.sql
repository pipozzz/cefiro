ALTER TABLE "cookbooks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "cookbooks" ADD COLUMN "visibility" "recipe_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "cookbooks" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cookbooks_slug" ON "cookbooks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cookbooks_visibility" ON "cookbooks" USING btree ("visibility");