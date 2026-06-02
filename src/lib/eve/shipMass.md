## shipMass.ts

**Purpose:** Resolve a ship type's base `mass` (kg) for the connection mass-log.
**File:** `src/lib/eve/shipMass.ts`

Server-only by usage (no `import 'server-only'` — it's reached by the location-poll job chain that the
custom `server.ts` loads via tsx outside Next's bundler, where the shim doesn't resolve; same precedent
as `locationCommit.ts`). Reads the base `mass` column on `universe_type`. A ship's mass is **not** a dogma
attribute — only a handful of types carry the `mass` dogma attribute, so the attribute-view path resolved
to `null` for essentially every ship. (Contrast `wormholeJumpInfo.ts`, where stable/jump mass genuinely
are dogma attributes.)

---

### shipMass(typeId: number): Promise<number | null>
The ship's mass in kg, or `null` when the type is unknown or has no `mass`.

**Returns:** kg as a `number`, or `null`.

---

### shipMassByType(typeIds: number[]): Promise<Map<number, number | null>>
Batch variant. Returns a `Map` keyed by every requested `typeId` (each present, value `null` when
unresolved). Empty input returns an empty map.
