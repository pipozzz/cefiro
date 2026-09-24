CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"recipe_count" integer NOT NULL,
	"centroid" vector(1024) NOT NULL,
	"representative_recipe_id" uuid,
	"slug" text,
	"image" text,
	"rank" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_representative_recipe_id_recipes_id_fk" FOREIGN KEY ("representative_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;