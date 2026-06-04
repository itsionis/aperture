-- Manual rollback for 0034_permissions_overhaul.sql. Drops the permissions
-- overhaul instance/grant schema. Run by hand (drizzle-kit is forward-only):
--   psql "$DATABASE_URL" -f src/db/migrations/0034_permissions_overhaul.rollback.sql
DROP TABLE IF EXISTS "ap_access_grant";
DROP TABLE IF EXISTS "ap_instance_owner";
DROP TABLE IF EXISTS "ap_instance";
DROP TYPE IF EXISTS "public"."access_capability";
DROP TYPE IF EXISTS "public"."access_scope";
DROP TYPE IF EXISTS "public"."access_principal";
DROP TYPE IF EXISTS "public"."access_mode";
