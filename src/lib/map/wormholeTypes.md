## wormholeTypes.ts

**Purpose:** Wormhole-catalog lookups — class-filtered WH-type suggestion and connection "mark as static" matching.
**File:** `src/lib/map/wormholeTypes.ts`

> **Class join key:** `universe_system.security` (the `C1`–`C6` / `H` / `L` / `0.0` labels), **not** `universe_system.security_class`. The catalog's `source_classes`/`target_class` use the same labels as `universe_system.security`, and the seeded catalog + the read-path tests use exactly those. `security_class` is the unrelated SDE ore-spawn field and would never match the catalog — `security` is correct.

---

### jumpMassBand(kg: number | null): WhJumpMass | null
Buckets a wormhole's `wormholeMaxJumpMass` (kg) into the `s`/`m`/`l`/`xl` connection size bands. Thresholds: `≤5M → s`, `≤100M → m`, `<1B → l`, `≥1B → xl` (chosen to sit in the gaps between EVE's discrete jump-mass values — 5M / 62M / 300M·375M / 1B+). `null` in → `null` out. Used by both `wormholeTypesForSystem` (to tag each option) and the signature module's auto-set of a linked connection's size.

---

### wormholeTypesForSystem(systemId: number): Promise<WormholeTypeOption[]>
Returns the **full** wormhole catalog, annotated for `systemId`'s WH-type dropdown (ordered by code). The previous WHERE-filtered approach is gone — the dropdown now shows class matches by default and the rest behind a "show all" toggle, so the read path returns every row and the client splits them. Unknown `systemId` → `[]`.

Each row is tagged:
- `matchesClass: boolean` — plausibly spawns here: `source_classes IS NULL` (appears anywhere — `K162` + Drifter/shattered-access holes), the source set **contains** the system's `security` class, **or** the type is one of the system's statics. The static clause guarantees a shattered system's odd-class statics (e.g. a shattered C5 with a C3→NS static) are never hidden.
- `isStatic: true` when its `type_id` is one of the system's `universe_system_static` rows (dropdown pins these to the top).
- `jumpMassClass` — from the `wormholeMaxJumpMass` dogma value (resolved by name from `universe_dogma_attribute`, read through `universe_type_attribute_effective`), bucketed by `jumpMassBand`. If the attribute name can't be resolved, every `jumpMassClass` is `null` (no join performed).

**Returns:** `WormholeTypeOption[]` — `{ typeId, name, sourceClasses, targetClass, jumpMassClass, isStatic, matchesClass }`.

---

### staticMatchForConnection(args): Promise<StaticMatch[]>
"Mark as static": resolves the target system's `security` class, then matches it against the source system's statics — each `universe_system_static` row joined to `universe_wormhole.target_class`. Returns every static whose destination class equals the target system's class (a system may hold several). Empty when nothing matches or the target class is unknown.

**Parameters:**
- `args.sourceSystemId` — system the connection leaves from (whose statics are checked).
- `args.targetSystemId` — system the connection leads into.

**Returns:** `StaticMatch[]` — `{ typeId, name, targetClass }`.

---

### type WormholeTypeOption / StaticMatch
Result shapes for the two lookups. Re-exported from `src/types/index.ts`.

### Depends On
- `universeSystem`, `universeSystemStatic`, `universeWormhole` (Drizzle schema). The static→catalog join mirrors `loadMap.ts` `loadStatics`.
