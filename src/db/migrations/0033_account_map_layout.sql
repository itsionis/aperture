-- Per-account free-form map dashboard layout (map-layout-builder).
--
-- `ap_user.map_layout` stores one global layout (react-grid-layout geometry +
-- hidden set) applied to every map the account opens. Nullable: NULL ⇒ the client
-- falls back to DEFAULT_MAP_LAYOUT, so no per-account row needs seeding.
--
-- Rollback: src/db/migrations/0033_account_map_layout.rollback.sql.

ALTER TABLE "ap_user" ADD COLUMN "map_layout" jsonb;
