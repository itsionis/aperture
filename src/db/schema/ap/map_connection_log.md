## map_connection_log.ts

**Purpose:** Drizzle table `ap_map_connection_log` — the per-jump mass-accounting log for a wormhole connection.
**File:** `src/db/schema/ap/map_connection_log.ts`

---

### apMapConnectionLog
Append-only log of ship jumps across a connection. Written server-side by the location-poll
(`src/lib/map/connectionMassLog.ts`), read by the connection inspector for a running cumulative mass.

**Columns:**
- `id` `bigserial` PK.
- `connection_id` `bigint` NOT NULL → `ap_map_connection.id` **ON DELETE CASCADE** (collapsed holes take their log with them).
- `character_id` `bigint` → `ap_character.id` **ON DELETE SET NULL** (who jumped; nullable, audit survives erasure).
- `ship_type_id` `integer` → `universe_type.id` **ON DELETE SET NULL** (the ship; nullable). Integer to match `universe_type.id`.
- `mass` `bigint` NOT NULL — kg for this single jump, **snapshotted at log time** (SDE drift never rewrites history).
- `jumped_at` `timestamptz` NOT NULL DEFAULT now().

**Indexes:** `ap_map_connection_log_connection_id_idx` on `connection_id` (the hot list-by-connection read).

**Notes:**
- Decoupled from `ap_map_connection.mass_status` (which mirrors the in-game UI). This table is a forensics/estimation aid.
- Migration `0030_connection_mass_log`. Does **not** touch `ap_map_event` — jumps broadcast via the direct
  `connectionMassLog` pg_notify task instead.
