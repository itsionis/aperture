## enums.ts

**Purpose:** Declares every `pgEnum` shared by the `ap_*` tables — the two `ap_character` enums plus the six map/connection enums added in Stage 6.
**File:** `src/db/schema/ap/enums.ts`

---

### characterStatus
`pgEnum('character_status', ['active', 'kicked', 'banned'])` — per-character moderation state. Replaces the legacy mutually-exclusive nullable `kicked`/`banned` timestamps with a single state machine. SPEC §6.5.

### authzLevel
`pgEnum('authz_level', ['member', 'manager', 'admin'])` — in-app authority level on `ap_character`. Replaces the legacy `role` lookup table; gates admin actions in Stage 15/16. SPEC §6.5.

### mapScope
`pgEnum('map_scope', ['wh', 'k_space', 'none', 'all'])` — which kinds of systems a map may hold. On `ap_map`.

### mapType
`pgEnum('map_type', ['private', 'corp', 'alliance'])` — map ownership/visibility class. On `ap_map`.

### systemStatus
`pgEnum('system_status', ['unknown', 'friendly', 'occupied', 'hostile', 'empty', 'unscanned'])` — per-system intel state driving node colour. On `ap_map_system`, default `unknown`.

### connectionScope
`pgEnum('connection_scope', ['wh', 'stargate', 'jumpbridge', 'abyssal'])` — what kind of link a connection is. On `ap_map_connection`.

### whMass
`pgEnum('wh_mass', ['fresh', 'reduced', 'critical'])` — wormhole remaining-mass band. Replaces the legacy JSON `massStatus` flag. On `ap_map_connection`, default `fresh`.

### whJumpMass
`pgEnum('wh_jump_mass', ['s', 'm', 'l', 'xl'])` — per-jump mass class (max ship size) of a wormhole. Nullable on `ap_map_connection` (non-WH links leave it null).

### eolStage
`pgEnum('eol_stage', ['none', 'eol', 'critical'])` — end-of-life stage of a wormhole connection. Replaces the legacy `is_eol` boolean (migration 0031) to support EVE's two decay warnings: `eol` (~4h, "reaching the end of its natural lifetime") and `critical` (~1h, the newer final stage); `none` is a hole not yet decaying. On `ap_map_connection`, default `none`. The stage selects which lifetime constant (`WORMHOLE_EOL_LIFETIME_MS` vs `WORMHOLE_EOL_CRITICAL_LIFETIME_MS`) drives the countdown + EOL-expiry reap. `eol_at` is re-stamped on each stage change.

### apWebhookChannel
`pgEnum('ap_webhook_channel', ['discord'])` — outbound chat channel for an `ap_map_webhook` row. Stage 14 ships Discord only; adding `'slack'` later is a one-line `ALTER TYPE` migration plus a sibling client module.

### apWebhookEvent
`pgEnum('ap_webhook_event', ['history', 'rally'])` — which class of map events a webhook subscribes to. `history` mirrors every `ap_map_event` insert on the map; `rally` fires only when a `system.updated` event carries a non-null `rallyAt` (rally set, not cleared).

### mapRight
`pgEnum('map_right', ['map_create', 'map_update', 'map_delete', 'map_import', 'map_export', 'map_share'])` — Stage 15. The six rights a corp may grant via `ap_corporation_right`. `map_create` is a global capability; the others gate per-map mutations. Names match the legacy `right.name` strings (SPEC §6.5).

### roleSource
`pgEnum('role_source', ['builtin', 'corp_title', 'external'])` — Stage 15. Where an `ap_role` row originates. `corp_title` rows are mirrored from EVE corporation titles; `external_ref` is `'<corp_id>:<title_id>'`. `external` rows come from Discord/third-party syncs.

### structureEventKind
`pgEnum('structure_event_kind', ['create', 'update', 'delete'])` — Stage 17.2. The mutation recorded in `ap_structure_event`, the append-only accountability log for manual structure intel.

### tagScheme
`pgEnum('tag_scheme', ['none', 'abc', '0121'])` — Stage 17.10. The auto-tagging scheme a map runs (`ap_map.tag_scheme`, default `none`). `abc` = per-WH-class sequential letters; `0121` = positional chain numbering off the Home system. Adding a third scheme is additive (one `ALTER TYPE … ADD VALUE` + a strategy module + a `registry.ts` line).

### accessMode
`pgEnum('access_mode', ['open', 'restricted'])` — Permissions-overhaul. Instance-wide login policy on `ap_instance` (default `restricted`). `open` = any EVE account may log in (legacy behaviour); `restricted` = login gated by owner membership + the `ap_access_grant` allowlist. Read by the Auth.js `signIn` gate.

### accessPrincipal
`pgEnum('access_principal', ['character', 'corporation', 'alliance', 'role'])` — Permissions-overhaul. What kind of entity an `ap_access_grant` / `ap_instance_owner` row names. `character`/`corporation`/`alliance` carry EVE ids; `role` carries an `ap_role.id`. `ap_instance_owner` is CHECK-constrained to `corporation`/`alliance`; `ap_access_grant` accepts all four.

### accessScope
`pgEnum('access_scope', ['instance', 'map'])` — Permissions-overhaul. The reach of an `ap_access_grant` row. `instance` grants carry NULL `map_id` (login/admin/manage); `map` grants carry a non-NULL `map_id` (view/edit — reserved for the sharing feature). A CHECK ties scope to `map_id` nullness.

### accessCapability
`pgEnum('access_capability', ['login', 'admin', 'manage', 'view', 'edit'])` — Permissions-overhaul. What an `ap_access_grant` row permits. `login`/`admin`/`manage` are instance-scoped and used now (allowlist entry / super-admin / manager hand-grant); `view`/`edit` are map-scoped and reserved for the later temporary-sharing feature (declared now to avoid a future `ALTER TYPE`). A CHECK pairs capability with scope.
