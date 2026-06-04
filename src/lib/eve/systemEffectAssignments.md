## systemEffectAssignments.ts

**Purpose:** Per-system W-space anomaly-effect assignments (system id → effect key), vendored from `docs/reference/system-effects.sql` because CCP's SDE does not carry the wormhole effect.
**File:** `src/lib/eve/systemEffectAssignments.ts`

---

### SYSTEM_EFFECT_BY_ID: Record<number, SystemEffectKey>
Maps an EVE solar-system id to its W-space anomaly effect. Only the 1038 systems that actually have an effect appear; everything else is absent (read as no effect). Keys are `SystemEffectKey` values, so they line up directly with `SYSTEM_EFFECTS` / `systemEffectColor`.

Consumed by the SDE ingest (`src/lib/sde/ingest.ts`), which layers this onto `universe_system.effect` (`effect: SYSTEM_EFFECT_BY_ID[sysId] ?? null`), since the SDE itself leaves it null.
