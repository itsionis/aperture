ALTER TABLE "ap_map_connection" ADD COLUMN "is_eol" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "ap_map_connection" SET "is_eol" = true WHERE "eol_stage" <> 'none';--> statement-breakpoint
ALTER TABLE "ap_map_connection" DROP COLUMN "eol_stage";--> statement-breakpoint
DROP TYPE "public"."eol_stage";
