ALTER TABLE "universe_wormhole" DROP COLUMN IF EXISTS "source_classes";--> statement-breakpoint
ALTER TABLE "universe_wormhole" ADD COLUMN "source_class" text;
