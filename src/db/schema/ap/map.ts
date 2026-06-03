import { sql } from 'drizzle-orm';
import { bigint, bigserial, boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { apCharacter } from './character';
import { mapScope, mapType, tagScheme } from './enums';

// SPEC §6.5. The owning entity for every per-map relation. Two-phase deletion
// via `deleted_at` (30-day grace, then a cron hard-purge) — no `active` boolean.
// Legacy per-map toggles `persistentAliases`/`persistentSignatures`/`logHistory`
// are dropped; webhook columns normalise into `ap_map_webhook` (later stage).
//
// Stage 15: exactly one of `owner_character_id` / `owner_corporation_id` /
// `owner_alliance_id` is populated on every new map and matches `type`. The
// CHECK constraint that enforces this is added in migration 0013; rows created
// before Stage 15 have all three NULL and are treated as admin-only by
// `canViewMap`/`canMutateMap` (defensive default — see `src/lib/auth/rights.ts`).
export const apMap = pgTable('ap_map', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  scope: mapScope('scope').notNull(),
  type: mapType('type').notNull(),
  name: text('name').notNull(),
  icon: text('icon'),
  deleteExpiredConnections: boolean('delete_expired_connections').notNull().default(true),
  deleteEolConnections: boolean('delete_eol_connections').notNull().default(true),
  trackAbyssalJumps: boolean('track_abyssal_jumps').notNull().default(true),
  logActivity: boolean('log_activity').notNull().default(true),
  nextBookmarks: jsonb('next_bookmarks')
    .notNull()
    .default(sql`'[]'::jsonb`),
  // Stage 15 owner columns (mutually exclusive by `type`):
  //   type='private'  → owner_character_id   NOT NULL; other two NULL
  //   type='corp'     → owner_corporation_id NOT NULL; other two NULL
  //   type='alliance' → owner_alliance_id    NOT NULL; other two NULL
  // `owner_character_id` is `ON DELETE SET NULL` so an erased character does
  // not cascade-delete the maps they created (preserves audit trail + admin
  // recovery). `owner_corporation_id`/`owner_alliance_id` are bare bigints —
  // `ap_corporation`/`ap_alliance` are not yet FK targets app-wide.
  ownerCharacterId: bigint('owner_character_id', { mode: 'bigint' }).references(
    () => apCharacter.id,
    { onDelete: 'set null' },
  ),
  ownerCorporationId: bigint('owner_corporation_id', { mode: 'bigint' }),
  ownerAllianceId: bigint('owner_alliance_id', { mode: 'bigint' }),
  // Stage 17.10 auto-tagging. `tag_scheme='none'` (default) leaves `ap_map_system.tag`
  // manual-only. `home_map_system_id` is the central node both schemes tag from and
  // cannot be deleted while designated (guard in `removeSystem`). Its FK →
  // `ap_map_system.id` is declared in SQL only (migration 0024) — adding a Drizzle
  // `.references()` here would close the `map.ts → map_system.ts → map.ts` import
  // cycle. Mirrors the `ap_user.main_character_id` precedent (migration 0018).
  tagScheme: tagScheme('tag_scheme').notNull().default('none'),
  homeMapSystemId: bigint('home_map_system_id', { mode: 'bigint' }),
  // When true (ABC scheme only), the system reached by the Home system's static
  // connection (`ap_map_connection.is_static`) is left untagged — its letter is
  // freed for reclaim. Reconciled in `reconcileHomeStaticExemption`.
  exemptHomeStaticFromTag: boolean('exempt_home_static_from_tag').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // NULL = active; non-null = soft-deleted, awaiting hard purge.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
