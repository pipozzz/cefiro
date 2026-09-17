ALTER TABLE "recipes" ADD COLUMN "saved_from_recipe_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_recipes_user_saved_from" ON "recipes" USING btree ("user_id","saved_from_recipe_id");