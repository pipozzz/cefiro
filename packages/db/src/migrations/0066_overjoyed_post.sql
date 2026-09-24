CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "recipe_embeddings" (
	"recipe_id" uuid PRIMARY KEY NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"model" text NOT NULL,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_embeddings" ADD CONSTRAINT "recipe_embeddings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_embeddings_hnsw" ON "recipe_embeddings" USING hnsw ("embedding" vector_cosine_ops);