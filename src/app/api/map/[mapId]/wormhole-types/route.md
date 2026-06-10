## route.ts — GET /api/map/[mapId]/wormhole-types

**Purpose:** Returns the wormhole-type catalog annotated for a solar system's class — fed by the WH-type dropdown in the signature inspector.
**File:** `src/app/api/map/[mapId]/wormhole-types/route.ts`

### GET
**Query params:** `systemId` — the EVE solar-system id (`universe_system.id`) to annotate against.

**Response:** `{ ok: true, data: WormholeTypeOption[] }` — each option carries `{ typeId, name, sourceClasses, targetClass, jumpMassClass, isStatic, matchesClass }`. `jumpMassClass` is the `s`/`m`/`l`/`xl` band inferred from the type's `wormholeMaxJumpMass` dogma value (null when unknown, e.g. K162); the signature module uses it to auto-set a linked connection's size. Returns the **full** catalog (the client splits it): `matchesClass` is true for the universal null-source holes (e.g. `K162`), types whose `source_classes` contains the system's class, and the system's own statics. An unrecognised `systemId` returns an empty array.

**Responses:** 200 ok, 400 missing/invalid systemId, 401 unauthenticated, 404 map not found.
