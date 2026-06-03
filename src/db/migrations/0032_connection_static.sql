-- Static connections + ABC home-static exemption.
--
-- `ap_map_connection.is_static` is a user-designated flag: "this wormhole is the
-- source system's static." It is a free manual toggle (no catalog validation) —
-- distinct from the read-time `staticMatchForConnection` catalog match.
--
-- `ap_map.exempt_home_static_from_tag` opts a map into leaving the Home system's
-- static target untagged under the ABC scheme (its letter is freed for reclaim).
-- Reconciled by `reconcileHomeStaticExemption`.
--
-- Rollback: src/db/migrations/0032_connection_static.rollback.sql.

ALTER TABLE "ap_map_connection" ADD COLUMN "is_static" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ap_map" ADD COLUMN "exempt_home_static_from_tag" boolean DEFAULT false NOT NULL;
