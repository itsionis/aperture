# Free-form, customisable map layout (Pathfinder-style)

**Goal:** Replace the fixed two-column map layout with a free-form, draggable/resizable/
stackable dashboard grid. Per-user global default layout persisted on `ap_user` (jsonb),
per-panel show/hide, distinct arrangements for large vs small/vertical screens.

**Spec references:** CLAUDE.md (mutation pathways — Server Actions; companion `.md` rule;
shared types in `src/types/index.ts`; lifecycle patterns).

## Context

Today the map view (`src/components/map/MapCanvas.tsx`, lines ~824–976) is a fixed
two-column flex: a left column (toolbar → xyflow canvas → SignatureModule) and a
fixed-width `w-80` right `<aside>` that stacks ~9 info modules. Key system info is
permanently pinned to the right, wasting horizontal space on wide monitors and
forcing scroll on small/vertical ones, even when there's empty space below the map.

Pathfinder lets players arrange their information modules per their own screen. We
want the same: a **free-form, drag-and-drop dashboard grid** where every card can be
moved anywhere, resized, stacked, and hidden. Decided requirements (confirmed with
the user):

- **Free-form grid** — drag/resize/stack any card, dashboard-builder style, with
  distinct arrangements for large vs small/vertical screens.
- **Persistence: per-user global default** — one layout per account, applied to every
  map. Stored on `ap_user` (jsonb), saved via a Server Action.
- **Per-panel show/hide** — users can remove panels they don't use and re-add them.

**Intended outcome:** the same modules render inside a customisable grid; the user's
arrangement + hidden set persist across reloads and apply to every map they open.

## Library decision (verified against npm/source, not assumed)

Use the **official `react-grid-layout@2.2.3`** directly. Verification done during
planning:

- 2.2.3 (npm `latest`, modified 2026-03-24) passes `nodeRef: elementRef` into
  `DraggableCore` and contains **zero `findDOMNode` calls** — it does **not** crash
  under React 19.
- Its `react-draggable@^4.4.6` resolves to **4.6.0**, which explicitly added React 19
  support (nodeRef-based). The permissive `react >= 16.3.0` peer range *allows* 19.
- Ships its **own TypeScript types** (`dist/index.d.ts`) — no `@types/react-grid-layout`.
- v2 API we'll use: `Responsive` / `ResponsiveGridLayout`, the `useContainerWidth`
  hook (ResizeObserver-based width; replaces the SSR-hostile `WidthProvider`),
  `DEFAULT_BREAKPOINTS`, `DEFAULT_COLS`, and the `Layout` / `ResponsiveLayouts` types.

> An earlier exploration claimed RGL hard-crashes on React 19 and recommended a fork +
> dependency override. That was the **obsolete v1 line / `react-grid-layout-19` fork**.
> The v2.x line is the modern React-18+/19 rewrite. **No fork, no `pnpm` override, no
> patch.** `dnd-kit` is not needed.

`react-resizable-panels` (already installed) is a split-pane primitive, the wrong
shape for free-form xy placement — leave it untouched.

## Approach

### Canonical panel registry + config — `src/lib/map/layout/panels.ts` (+ `.md`)
Single source of truth for panels and defaults:
- `PanelId = 'canvas' | 'signatures' | 'inspector' | 'route' | 'intel' | 'structure' | 'killStats' | 'systemGraph' | 'systemKillboard' | 'tags' | 'thera'`
- `PANELS: { id: PanelId; title: string; defaultVisible: boolean; minW: number; minH: number }[]`
- `DEFAULT_MAP_LAYOUT: MapLayoutConfig` — reproduces today's arrangement (tall canvas
  top-left, full-width signatures below, right column in current order: Inspector,
  Route, Intel, Structure, KillStats, SystemGraph, SystemKillboard, Tags, Thera) with
  `lg` / `md` / `sm` variants (`sm` = single-column stack).
- `LAYOUT_CONFIG_VERSION = 1`.

### Stored shape — type in `src/types/index.ts` (shared-types rule)
```ts
export type Breakpoint = 'lg' | 'md' | 'sm';
export interface MapLayoutConfig {
  version: number;
  layouts: Record<Breakpoint, import('react-grid-layout').Layout>; // i,x,y,w,h,minW,minH
  hidden: PanelId[];
}
```
- Panel order is implicit in x/y geometry (no separate order array).
- A `PanelId` present in `PANELS` but missing from a saved `layouts[bp]` (a panel
  shipped after the user last saved) is auto-placed at the bottom on load — forward
  compatible, no data migration for future panels.
- Breakpoints `{ lg: 1200, md: 768, sm: 0 }`, cols `{ lg: 12, md: 8, sm: 4 }`.

### Persistence
- **Schema:** add nullable `mapLayout: jsonb('map_layout')` to `apUser`
  (`src/db/schema/ap/user.ts`). Null ⇒ use `DEFAULT_MAP_LAYOUT`. Update `user.md` +
  `src/db/schema.md`. Generate + run migration (`pnpm db:generate`, `pnpm db:migrate`)
  → new file in `src/db/migrations/`.
- **Zod boundary:** `mapLayoutConfigSchema` in `src/lib/map/layout/schema.ts` (+ `.md`)
  — validates version/layouts/hidden with bounded numeric ranges (user-supplied JSON
  is a system boundary).
- **Server Action:** `setMapLayoutAction(config: unknown): Promise<AccountActionResult>`
  in `src/app/(app)/actions/account.ts` (+ `.md`), mirroring
  `setConnectionTravelAnimationAction` exactly: `requireSession` → `schema.parse` →
  `db.update(apUser).set({ mapLayout, updatedAt }).where(eq(apUser.id, session.userId))`
  → `revalidatePath('/', 'layout')`. Parse failure ⇒ `{ ok: false, error }`.
- **Load:** add a `getMapLayout(userId)` reader next to `getConnectionTravelAnimation`
  in `src/lib/session.ts`; include it in the existing `Promise.all` in
  `src/app/(app)/map/[[...slug]]/page.tsx`; pass `mapLayout` as a new `MapCanvas` prop
  (null ⇒ client uses `DEFAULT_MAP_LAYOUT`).

### Panel chrome — `src/components/map/layout/MapPanel.tsx` (+ `.md`)
Reusable wrapper so every grid cell is consistent:
- Props: `id: PanelId`, `title: string`, `onHide: (id) => void`, `headerRight?: ReactNode`, `children`.
- Renders a `Card` (`h-full`) with a header bar carrying the RGL drag-handle class
  (e.g. `ap-panel-drag`) + grip icon + title + optional `headerRight` + a hide button
  (class `nodrag`), and a scrollable body (`overflow-auto min-h-0`).
- **Drag isolation:** set `draggableHandle=".ap-panel-drag"` on the grid so only the
  header drags the panel — the ReactFlow body keeps pan/zoom/box-select. Keep RGL's
  resize handle (theme via imported RGL `styles.css` + Tailwind).
- Modules are wrapped at the call site in `MapCanvas`; modules themselves are **not**
  modified (small surface, `.md`s stable). Inspector/Signatures already render their
  own `Card` — accept card-in-card for v1, cosmetic dedupe deferred to polish.

### Canvas as a grid item (pan/zoom/selection intact)
- Canvas becomes one grid item with the header drag-handle. ReactFlow v12 auto-fits on
  container resize via its internal ResizeObserver — no manual `fitView` on resize.
- Keep `defaultViewport`/`fitView` init and `onMoveEnd` viewport persistence
  (`aperture:map:<id>:viewport`) unchanged.
- **Remove the manual canvas-height machinery** (superseded by grid resize):
  `canvasHeight` state (~line 177), the restore `useEffect` reading
  `aperture:map:canvas-height` (~639–648), `onResizeStart` (~650–671),
  `style={{ height: canvasHeight }}` on the flow wrapper (~842), and the
  `cursor-ns-resize` separator (~920–928). Drop the `aperture:map:canvas-height`
  localStorage key (local UI state, no migration). Flow wrapper becomes `h-full`.
- Generous `minW`/`minH` on the canvas item so the map never collapses.

### Responsive + save flow
- `Responsive` grid + `useContainerWidth` (ref on the wrapper, width into the grid).
  Guard behind a mounted flag with a simple stacked fallback for first paint to avoid
  hydration flash.
- `onLayoutChange(current, allLayouts)` → update local state + schedule a **debounced
  (~600ms)** `setMapLayoutAction` persisting the whole `allLayouts` + `hidden`. Timer
  in a `useRef`, flush on unmount. Last-write-wins (single user).
- **Show/hide:** a "Panels" dropdown in the toolbar row (~826–839) lists every
  `PanelId` with a checkbox; toggling updates `hidden` and the active layout, then
  saves. Hidden = absent from the grid.
- **Null-selection panels keep their slot, show an empty state** (do not collapse):
  layout is geometry keyed by panel id; collapsing on empty would re-pack neighbours
  and shift the saved arrangement on every selection change. "Hidden" (user removed) ≠
  "empty" (no selection).
- **Reset layout:** a menu item that sets state to `DEFAULT_MAP_LAYOUT` and saves.

## Staging

Start a fresh session per stage. Each stage ends green (`pnpm typecheck` +
`pnpm build`). Every touched `.ts`/`.tsx` updates its `.md`.

### Stage 0 — Library spike
**Mode:** Plan mode
**Goal:** `pnpm add react-grid-layout@2.2.3`; mount a throwaway `Responsive` grid with
two draggable+resizable cells in `pnpm dev`.
**Done when:** drag + resize work with no `findDOMNode` error and `pnpm build` passes.
(Expected trivial given verification; confirms before building real UI.)

### Stage 1 — Config + types + DB
**Mode:** Accept edits
**Touches:** `src/types/index.ts`, `src/lib/map/layout/panels.ts`,
`src/lib/map/layout/schema.ts`, `src/db/schema/ap/user.ts`, `src/db/migrations/`,
`src/app/(app)/actions/account.ts`, `src/lib/session.ts`,
`src/app/(app)/map/[[...slug]]/page.tsx`.
**Goal:** types; registry + `DEFAULT_MAP_LAYOUT`; Zod schema; `ap_user.map_layout`
column + migration; `setMapLayoutAction`; `getMapLayout` loader wired into `page.tsx`
passing a (still unused) `mapLayout` prop.
**Done when:** migration applies, build/typecheck green, map renders unchanged.

### Stage 2 — `MapPanel` + grid scaffold
**Mode:** Accept edits
**Touches:** `src/components/map/layout/MapPanel.tsx`, `MapLayoutGrid.tsx` (+ `.md`s).
**Goal:** `MapPanel` chrome; `MapLayoutGrid` wrapping `Responsive`, `useContainerWidth`,
mount guard, breakpoints, `onLayoutChange`. Not yet the live layout.
**Done when:** build green; smoke render shows chrome + working drag handle.

### Stage 3 — Swap live layout to the grid
**Mode:** Plan mode (touches the big render block)
**Touches:** `src/components/map/MapCanvas.tsx` (+ `.md`).
**Goal:** replace the two-column flex with the grid; wrap canvas + every module in
`MapPanel`; remove canvas-height machinery; keep all dialogs/providers/callbacks; load
`mapLayout` → state → render; debounced save.
**Done when:** map fully draggable/resizable, layout persists across reload, ReactFlow
pan/zoom/select intact, build green.

### Stage 4 — Show/hide + responsive + reset
**Mode:** Accept edits
**Goal:** Panels dropdown (hide/re-add via `hidden`), distinct lg/md/sm arrangements
saved together, Reset layout, empty-state for null-selection panels.
**Done when:** hide/re-add persists; resizing the window switches breakpoint
arrangements; reset restores defaults; build green.

### Stage 5 — Polish (optional)
**Mode:** Accept edits
**Goal:** card-in-card dedupe for Inspector/Signatures, theme resize handles,
forward-compat auto-place for new panels.
**Done when:** polish done, touched `.md`s updated, build green.

## Critical files
- `src/components/map/MapCanvas.tsx` — render swap, canvas-height removal, debounced
  save, MapPanel wrapping (~824–976; 177; 639–671).
- `src/app/(app)/actions/account.ts` — `setMapLayoutAction`.
- `src/db/schema/ap/user.ts` — `map_layout` jsonb column (+ Drizzle migration).
- `src/lib/session.ts` — `getMapLayout` reader.
- `src/app/(app)/map/[[...slug]]/page.tsx` — load saved layout, pass as prop.
- `src/types/index.ts` — `MapLayoutConfig` / `Breakpoint` types.
- `src/lib/map/layout/panels.ts` (new) — panel registry + `DEFAULT_MAP_LAYOUT`.
- `src/lib/map/layout/schema.ts` (new) — Zod validation.
- `src/components/map/layout/MapPanel.tsx`, `MapLayoutGrid.tsx` (new) — chrome + grid.

## Verification (end-to-end)
1. `pnpm db:migrate` applies the `map_layout` migration cleanly.
2. `pnpm dev`, open a map: default layout matches today's arrangement.
3. Drag a panel by its header, resize it — map canvas keeps pan/zoom/box-select
   (dragging the canvas body pans; dragging its header moves the panel).
4. Reload — arrangement persists. Open a different map — same layout applies
   (per-user global).
5. Hide a panel via the Panels dropdown; reload — stays hidden; re-add it — returns.
6. Narrow the window past breakpoints — the md/sm arrangement is independent and is
   saved separately. Reset layout restores defaults.
7. `pnpm typecheck` + `pnpm build` green.
