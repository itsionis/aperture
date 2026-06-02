import { sql } from 'drizzle-orm';
import { bigint, bigserial, boolean, check, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { connectionScope, eolStage, whJumpMass, whMass } from './enums';
import { apMap } from './map';
import { apMapSystem } from './map_system';

// SPEC §6.5. A link between two systems on a map. The legacy JSON `type` flag
// bag is split into typed columns + enums. Connections are hard-deleted on
// collapse (wormholes don't come back); attached signatures cascade.
export const apMapConnection = pgTable(
  'ap_map_connection',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    mapId: bigint('map_id', { mode: 'bigint' })
      .notNull()
      .references(() => apMap.id, { onDelete: 'cascade' }),
    sourceMapSystemId: bigint('source_map_system_id', { mode: 'bigint' })
      .notNull()
      .references(() => apMapSystem.id, { onDelete: 'cascade' }),
    targetMapSystemId: bigint('target_map_system_id', { mode: 'bigint' })
      .notNull()
      .references(() => apMapSystem.id, { onDelete: 'cascade' }),
    scope: connectionScope('scope').notNull(),
    massStatus: whMass('mass_status').notNull().default('fresh'),
    // Nullable: only wormhole links carry a jump-mass class.
    jumpMassClass: whJumpMass('jump_mass_class'),
    // Two-stage EOL: `eol` (~4h warning) and `critical` (~1h final). `none` =
    // not yet decaying. Selects the lifetime the countdown / reap use.
    eolStage: eolStage('eol_stage').notNull().default('none'),
    preserveMass: boolean('preserve_mass').notNull().default(false),
    isRolling: boolean('is_rolling').notNull().default(false),
    // When the *current* `eol_stage` was entered (re-stamped on each stage
    // change) — used by the EOL-expiry cron and the countdown.
    eolAt: timestamp('eol_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'ap_map_connection_no_self_loop',
      sql`${t.sourceMapSystemId} <> ${t.targetMapSystemId}`,
    ),
  ],
);
