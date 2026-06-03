## MapContextMenu

**Purpose:** Cursor-anchored right-click context menu for the map canvas, driven by a `MapContextMenuTarget`.
**File:** `src/components/map/MapContextMenu.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| target | MapContextMenuTarget \| null | yes | The right-clicked target (kind + id + cursor x/y). `null` ⇒ menu closed. |
| onClose | () => void | yes | Called when the menu requests to close (outside click, Escape, item select). |

### Renders
A Base UI menu popup anchored to the cursor point. Body is stubbed: one disabled placeholder `MenuItem` per kind (`System actions` / `Connection actions` / `Map actions`) — `renderItems`'s `switch` is the single spot real items get added.

### Behaviour & Interactions
- Controlled via `open={target !== null}`; `onOpenChange(false)` → `onClose`. No manual document listeners.
- Positioned with a **virtual anchor** (`getBoundingClientRect` returning a zero-size rect at `target.x`/`target.y`), opening `side="right"` / `align="start"` from the cursor like a native menu.
- Right-click does **not** change map selection — the menu carries `target.id` directly.

### Depends On
- `MenuItem` (`@/components/ui/menu`) — reused for consistent item styling.
- `@base-ui/react/menu` — `Root` / `Portal` / `Positioner` / `Popup` primitives (popup styling mirrors `MenuContent` in `ui/menu.tsx`).
- `MapContextMenuTarget` (`@/types`).
