## MapContextMenu

**Purpose:** Cursor-anchored right-click context menu for the map canvas, exposing every no-text-input system / connection / pane action without opening the inspector.
**File:** `src/components/map/MapContextMenu.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| target | MapContextMenuTarget \| null | yes | The right-clicked target (kind + id + cursor x/y). `null` ⇒ menu closed. |
| onClose | () => void | yes | Called when the menu requests to close (outside click, Escape, item select). |
| systems | MapSystemNode[] | yes | Live system rows; the `system` target is resolved by `id` from here. |
| connections | MapConnectionEdge[] | yes | Live connection rows; the `connection` target is resolved by `id` from here. |
| onSystemPatch | (id: string, patch: UpdateSystemBody) => void | yes | Commits a system field change (optimistic in `MapCanvas`). |
| onSystemRemove | (id: string) => void | yes | Removes the system from the map. |
| onConnectionPatch | (id: string, patch: UpdateConnectionBody) => void | yes | Commits a connection field change. |
| onConnectionDelete | (id: string) => void | yes | Deletes the connection. |
| onAddSystemAt | (clientX: number, clientY: number) => void | yes | Opens the add-system dialog targeting the clicked client point. |

### Renders
A Base UI menu popup anchored to the cursor point, with per-kind items:

- **system** — `Status ▸` radio submenu (`SYSTEM_STATUSES`); `Set rally` / `Clear rally` toggle; `Locked` checkbox; separator; destructive `Remove from map`.
- **connection** — `Mass ▸` (`WH_MASSES`), `Jump mass ▸` (`unknown` + `WH_JUMP_MASSES`), `Type ▸` (`CONNECTION_SCOPES`), `EOL ▸` (`EOL_STAGES` via `EOL_STAGE_LABELS`) radio submenus; `Preserve mass` / `Rolling` checkboxes; separator; destructive `Delete connection`.
- **pane** — single `Add system` item.

If the target id no longer resolves (realtime removed it), a single disabled "… not found" item is shown.

### Behaviour & Interactions
- Built on **`ContextMenu.Root`** (Base UI), not raw `Menu.Root`. This puts the menu in context-menu mode (`parent.type === 'context-menu'`), which gates the open/dismiss lifecycle — outside-press grace period and the `allowMouseEnter` flag that submenu hover-open depends on. A raw `Menu.Root` stays in dropdown mode and collapses the moment submenu hover machinery engages, so the submenu-bearing system/connection menus would vanish on pointer move (the submenu-free pane menu survived either way). Open + positioning are still driven by us.
- Controlled via `open={target !== null}`; `onOpenChange(false)` → `onClose`. No manual document listeners.
- Positioned with a **virtual anchor** (`getBoundingClientRect` returning a zero-size rect at `target.x`/`target.y`), opening `side="right"` / `align="start"` from the cursor like a native menu.
- Right-click does **not** change map selection — the menu carries `target.id` directly.
- Every leaf action invokes its callback **and** `onClose()`, so the menu closes after each pick (radio/checkbox close via the patch callback calling `onClose`).
- Jump-mass uses the `__none__` sentinel (rendered "unknown") to mean `jumpMassClass: null`, mirroring `InspectorModule.tsx`.
- Row text is column-aligned: submenu triggers and plain items pass `inset`, and destructive/add items pass their leading icon via the `icon` prop, so they share the same left gutter as the `Locked` / `Preserve mass` / `Rolling` checkbox items.

### Depends On
- `@/components/ui/menu` — `MenuItem`, `MenuSubmenu`, `MenuSubmenuTrigger`, `MenuSubmenuContent`, `MenuRadioGroup`, `MenuRadioItem`, `MenuCheckboxItem`, `MenuSeparator`.
- `@base-ui/react/context-menu` — `ContextMenu.Root` for the context-menu-mode root (controlled `open` + virtual anchor).
- `@base-ui/react/menu` — `Portal` / `Positioner` / `Popup` for the cursor-anchored popup (styling mirrors `MenuContent`).
- `@/lib/map/enumLabels` — enum value lists + EOL labels and their types.
- `MapContextMenuTarget`, `MapSystemNode`, `MapConnectionEdge` (`@/types`); `UpdateSystemBody`, `UpdateConnectionBody` (`@/lib/map/client`).
