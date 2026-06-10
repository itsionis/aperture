## PilotRoster

**Purpose:** Sortable, filterable table of online tracked pilots — pilot / location (class-coloured class label + map tag + system) / ship type / custom ship name — with an optional "group alts under main" mode.
**File:** `src/components/map/PilotRoster.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| presence | readonly MapPresenceEntry[] | yes | The online + located pilot roster (from `usePresenceForMap()`). Each entry carries `userId`/`mainCharacterId`/`mainCharacterName` for grouping. |
| systemNameById | Map<number, MapSystemNode> | yes | EVE solar-system id → placed map node, for resolving the map-specific tag. |
| viewerIds | ReadonlySet<number> | yes | Character ids whose account currently has this map open in a live socket (from `GET /api/map/[id]/viewers`, polled by `PilotRosterButton`; account-level coverage, so an account's alts all count as "viewing" when it has the map open). |

### Renders
A toolbar (free-text filter `Input` with a `Search` icon + a `Group` toggle `Button` + a `Mains` toggle `Button`) above a scrollable 4-column table (Pilot / Location / Type / Ship) with **clickable, sortable column headers** (active column shows a `ChevronUp`/`ChevronDown` caret). Empty states: a standalone message when no tracked pilots are online at all, and a "No pilots match your filter" row when the filter excludes everyone.

Each pilot row shows the character name plus an amber `Unplug` icon (with a `title`) when the pilot is online in-game but **not** in `viewerIds`. In the flat (ungrouped) view, when the `Mains` toggle is on, an alt row (a character that is not its own account main) is annotated with its main's name in muted `(Main Name)` text, so you can tell who an online alt belongs to without turning on grouping. The `Mains` toggle is disabled while grouping is on, where the anchor already conveys ownership. Location shows a class-coloured class label, the placed node's tag (same class-coloured `font-mono font-bold` styling, when present), then the system name (falls back to the raw id). Type is the resolved ship hull type. Ship is the pilot's custom hull name, shown only when it differs from the type (ESI defaults `ship_name` to the type name); otherwise `—`.

### Behaviour & Interactions
- **Sort** (local state, default `{ key: 'name', dir: 'asc' }` — preserves the old name-asc order): clicking a header sorts by that column; clicking the active header flips direction. Keys map to `name` (characterName), `location` (`systemName ?? systemId`), `ship-type` (`shipTypeName`), `ship-name` (custom hull name). Blank values (no custom ship name / unknown type) always sink to the bottom regardless of direction; ties break on character name.
- **Filter** (local `query`): case-insensitive substring match across character name, **main name**, system name, ship type, and custom ship name. Applied before sort and grouping.
- **Mains toggle** (local `showOwner`, default on): toggles the muted `(Main Name)` owner annotation on alt rows in the flat view. Disabled while grouped.
- **Group toggle** (local `grouped`, default off): clusters each account's online characters using **main-anchored indent**. Within an account, the main is the anchor row (tagged `main`); its alts render indented with a `CornerDownRight` glyph. Members within a group follow the active sort; groups are ordered by main name. A group is shown if **any** of its members match the filter, and the main row stays visible as context even when only an alt matched.
  - **Main offline** (not on the roster): a dimmed italic name label (`main · offline`) anchors the group so its alts don't dangle.
  - **No main set** on the account: the first (sorted) member anchors the group unbadged.
- Stateless w.r.t. the server: name/class/security/account/main ride the presence entry; only the tag is looked up against the placed nodes, and the map-open flag against `viewerIds`.

### Depends On
- `ScrollTable`/`Th`/`Td`/`EmptyRow` from `@/components/dialogs/infoTable`
- `Input` from `@/components/ui/input`, `Button` from `@/components/ui/button`, `cn` from `@/lib/utils`
- `systemClassColor` from `@/components/map/styling`
- `Unplug`/`Search`/`UsersRound`/`ChevronUp`/`ChevronDown`/`CornerDownRight` from `lucide-react`
- Types `MapPresenceEntry`, `MapSystemNode` from `@/types`

### Local State
- `sort: { key: 'name' | 'location' | 'ship-type' | 'ship-name'; dir: 'asc' | 'desc' }`
- `query: string` — filter text
- `grouped: boolean` — group-alts-under-main toggle (persisted)
- `showOwner: boolean` — `Mains` toggle: muted owner annotation on flat-view alt rows (persisted)

The `grouped` + `showOwner` toggles persist to `localStorage` under `aperture:pilot-roster:prefs` (lazy `useState` init reads it; a `useEffect` writes on change), so the roster keeps its layout across popover open/close and reloads. Sort and filter are intentionally not persisted (transient per-session).
