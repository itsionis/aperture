## page.tsx (admin map settings)

**Purpose:** Per-map admin settings page at `/admin/maps/<id>/settings` — behavior toggles and auto-tagging config, gated to managers and admins.
**File:** `src/app/(admin)/admin/maps/[mapId]/settings/page.tsx`

### Renders
Page header ("Settings — <map name>", back link to `/admin/maps`) + a card containing `MapAdminSettingsForm` with the map's current settings and visible systems.

### Behaviour & Interactions
- Parses `mapId` from route params; calls `notFound()` for non-numeric ids.
- Gates on `isManagerOrAdmin`; redirects to `/maps` if not eligible.
- Resolves `adminVisibilityScope`; redirects to `/maps` if out of scope.
- Loads `apMap` row filtered by `mapScopeFilterFor(scope)`; calls `notFound()` if missing or soft-deleted.
- Loads visible `apMapSystem` rows joined with `universeSystem` for the Home-system picker; ordered by system name.
- Serialises `bigint` ids to strings before passing to the client form.

### Depends On
- `MapAdminSettingsForm` — `@/components/admin/MapAdminSettingsForm`.
- `auth`, `adminVisibilityScope`, `isManagerOrAdmin`, `mapScopeFilterFor` — `@/lib/auth/rights`.
- `apMap`, `apMapSystem`, `universeSystem` — `@/db/schema`.
