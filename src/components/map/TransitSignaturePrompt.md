## TransitSignaturePrompt

**Purpose:** After one of the viewer's own pilots jumps through a wormhole, prompt them to pick which source-system signature they transited and auto-populate its "Leads to".
**File:** `src/components/map/TransitSignaturePrompt.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| mapId | string | yes | Active map id (for the WH-type catalog lookup). |
| systems | MapSystemNode[] | yes | All placed systems; used to resolve EVE ids → map systems. |
| connections | MapConnectionEdge[] | yes | All edges; used to find the folded WH connection and rule out gate jumps. |
| signatures | MapSignature[] | yes | All sigs; the candidate list is the source system's wormhole sigs. |
| viewerCharacterIds | number[] | yes | The viewer's own characters — only their jumps fire the prompt. |
| onPatchSignature | (signatureId: string, patch: { mapConnectionId: string }) => void | yes | Commits the "Leads to" binding (MapCanvas's optimistic `onSignaturePatch`). |

### Renders
A small dismissible `Card` pinned to the canvas top-left (`absolute left-2 top-2 z-10`, `nodrag nopan`), titled "Jumped into <dest> — which signature?", with one outline button per candidate sig (`sigId` + WH code / "no type") and an `X` dismiss. Renders `null` when there's no active prompt or zero candidates.

### Behaviour & Interactions
- Subscribes via `useTraversals`; ignores jumps whose `characterId` isn't in `viewerCharacterIds`.
- Ignores the jump unless the source system is on the map, the two systems have no `stargate` connection between them, and a `wh`-scope connection between them exists (the server-folded hole).
- Dedupes by `from→to` EVE-system key, so a fleet jumping the same hole shows one prompt.
- On open, loads the source system's `typeId → targetClass` map via `fetchWormholeTypes` (warm cache) to filter candidates.
- Candidates (pure `transitCandidates` helper): source-system `wormhole` sigs not already bound to this connection, whose type's `targetClass` matches the destination class, or whose type leads anywhere (K162 / `targetClass == null`), or which have no type set (`typeId == null`).
- Clicking a candidate calls `onPatchSignature(sig.id, { mapConnectionId })` and dismisses. Never sets `typeId` — destination class alone can't identify the exact WH code.
- Filaments and unscanned sources yield zero candidates ⇒ nothing renders.

### Emits / Calls
- `onPatchSignature(signatureId, { mapConnectionId })` — populates "Leads to".
- `useTraversals(cb)` — subscribes to pilot jumps from `MapPresenceContext`.
- `fetchWormholeTypes({ mapId, universeSystemId })` — WH-type → target-class catalog.

### Exports
- `transitCandidates(args)` — pure candidate filter, unit-testable without React.

### Depends On
- `MapPresenceContext` (`useTraversals`, must be inside `MapPresenceProvider`).
- `Card`, `Button` (shadcn/ui); `fetchWormholeTypes` (`src/lib/map/client.ts`).

### Local State
- `prompt: Prompt | null` — the active jump being asked about.
- `targetClassByTypeId: Map<number, string | null>` — loaded WH-type catalog for the source system.
