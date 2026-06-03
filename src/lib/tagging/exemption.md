## exemption.ts

**Purpose:** Server-only seam that applies the ABC home-static exemption — turns the read-only reconcile verdict into committed `system.update` events.
**File:** `src/lib/tagging/exemption.ts`

---

### applyHomeStaticExemption(mapId: bigint, characterId: bigint | null): Promise<void>
Computes `reconcileHomeStaticExemption(mapId)` and commits each `{ mapSystemId, tag }` change via `updateSystem` (one `system.update` event per change — one mutation = one event, mirroring the connections POST route's `assignTagOnConnect` handling). `tag` may be `null` (clears the exempt system's tag; freed letter reclaimable).

Call it **after** a trigger that can change the Home static target:
- a connection `isStatic` PATCH (in `connections/[connId]/route.ts`),
- a connection DELETE (same resource route — deleting the static drops the exemption),
- a `tagScheme` / `homeMapSystemId` / `exemptHomeStaticFromTag` change in `updateMapSettingsAction`.

Best-effort: wrap the call in try/catch at the call site (tagging failures must never fail the primary mutation). Lives in its own module so neither `service.ts` (read side) nor the routes close an import cycle with `mutations/systems.ts`.

### Depends On
- `reconcileHomeStaticExemption` (`./service`)
- `updateSystem` (`@/lib/map/mutations/systems`)
