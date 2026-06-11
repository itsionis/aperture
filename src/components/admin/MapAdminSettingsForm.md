## MapAdminSettingsForm

**Purpose:** Admin client form for per-map behavior toggles and auto-tagging configuration, rendered on `/admin/maps/<id>/settings`.
**File:** `src/components/admin/MapAdminSettingsForm.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| mapId | string | yes | The map's id string. |
| settings | object | yes | Current map settings seed: the four behavior toggles + `tagScheme`, `homeMapSystemId`, `exemptHomeStaticFromTag`. |
| systems | `{ id: string; name: string; alias: string \| null }[]` | yes | Visible systems on the map, for the Home-system picker. |

### Renders
Two visually separated sections inside a single component:

1. **Behavior** — four checkbox toggles (`deleteExpiredConnections`, `deleteEolConnections`, `trackAbyssalJumps`, `logActivity`) with their own Save button.
2. **Auto-tagging** — scheme select (`none` / `abc` / `0121`), Home-system picker (disabled when scheme is `Off`), and an "Exempt home static from auto-tag" checkbox (enabled only under ABC with a Home set). Own Save button.

### Behaviour & Interactions
- Behavior Save → `adminUpdateMapSettings({ mapId, ...toggleValues })`.
- Tagging Save → `adminUpdateMapSettings({ mapId, tagScheme, homeMapSystemId, exemptHomeStaticFromTag })`.
- Both forms use `useTransition` for async state; pending state disables the Save button. Toast on success/error.
- `canExempt` flag enables the exemption checkbox only when `scheme === 'abc'` and a Home system is selected.

### Emits / Calls
- `adminUpdateMapSettings` from `@/app/(admin)/actions/maps`.

### Depends On
- `Button` from `@/components/ui/button`; `sonner` toasts; lucide `Save`.
