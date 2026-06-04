# Permissions Overhaul

**Goal:** Make instance access opt-in (allowlist), stop conflating "is an EVE corp director" with "runs this Aperture deployment", scope corp directors to their own corp's maps, and lay a grant model that future temporary map sharing (Swamp Fest) slots into without a rework.

**Spec references:** `docs/spec/09-permissions-and-admin.md`, `docs/spec/SPEC.md` §6.5 (roles/access tables) & §7 (auth). This overhaul revises decisions in §9 of the permissions doc — this staged plan is the new authoritative record.

> **How to run this plan:** start a fresh Claude Code session per stage. Open this file, read the stage, enter the mode the stage names (`Shift+Tab` toggles Plan ↔ Accept-edits), and tell Claude to execute that stage.

> **Status:** ✅ All stages complete (1–6). The model described here is live and is the authoritative access-control record; `docs/spec/09-permissions-and-admin.md` carries a superseding pointer to this file. Designed-for-later items (map-scope grant read-path, `ap_share_link` public links, expired-grant sweep) remain intentionally unbuilt and are called out under "Designed for later" below.

---

## Context — why this change

Today every EVE account can log into any Aperture deployment (`persistLogin` in `src/lib/auth.ts` accepts everyone), and `syncCharacterAuthz` auto-promotes **any** character holding the in-game "Director" corp role to `authz_level='admin'`, which is a **global** admin (sees every corp's maps, all settings — see `canViewMap`/`isAdmin`/`adminVisibilityScope` in `src/lib/auth/rights.ts`). So a director of an unrelated corp who logs in runs the whole instance.

We want three things:
1. **Restricted-by-default login** — an opt-in allowlist of characters/corps/alliances, like legacy Pathfinder's whitelist. (User decision.)
2. **Director ≠ instance admin** — **any** corp director gets **corp-scoped admin over their own corp only** (the existing `manager` tier, which `adminVisibilityScope`/`mapScopeFilterFor` already scope per-corp), **regardless of whether their corp owns the instance**. Global `admin` is reserved for **explicit super-admin grants only** — nothing, not even instance ownership, derives it. (User decision: corp-scoped, automatic; ownership does not elevate.)
3. **Designed for later sharing** — temporary, time-boxed, read-only sharing of a corp/alliance chain with named entities *and* an anonymous public link (no EVE login). We build the data model and abstractions now; we wire the sharing UI/transport in a later feature. (User decision: all three share modes.)

The good news: most machinery already exists. `manager` is already a corp-scoped admin everywhere; map ownership is already typed `private|corp|alliance`; there is a role-overlay (`ap_role`/`ap_character_role`/`ap_map_role_access`) and a per-corp right matrix (`ap_corporation_right`). The overhaul is mostly: add an instance-config + grant layer, change the *derivation* of `authz_level`, and gate login.

---

## Design overview

### New data model (build now)

**Enums** (`src/db/schema/ap/enums.ts`):
- `access_mode` — `['open','restricted']` (default `restricted`).
- `access_principal` — `['character','corporation','alliance','role']`.
- `access_scope` — `['instance','map']`.
- `access_capability` — `['login','admin','manage','view','edit']`. Only `login`/`admin`/`manage` are *used* now; `view`/`edit` are reserved for the sharing feature (declared now so no later `ALTER TYPE` churn).

**`ap_instance`** — singleton config row (`id smallint primary key check (id = 1)`):
- `access_mode access_mode not null default 'restricted'`
- `updated_at timestamptz`

**`ap_instance_owner`** — the corp(s)/alliance(s) that own this deployment. PK `(principal_kind, principal_id)` where `principal_kind ∈ {corporation, alliance}`, `principal_id bigint`. Semantics:
- Members of an owner entity are **implicitly allowed to log in** (you can never lock yourself out of your own instance). **This is the table's only role** — login gating (Stage 3).
- Ownership does **not** affect `authz_level`. A Director of an owner entity is still just a `manager` over their own corp; global `admin` comes only from an explicit grant.

**`ap_access_grant`** — the unified grant table; the heart of the "smarter" model:
| column | notes |
|---|---|
| `id bigserial pk` | |
| `principal_kind access_principal not null` | character/corp/alliance/role |
| `principal_id bigint not null` | EVE id, or `ap_role.id` when kind=`role` |
| `scope access_scope not null` | `instance` (login/admin/manage) or `map` (view/edit — later) |
| `map_id bigint` | FK `ap_map(id)` ON DELETE CASCADE; NULL ⇔ scope=`instance` (CHECK) |
| `capability access_capability not null` | |
| `expires_at timestamptz` | NULL = permanent; non-null = time-boxed auto-revoke |
| `note text` | optional admin annotation |
| `granted_by_character_id bigint` | FK `ap_character(id)` ON DELETE SET NULL |
| `granted_at timestamptz not null default now()` | |

- Unique `(principal_kind, principal_id, scope, map_id, capability)`.
- CHECK: `(scope='instance') = (map_id IS NULL)`; CHECK pairing capability↔scope (login/admin/manage ⇒ instance; view/edit ⇒ map).
- **What each row means now:** `scope='instance', capability='login'` = allowlist entry; `capability='admin'|'manage'` on a character = explicit super-admin / manager hand-grant. **Reserved for later:** `scope='map', capability='view'|'edit'` = a named-entity map share (with `expires_at` = temporary).

### `authz_level` becomes a recomputed cache (key behavior change)

`ap_character.authz_level` stays (it is read in ~14 files) but its meaning changes from "Director⇒admin else preserve-manager" to **a deterministic cache of the resolved level**. A new pure resolver computes it; `syncCharacterAuthz` writes the result every pass. This deletes the fragile `CASE WHEN authz_level='manager'` preserve-hack in `syncCharacterAuthz.ts:142`.

`resolveAuthzLevel({ characterId, isDirector })` → `member|manager|admin`, taking the **max** of:
- explicit `ap_access_grant` rows for this character (`capability='admin'` ⇒ admin, `capability='manage'` ⇒ manager), not expired;
- derived: **any Director ⇒ manager** (ownership is irrelevant; `ap_instance_owner` is NOT consulted here);
- else `member`.

Global `admin` is therefore reachable **only** via an explicit `capability='admin'` grant.

`manager` remains corp-scoped via the unchanged `adminVisibilityScope`/`mapScopeFilterFor`/`characterScopeFilterFor` in `rights.ts` — so a foreign director now lands in the admin panel seeing **only their own corp's** maps & members, never global.

### Login gating

A `signIn` callback (Auth.js) denies access before a session is issued:
- `access_mode='open'` ⇒ allow (current behavior; the toggle exists for instances that want it).
- `access_mode='restricted'` ⇒ allow iff any of: owner-entity member; character/corp/alliance on an unexpired `capability='login'` grant; explicit `admin`/`manage` grant.
- Needs corp/alliance at gate time → fetch via **public** `esiCall('getCharacter', …)` (no token required), reusing the existing ESI client.
- **Bootstrap safety net:** when the instance is *completely* unconfigured (restricted, zero owners, zero grants, zero admins) the first successful login is allowed and recorded as a bootstrap `admin` grant — prevents permanent lockout without `/setup`.

### Instance configuration via `/setup`

The password-gated `/setup` ops console (no EVE login — `src/app/(setup)/actions.ts`) is the bootstrap path: set `access_mode`, manage `ap_instance_owner`, and seed the allowlist / super-admins. This is why owner designation is a DB setting (user decision), reachable before anyone can log in.

### Designed for later (NOT built in this plan)

- **`ap_share_link`** — anonymous public links: `token` (random, hashed at rest), `map_id`, `capability='view'`, `expires_at`, `created_by`, `revoked_at`, optional `label`/`max_uses`. A `/share/<token>` route resolves to a read-only map with no EVE session; the WS server gains a read-only token subscription on `map:<id>`. This is the larger transport change and ships with the sharing feature.
- **Map-scope grants** — wiring `canViewMap`/`viewableMapPredicate` (`src/lib/auth/rights.ts`) to also honor unexpired `ap_access_grant` rows with `scope='map'`. Table exists now; the read-path consult is added with the sharing feature.
- A periodic sweep (extend `character-cleanup`) to delete expired grants and re-resync affected characters.

---

## Stage 1 — Schema, enums, migration ✅
**Mode:** Accept edits
**Goal:** Add the enums and the `ap_instance`, `ap_instance_owner`, `ap_access_grant` tables; generate the Drizzle migration; re-export inferred types from `src/types/index.ts`.
**Touches:** `src/db/schema/ap/enums.ts`; new `src/db/schema/ap/instance.ts`, `src/db/schema/ap/access_grant.ts`; `src/db/schema/index.ts`; new `src/db/migrations/00NN_permissions_overhaul.sql` (+ rollback) via Drizzle Kit; `src/types/index.ts`; companion `.md` for every touched/added `.ts`; `src/db/schema.md`.
**Done when:** `drizzle-kit generate` produces a clean migration, it applies on a scratch DB, and `tsc` is green. No behavior change yet.

## Stage 2 — Authz resolution rewrite ✅
**Mode:** Plan mode (derivation semantics are load-bearing; review before writing)
**Goal:** Introduce `resolveAuthzLevel(...)`; rewrite `syncCharacterAuthz` to write `authz_level` as the recomputed max (explicit grants ⊔ Director derivation), removing the `CASE`-preserve hack. Add a grant-lookup helper. (No owner-lookup: ownership does not affect the level.)
**Touches:** `src/lib/auth/syncCharacterAuthz.ts` (+ `.md`); new `src/lib/auth/resolveAuthz.ts` (+ `.md`).
**Done when:** A unit/integration test shows: any Director ⇒ `manager` (corp-scoped) even when the corp is an `ap_instance_owner`; explicit `admin` grant ⇒ `admin`; explicit `manage` grant ⇒ `manager`; losing Director with no grant ⇒ `member`; expired grant ignored; explicit grants survive resync.

## Stage 3 — Login gating ✅
**Mode:** Plan mode (touches the auth callback path; deny-before-session and bootstrap are easy to get subtly wrong)
**Goal:** Add the `signIn` callback + `isLoginAllowed(...)` + public-affiliation fetch + bootstrap safety net + an `AccessDenied` page/message.
**Touches:** `src/lib/auth.ts` (+ `.md`); new `src/lib/auth/loginGate.ts` (+ `.md`); error route under `src/app/(public)/`.
**Done when:** With `access_mode='restricted'` and an empty allowlist, a non-owner character is denied at sign-in (no session, friendly message); an owner-entity member and an allowlisted character succeed; `access_mode='open'` admits everyone; the unconfigured-instance bootstrap admits exactly the first character as bootstrap admin.

## Stage 4 — `/setup` instance configuration ✅
**Mode:** Accept edits
**Goal:** `/setup` actions + UI to read/set `access_mode`, add/remove owner corps/alliances, and manage `login`/`admin`/`manage` grants (the allowlist).
**Touches:** `src/app/(setup)/actions.ts` (+ `.md`); `/setup` page/components; a small `src/lib/auth/instanceConfig.ts` read/write helper (+ `.md`).
**Done when:** An operator can, password-gated and with no EVE login, flip the access mode, designate the owner entity, and add allowlist/admin entries; values persist and immediately affect Stage 2/3 behavior.

## Stage 5 — Admin members rework ✅
**Mode:** Accept edits
**Goal:** Move `adminGrantManager`/`adminRevokeManager` off the direct `authz_level` write onto `ap_access_grant` (`capability='manage'`) and re-resync the target so the cached level updates. Audit the other admin actions (`actions/maps.ts`, `settings.ts`, `webhooks.ts`) to confirm every manager-reachable path is corp-scoped, not global.
**Touches:** `src/app/(admin)/actions/members.ts` (+ `.md`); audit-only read of the sibling admin actions; `src/lib/auth/members.ts` if the row shape needs the grant source.
**Done when:** Granting/revoking manager writes a grant row and the member's `authz_level` reflects it after resync; no admin action lets a `manager` reach outside their corp scope.

## Stage 6 — Tests & docs ✅
**Mode:** Accept edits
**Goal:** Integration coverage for the headline guarantees + update the spec record.
**Touches:** `tests/integration/permissions-*.test.ts`; `docs/spec/09-permissions-and-admin.md` (supersede §9 decisions); this file's checkboxes.
**Done when:** Tests cover: foreign-corp director is corp-scoped (the headline bug); restricted-mode login allow/deny matrix; explicit `admin` grant ⇒ global admin (and ownership alone does *not*); bootstrap claim; grant expiry is ignored when past `expires_at`. Suite green.

**Outcome — where each guarantee is covered (40 tests, all green under `RUN_DB_TESTS=1`):**
- *Foreign-corp director is corp-scoped (the headline)* — the resolver caches `manager` (`authz-resolution.test.ts`) **and** the new `permissions-scope.test.ts` proves the *consequence* at the enforcement layer: `adminVisibilityScope` ⇒ `{kind:'corp'}` (not global), `mapScopeFilterFor`/`characterScopeFilterFor` confine the manager to their own corp, and `canViewMap(manager, foreignCorpMap) === false`.
- *Restricted-mode login allow/deny matrix* + *ESI-degrade* + *bootstrap claim* — `login-gate.test.ts`.
- *Explicit `admin` grant ⇒ global admin; ownership alone does not* — `authz-resolution.test.ts` (level) + `permissions-scope.test.ts` (`canViewMap`/`adminVisibilityScope` global override).
- *Grant expiry ignored past `expires_at`* — both `authz-resolution.test.ts` and `login-gate.test.ts`.
- The Stage 15 per-map rights matrix (`permissions.test.ts`) remains green — no regression.
- Docs: `docs/spec/09-permissions-and-admin.md` now opens with a "Rebuild authority" callout superseding its legacy role model and pointing here. The existing Stage 2/3 acceptance gates were left under their stage-named files (`authz-resolution.test.ts`, `login-gate.test.ts`) rather than renamed to `permissions-*`; the spec callout enumerates the full test set.

---

## Verification (end-to-end)

1. **Schema:** run the new migration on a scratch DB (`/setup` → Run migrations, or `drizzle-kit`); confirm `ap_instance`/`ap_instance_owner`/`ap_access_grant` exist with the CHECKs.
2. **The headline bug:** seed a character with corp Director role; sign in; assert `authz_level='manager'` and that `/admin/maps` shows only that corp's maps (drive via the admin pages / `listAdminMaps` with the corp scope). Confirm they cannot view another corp's map (`canViewMap` ⇒ false). Repeat with the corp added to `ap_instance_owner` and confirm the level is *still* `manager` — ownership does not elevate.
3. **Super-admin:** add an explicit `scope='instance', capability='admin'` grant for the character; resync; assert `authz_level='admin'` and global visibility.
4. **Login gate:** set `access_mode='restricted'`, empty allowlist; a non-owner, non-listed character is denied at sign-in. Add a `login` grant for their corp; sign-in succeeds. Flip to `open`; anyone succeeds.
5. **Bootstrap:** on a fresh restricted instance with nothing configured, the first sign-in succeeds and yields a bootstrap `admin` grant; the second unknown character is denied.
6. **Regression:** existing per-map owner/role/corp-right checks in `rights.ts` still pass (run the existing `tests/integration/map-crud-actions.test.ts`).

## Open items to confirm during execution
- Migrating any **existing** hand-assigned `manager` rows into `ap_access_grant` (a one-row-per-manager data backfill in the migration) so they survive the cache recompute.
- Exact `AccessDenied` copy/route and whether to record denied attempts (off by default; the character row is still upsertable for the allowlist UI).
