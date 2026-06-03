# Context Menu Actions

**Goal:** Populate the right-click context menu with every no-text-input action for systems, connections, and the map pane.
**Spec references:** Map mutation pathways `src/app/api/map/README.md`; map engine `src/components/map/MapCanvas.md`.

## Context

The recent commit "Added right-click context menu base" wired a cursor-anchored
context menu (`MapContextMenu`) into the map canvas for three right-click
targets — a system node, a connection edge, and the empty pane. But every menu
is still a single **disabled placeholder** (`<MenuItem disabled>System actions</MenuItem>`,
etc.). `renderItems()` in `MapContextMenu.tsx` is explicitly marked as the one
spot where real items go.

The goal is to populate the menu with every action that does **not** need a text
input, so common map edits no longer require opening the inspector sidebar:

- **System:** set status (sub-menu), set/clear rally, lock/unlock, remove from map.
- **Connection:** set mass, set jump-mass, set type (scope), set EOL state (all sub-menus), preserve-mass + rolling toggles, delete.
- **Pane:** add system — placed at the cursor.

Everything is built on existing mutation pathways and enum lists; no new API
routes, types, or DB changes. The Base UI menu library already ships submenu,
radio, and checkbox parts (`SubmenuRoot`, `SubmenuTrigger`, `RadioGroup`,
`RadioItem`, `CheckboxItem`, `Separator`, `GroupLabel` — confirmed in
`node_modules/@base-ui/react/menu`).

## Reused building blocks (do not reinvent)

| Need | Existing thing |
|---|---|
| Enum value lists + EOL labels | `src/lib/map/enumLabels.ts` — `SYSTEM_STATUSES`, `WH_MASSES`, `WH_JUMP_MASSES`, `CONNECTION_SCOPES`, `EOL_STAGES`, `EOL_STAGE_LABELS` |
| System mutation | `onSystemPatch(id, patch: UpdateSystemBody)`, `onSystemRemove(id)` in `MapCanvas.tsx` (already optimistic) |
| Connection mutation | `onConnectionPatch(id, patch: UpdateConnectionBody)`, `onConnectionDelete(id)` in `MapCanvas.tsx` |
| Add system | `onAddSystem(systemId)` + `setAddSystemOpen(true)` + existing `AddSystemDialog` |
| Target lookup | `viewData.systems` / `viewData.connections` (same arrays the inspector reads) |
| Patch field semantics | mirror `InspectorModule.tsx` — e.g. rally toggles `rallyAt: system.rallyAt ? null : new Date().toISOString()`; jump-mass `null` means "unknown" |

`MapContextMenuTarget` (`src/types/index.ts`) already carries `kind`, `id`, and
cursor `x`/`y` — no type change needed.

---

## Stage 1 — Submenu/radio/checkbox primitives in `ui/menu.tsx`
**Mode:** Accept edits
**Touches:** `src/components/ui/menu.tsx`, `src/components/ui/menu.md`

Add thin wrappers over Base UI parts, styled to match the existing `MenuItem`
and `MenuContent` (same `rounded-lg border bg-popover p-1 … shadow-md` popup,
same `data-highlighted`/`data-disabled` item classes). Export:

- `MenuSubmenuTrigger` — `MenuPrimitive.SubmenuTrigger` styled like `MenuItem`, with a trailing `ChevronRight` (lucide) pushed right (`ml-auto`).
- `MenuSubmenuContent` — `Portal > Positioner(side="right", align="start", sideOffset=4) > Popup`, same popup className as `MenuContent`. (A submenu needs its own `MenuPrimitive.SubmenuRoot` wrapper too — export `MenuSubmenu = MenuPrimitive.SubmenuRoot`.)
- `MenuRadioGroup` / `MenuRadioItem` — `RadioGroup` + `RadioItem` with a `RadioItemIndicator` (lucide `Check`) so the active enum value shows a checkmark.
- `MenuCheckboxItem` — `CheckboxItem` + `CheckboxItemIndicator` (lucide `Check`) for the boolean toggles.
- `MenuSeparator` — `MenuPrimitive.Separator` (`-mx-1 my-1 h-px bg-border`).
- `MenuGroupLabel` — `MenuPrimitive.GroupLabel` (`px-2 py-1 text-[10px] text-muted-foreground`), optional, for submenu headers.

Keep the existing `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem` exports
untouched. Update `menu.md` to document the new exports.

**Done when:** `menu.tsx` type-checks and exports the new parts; companion `.md` lists them.

---

## Stage 2 — Build the real menus in `MapContextMenu.tsx`
**Mode:** Accept edits
**Touches:** `src/components/map/MapContextMenu.tsx`, `src/components/map/MapContextMenu.md`

Extend the component props (keep `target` + `onClose`):

```ts
{
  target: MapContextMenuTarget | null;
  onClose: () => void;
  systems: MapSystemNode[];
  connections: MapConnectionEdge[];
  onSystemPatch: (id: string, patch: UpdateSystemBody) => void;
  onSystemRemove: (id: string) => void;
  onConnectionPatch: (id: string, patch: UpdateConnectionBody) => void;
  onConnectionDelete: (id: string) => void;
  onAddSystemAt: (clientX: number, clientY: number) => void;
}
```

Replace `renderItems()` with three branches that resolve the target row from
`systems`/`connections` (return a single disabled "not found" item if missing —
realtime could have removed it). Each leaf action calls a callback **and**
`onClose()`. Use radio submenus for single-select enums (current value
pre-checked) and checkbox items for toggles:

**System** (look up `system` by `target.id`):
- `Status ▸` submenu — `MenuRadioGroup value={system.status}`, one `MenuRadioItem` per `SYSTEM_STATUSES` (capitalize), `onValueChange → onSystemPatch(id, { status })`.
- `MenuItem` — `system.rallyAt ? 'Clear rally' : 'Set rally'` → `onSystemPatch(id, { rallyAt: system.rallyAt ? null : new Date().toISOString() })`.
- `MenuCheckboxItem` — "Locked", `checked={system.locked}` → `onSystemPatch(id, { locked })`.
- `MenuSeparator`.
- `MenuItem` (destructive styling, `Trash2`) — "Remove from map" → `onSystemRemove(id)`.

**Connection** (look up `connection` by `target.id`):
- `Mass ▸` — radio over `WH_MASSES` → `{ massStatus }`.
- `Jump mass ▸` — radio over `['__none__', ...WH_JUMP_MASSES]`, value `connection.jumpMassClass ?? '__none__'`, label `__none__`→"unknown" and others upper-cased → `{ jumpMassClass: v === '__none__' ? null : v }` (mirror `NONE_JUMP_MASS` handling in `InspectorModule.tsx`).
- `Type ▸` — radio over `CONNECTION_SCOPES` → `{ scope }`.
- `EOL ▸` — radio over `EOL_STAGES` with `EOL_STAGE_LABELS` → `{ eolStage }`.
- `MenuCheckboxItem` "Preserve mass" `checked={connection.preserveMass}` → `{ preserveMass }`; `MenuCheckboxItem` "Rolling" `checked={connection.isRolling}` → `{ isRolling }`.
- `MenuSeparator`.
- `MenuItem` (destructive, `Trash2`) — "Delete connection" → `onConnectionDelete(id)`.

**Pane:**
- `MenuItem` — "Add system" → `onAddSystemAt(target.x, target.y)`.

Casts use the enum types already imported from `@/lib/map/enumLabels`. Wrap each
submenu in `MenuSubmenu` (SubmenuRoot) > `MenuSubmenuTrigger` + `MenuSubmenuContent`.

Update `MapContextMenu.md` with the new props table and the per-kind item list.

---

## Stage 3 — Wire props + cursor-placed add in `MapCanvas.tsx`
**Mode:** Accept edits
**Touches:** `src/components/map/MapCanvas.tsx`, `src/components/map/MapCanvas.md`

1. Pass the new props to `<MapContextMenu>` (line ~806): `systems={viewData.systems}`, `connections={viewData.connections}`, and the four already-defined callbacks (`onSystemPatch`, `onSystemRemove`, `onConnectionPatch`, `onConnectionDelete`).

2. **Cursor placement.** Add a ref `pendingAddPoint = useRef<{ x: number; y: number } | null>(null)`. Add an `onAddSystemAt(clientX, clientY)` callback that stores the client point in the ref, closes the menu (`setContextMenu(null)`), and opens the dialog (`setAddSystemOpen(true)`). In the existing `onAddSystem(systemId)` (line ~314), before the current anchor logic, check the ref: if set, convert with `flowInstance.current.screenToFlowPosition({ x, y })`, clear the ref, and use that as `anchor` (still run it through `findOpenPosition` so it snaps to a free grid slot). Otherwise fall through to today's selection/viewport-centre logic. Pass `onAddSystemAt` to `MapContextMenu`.

Update `MapCanvas.md` — note the new `MapContextMenu` props and that `onAddSystem` honours a pending cursor point set by the pane "Add system" action.

**Done when:** right-clicking a system/connection/pane shows working menus; `npm run build` (or `tsc`/lint) is green.

---

## Verification

1. `npm run lint` / `tsc --noEmit` (whatever the repo uses) — clean.
2. Run the app, open a map:
   - **System:** right-click a node → Status submenu changes the tile colour and pre-checks the current status; Set/Clear rally toggles the rally marker; Locked toggle flips drag-lock; Remove from map hides it. Each reflects in the inspector and on other tabs (realtime echo, deduped by `eventId`).
   - **Connection:** right-click an edge → Mass / Jump mass / Type / EOL submenus each update the edge and pre-check the live value; Preserve/Rolling toggles persist; Delete removes the edge.
   - **Pane:** right-click empty canvas → Add system opens the dialog; the chosen system lands at the clicked spot (snapped to the nearest open grid slot), not the viewport centre.
3. Confirm one mutation per action lands as one `ap_map_event` (existing pathway — no change), and the menu closes after each pick.
