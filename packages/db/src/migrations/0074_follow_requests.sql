CREATE TYPE "public"."follow_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'follow_request' BEFORE 'like';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'follow_accept' BEFORE 'like';--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "status" "follow_status" DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_follows_followee_status" ON "follows" USING btree ("followee_id","status");