## MapPanel

**Purpose:** Reusable chrome for one grid cell in the map dashboard — a header (grip drag-handle + title + actions + hide button) over a scrollable body.
**File:** `src/components/map/layout/MapPanel.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| id | PanelId | yes | Identifies the panel; passed back to `onHide` |
| title | string | yes | Shown in the header bar |
| onHide | (id: PanelId) => void | yes | Called when the hide (✕) button is clicked |
| headerRight | ReactNode | no | Extra header controls, rendered left of the hide button (inside the no-drag region) |
| contentClassName | string | no | Overrides the body's default `min-h-0 flex-1 overflow-auto p-0` class. The canvas panel passes `min-h-0 flex-1 overflow-hidden p-0` so ReactFlow fills a padding-free, definite-height cell instead of a scrolling inset. |
| children | ReactNode | yes | Panel body content |

### Renders
A full-height `Card` (`gap-0 py-0`) with a thin top header bar (grip icon, truncated title, optional `headerRight`, hide button) and a body that defaults to `min-h-0 flex-1 overflow-auto p-0` (overridable via `contentClassName`).

### Behaviour & Interactions
- Only the `GripVertical` grip icon (header left edge) carries `PANEL_DRAG_HANDLE_CLASS` (`ap-panel-drag`), so the grid's `dragConfig.handle` starts a drag only from the grip — the rest of the header (incl. the title) and the body keep their own pointer events (canvas pan/zoom/box-select).
- Header controls are still wrapped in `PANEL_NO_DRAG_CLASS` (`nodrag`), RGL's `dragConfig.cancel` selector, so clicking them never begins a drag.
- RGL's resize handle is a sibling of the `Card` inside the grid item, so the card's `overflow-hidden` does not clip it.
- **Card-in-card dedupe:** the body carries `[&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:ring-0`, so a module that renders its own `<Card>` as the body's direct child loses that card's frame (ring + rounded corners) and the panel reads as a single card. The module keeps its own inner padding/header and any deeper nested sub-cards (e.g. `ConnectionMassLog`) are untouched. The canvas body is a plain div, so the variant doesn't match it.

### Exports
- `MapPanel` — the component.
- `PANEL_DRAG_HANDLE_CLASS` / `PANEL_NO_DRAG_CLASS` — shared with `MapLayoutGrid` to wire the grid's drag handle/cancel selectors.

### Depends On
- `Card` (`@/components/ui/card`), `Button` (`@/components/ui/button`), lucide `GripVertical` / `X`.
