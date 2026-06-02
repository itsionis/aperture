-- Support EVE's two in-game EOL stages on a wormhole connection: the `eol`
-- (~4h, "reaching the end of its natural lifetime") warning and the newer
-- `critical` (~1h) final stage. Replaces the single `is_eol` boolean with an
-- `eol_stage` enum so the countdown + EOL-expiry reap can pick a per-stage
-- lifetime (WORMHOLE_EOL_LIFETIME_MS vs WORMHOLE_EOL_CRITICAL_LIFETIME_MS).
--
-- `eol_at` keeps its meaning but is now re-stamped on every stage change, so
-- the 1h critical window starts from the critical observation, not the
-- original 4h flag. Existing `is_eol = true` rows map to the `eol` stage.
--
-- Rollback: src/db/migrations/0031_connection_eol_stage.rollback.sql.

CREATE TYPE "public"."eol_stage" AS ENUM('none', 'eol', 'critical');--> statement-breakpoint
ALTER TABLE "ap_map_connection" ADD COLUMN "eol_stage" "eol_stage" DEFAULT 'none' NOT NULL;--> statement-breakpoint
UPDATE "ap_map_connection" SET "eol_stage" = 'eol' WHERE "is_eol" = true;--> statement-breakpoint
ALTER TABLE "ap_map_connection" DROP COLUMN "is_eol";
