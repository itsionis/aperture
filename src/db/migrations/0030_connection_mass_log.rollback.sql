-- Manual rollback for 0030_connection_mass_log.sql. Drops the per-jump mass
-- accounting log introduced in Stage 17.11a.
--   psql "$DATABASE_URL" -f src/db/migrations/0030_connection_mass_log.rollback.sql
DROP TABLE IF EXISTS "ap_map_connection_log";
