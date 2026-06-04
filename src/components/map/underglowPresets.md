## underglowPresets.ts

**Purpose:** Client-side registry of `UnderglowConfig`s (color/brightness/duration/speed) — keeps the wire lean (server sends `kind`/state, client owns the look).
**File:** `src/components/map/underglowPresets.ts`

---

### UNDERGLOW_PRESETS
`Record<SystemNotificationLoad['kind'], UnderglowConfig>`. Keyed by `systemNotification` kind so `MapUnderglowBridge` looks up the look from the incoming `kind` (transient glows routed through the underglow store):
- `killmail` → red, ~15s transient pulse (server-observed zKB kill).
- `ping` → short (3s) sky-blue (`#38bdf8`) pulse, brisker cycle — a user-initiated attention pulse fired from the system context menu (`MapContextMenu` → `/api/map/[mapId]/ping`) and broadcast to every viewer.

### RALLY_UNDERGLOW
`UnderglowConfig` for a designated rally point. Persistent (`durationMs: 0`), warm amber (`#f59e0b`), slow pulse (`speedMs: 2600`) so it reads as a steady "muster here" distinct from the transient killmail/ping flashes. Rendered **directly** by `SystemNode` from `data.rallyAt` (not via the underglow store), so it lives exactly as long as the rally is set and a coinciding transient glow can't clear it.

### Depends On
- `@/lib/realtime/protocol` (`SystemNotificationLoad`), `@/types` (`UnderglowConfig`).
