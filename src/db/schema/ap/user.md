## user.ts

**Purpose:** The `ap_user` account anchor — groups the one-or-more characters a person owns (SPEC §9 auth principals).
**File:** `src/db/schema/ap/user.ts`

---

### apUser
`pgTable('ap_user', …)`:
- `id` — `integer generated always as identity`, PK.
- `main_character_id` (`mainCharacterId`) — nullable `bigint`. The account's "main" character (Stage 17.5). Login resolves the active character to this value ("land on main"); statistics / activity roll up to it. The real FK → `ap_character.id` `ON DELETE set null` is declared in migration `0018_account_main_character.sql`, **not** inline here — an inline `.references()` would create a circular schema import (`character.ts` already imports `apUser`). Bootstrapped to the first character on first login; user-changeable in Account Settings.
- `connection_travel_animation` (`connectionTravelAnimation`) — `boolean NOT NULL DEFAULT true` (migration `0022`). Per-account toggle for the connection travel animation — a subtle moving dot played along a connection when a tracked pilot jumps across it. Read via `getConnectionTravelAnimation` (`session.ts`), written by `setConnectionTravelAnimationAction` (`actions/account.ts`), toggled in the Account Settings dialog.
- `map_layout` (`mapLayout`) — nullable `jsonb`, `.$type<MapLayoutConfig>()` (migration `0033`). The account's free-form map dashboard arrangement (map-layout-builder) — one global layout (react-grid-layout geometry + hidden set) applied to every map the account opens. NULL ⇒ the client falls back to `DEFAULT_MAP_LAYOUT` (no per-account row is seeded). Read via `getMapLayout` (`session.ts`), written by `setMapLayoutAction` (`actions/account.ts`) after Zod validation at the boundary (`src/lib/map/layout/schema.ts`).
- `created_at` / `updated_at` — `timestamptz`, default `now()`.

Stage 2 creates one user per newly-seen character. Linking additional characters onto an existing user (the SSO tile grid / "add character" flow) lands in Stage 5; `ap_character.user_id` already FKs here so no migration is needed then.
