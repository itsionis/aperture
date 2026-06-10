-- Wormhole source class becomes multi-valued. A hole can spawn in several
-- system classes (e.g. S199 in LS+NS), which a single text column can't model;
-- the previous schema collapsed multi-source holes to a null "appears anywhere"
-- source, over-including them in every system's type picker. universe_wormhole
-- is fully reseeded from scripts/data/wormhole-classes.csv on every ingest, so
-- the old column is dropped outright; re-run `pnpm sde:csv` to repopulate.
--
-- Rollback: src/db/migrations/0038_wormhole_source_classes.rollback.sql.

ALTER TABLE "universe_wormhole" DROP COLUMN "source_class";--> statement-breakpoint
ALTER TABLE "universe_wormhole" ADD COLUMN "source_classes" text[];
