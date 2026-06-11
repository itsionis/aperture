## SystemOverlay

**Purpose:** Read-only floating-overlay panel showing the active character's current system, the other pilots in it and their ships, and the non-abyssal connections out with mass/EOL state.
**File:** `src/components/map/SystemOverlay.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| viewData | MapViewData | yes | The live map snapshot the canvas already maintains (systems + connections). |

### Renders
A compact, low-chrome vertical panel tuned to be as tight as possible (it lives in a Document PiP window that steals screen space from the game client): a single class+tag+name header line, a self-excluding pilots list, and a connections list of thin rows. The section labels ("Pilots in system" / "Connections") are intentionally **omitted** — the colour mass dot on each connection row and a hairline top border are the only separators. No interactivity, no tooltips (synthetic events don't cross the PiP document).

### Behaviour & Interactions
- Reads `useMapActiveChar()` for `activeCharId` / `activeCharSystemId` and `usePresenceForSystem(activeCharSystemId)` for the in-system roster — so it re-renders live off the presence store's `characterUpdate` folding with no extra wiring.
- **Header:** resolves the `MapSystemNode` where `systemId === activeCharSystemId`; a single baseline row — class (coloured via `systemClassColor(node.security)`) + tag + the muted name/alias inline (no longer a separate line). Class+tag lead because the system name is already visible in-game.
- **Off-map fallback:** when the active char's system has no placed node, the header falls back to a roster entry's `systemSecurity` / `systemTrueSec` / `systemName`; no tag, and the connections section is hidden.
- **No located character** (`activeCharSystemId == null`): renders a neutral "No tracked character located" placeholder.
- **Pilots:** roster filtered to `characterId !== activeCharId`; each row is `characterName · shipTypeName` plus the custom hull name only when it differs from the type (mirrors `PilotRoster`). Empty state: "Alone in system". No section heading.
- **Connections:** `viewData.connections` incident to the current node and `scope !== 'abyssal'`; each row is `[mass dot] [sig] [class] [tag] [far name] [badges] [EOL countdown]`. The mass dot is coloured by `connectionStyle(edge).stroke` (mass status for WH, scope colour otherwise); the **sig** is the 3-char `sigId` of the in-system signature that resolves to this connection (`viewData.signatures` filtered to `mapSystemId === node.id && mapConnectionId === edge.id` — the sig as seen on *this* scanner, not the far side; `.slice(0, 3)` defensively), muted/mono, between the dot and the class; the far-end node gives the class colour + tag/name; `connectionBadges` minus the EOL badge (STATIC / size); a live EOL countdown when `eolStage !== 'none'`. The section has a hairline top border instead of a label; no heading.

### Depends On
- `useMapActiveChar` (`./MapActiveCharContext`), `usePresenceForSystem` (`./MapPresenceContext`)
- `systemClassColor`, `connectionStyle`, `connectionBadges` (`./styling`)
- `connectionTimeLeftMs` (`@/lib/map/connectionState`), `formatRelativeFromMs` (`@/lib/map/relativeTime`) — the EOL countdown
- `cn` (`@/lib/utils`)
- Types from `@/types`: `MapViewData`, `MapSystemNode`, `MapConnectionEdge`, `MapPresenceEntry`

### Local State
- `useEolCountdown(edge)` — per-connection-row hook ticking a `now` clock every 30s while the edge is EOL; returns a formatted "time left" string or null.
