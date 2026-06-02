# Stage 17.11 — Remaining dialogs + library swaps + Phase-4 gate

**Goal:** Land the last feature-matrix surfaces (connection mass-log, API status), finish the legacy
library swaps (admin tables → TanStack, intel notes → Tiptap), and stand up the Phase-4 parity gate.
**Spec references:** `docs/spec/SPEC.md` §9/§10 (Phase-4 gate), `docs/spec/10-feature-matrix.md`
§§1–14, `docs/spec/08-frontend-ui-modules.md`.

## Context

Stage 17.11 is the closing catch-up stage of `docs/plans/stage-17-ui-catchup.md`. The done-when is:
*every feature-matrix §§1–14 row not dropped in SPEC §8.2 has a working implementation, demonstrated
by a focused gate suite + a parity checklist.*

Exploration found the **Changelog dialog** is already fully built
(`src/components/dialogs/ChangelogDialog.tsx` + `src/components/chrome/VersionChip.tsx`, fed by
`src/lib/integrations/github.ts` via `AppHeader`) — verify only, no work. `empty.js` never existed in
the rebuild, so that item is doc cleanup only.

### Scope decisions (confirmed with the user)

- **Connection mass-log → full per-jump accounting.** A forensics/estimation tool: log each ship that
  jumps a connection with its mass, show the running cumulative mass, so scanners can estimate how
  close a hole is to the next mass status and spot "something big went through" when a hole is reduced
  but our logged mass is low. **Decoupled from `massStatus`** (which is copied verbatim from the
  in-game UI).
- **API Status → CCP ESI `status.json`.** Faithful endpoint health board (green/yellow/red per route),
  external GET behind a short TTL cache.
- **Full-screen notification dialog → SKIPPED / deferred.** Not built this stage.
- **Phase-4 gate → focused suite + parity checklist.** New integration suite driving §§8/10/14 + the
  two new pieces; continuity of §§1–7,9,11–13 relies on existing suites; a markdown checklist maps
  every non-dropped row to its covering test/impl.

> **Standing instruction:** every `.ts`/`.tsx` created or modified below must have its companion
> `.md` written/updated in the same change (CLAUDE.md).

---

## Stage 17.11a — Connection mass-log (server-derived, per-jump)
**Mode:** Accept edits
**Goal:** Auto-log each ship a tracked character jumps across a wormhole connection, with running
cumulative mass shown in a read-only inspector panel.

**Design note (reversal):** the mass-log is **server-derived and the UI is read-only** — *not* a manual
"record jump" tool. When the location-poll detects a tracked character jumped a wormhole connection, the
backend logs the jump (ship type + dogma mass) and broadcasts via a **direct `pg_notify`** under a new
`connectionMassLog` task — exactly like `characterUpdate`, **bypassing `ap_map_event`**. This is a
server-observed transient with its own durable table + audit, not part of `MapViewData`; routing it
through `commitMapEvent` would only add no-op event rows + webhook/rollup noise. (Reverses the earlier
"manual entry / `commitMapEvent`" sketch and the out-of-scope exclusion below.)

**Schema + migration**
- New `src/db/schema/ap/map_connection_log.ts` → `ap_map_connection_log` (`id` bigserial PK;
  `connection_id` bigint NOT NULL → `ap_map_connection.id` **ON DELETE CASCADE**; `character_id` bigint
  → `ap_character.id` **ON DELETE SET NULL**; `ship_type_id` **integer** NULL → `universe_type.id`
  ON DELETE SET NULL (matches the integer PK); `mass` bigint NOT NULL, snapshotted; `jumped_at`
  timestamptz). Companion `.md`; types in `src/types/index.ts` (`ApMapConnectionLog` +
  `ConnectionMassLogEntry` view type).
- Migration **`0030_connection_mass_log.sql`** (latest journal entry is 0029) + `.rollback.sql` +
  journal entry. **No `ap_event_kind` seeds** — this path doesn't touch `ap_map_event`.

**Ship-mass resolution** — `src/lib/eve/shipMass.ts` (+ `.md`): `shipMass(typeId)` / `shipMassByType`
read the `mass` dogma attribute by name from `universe_type_attribute_effective` (copy
`src/lib/eve/wormholeJumpInfo.ts`).

**Server logging + notify** — `src/lib/map/connectionMassLog.ts` (+ `.md`): `logConnectionJump(...)`
inserts a row, computes the running cumulative, and direct-`pg_notify`s `connectionMassLog`
(null mass → skip). `listConnectionMassLog({ mapId, connectionId })` is the map-scoped reader.
Hook: `ensureConnection`/`FoldResult` in `src/lib/jobs/locationCommit.ts` return the `connectionId`;
`src/lib/jobs/tasks/locationPoll.ts` resolves mass once and calls the logger in the fold loop.

**Read API + client** — `GET src/app/api/map/[mapId]/connections/[connId]/mass-log/route.ts`
(`requireMapView`, joined rows + cumulative; **no POST/DELETE**). `fetchConnectionMassLog` in
`src/lib/map/client.ts`.

**Realtime** — new `connectionMassLog` task in `src/lib/realtime/protocol.ts`
(`connectionMassLogLoadSchema`) + a `bus.ts` dispatch branch + task-vocabulary updates in `CLAUDE.md`
and `docs/spec/`. **No** `mapEventPayloadSchema` / `applyEvent` changes.

**UI** — `src/components/sidebar/ConnectionMassLog.tsx` (+ `.md`), in `ConnectionInspector`
(`InspectorModule.tsx`, after the expiry hint, before delete): read-only per-jump rows + running
cumulative; lazy `GET` on select; refetch on a `connectionMassLog` realtime envelope for the open
connection; shows `jumpMassClass` ceiling. **Limitation:** exact "% to next status" needs the WH total
mass (not stored) — cumulative absolute + ceiling only.

**Done when:** a tracked character's wormhole jump auto-logs one `ap_map_connection_log` row with the
snapshotted mass, the read-only inspector shows the running cumulative total and survives reload, peers
update via the `connectionMassLog` broadcast, and the log cascades when the connection is deleted.
Covered by `tests/integration/connection-mass-log.test.ts` (dogma resolution, cumulative sum, null-mass
skip, fold connection id, cascade).

---

## Stage 17.11b — API Status dialog (CCP `status.json`)
**Mode:** Plan mode
**Goal:** Read-only ESI endpoint health board from CCP's status feed.

- `src/lib/integrations/esiStatus.ts` (+ `.md`): `fetchEsiStatus()` GETs CCP's ESI route status feed,
  Zod-decodes (route, method, status `green|yellow|red`, tags), short in-process TTL cache (no Redis;
  mirror `src/lib/map/thera.ts` cache + `src/lib/integrations/github.ts` resilient fetch). Re-export
  the row type from `types`.
- `GET src/app/api/reference/esi-status/route.ts` (+ `.md`): returns rows; external failure → 502
  (parallels `src/app/api/reference/wormholes/route.ts`).
- `src/components/dialogs/ApiStatusDialog.tsx` (+ `.md`): lazy-fetch on open (like `JumpInfoDialog`),
  one row per route with a colour badge; loading + dark-fail states.
- Wire an **"API status"** item into `src/components/chrome/ReferenceMenu.tsx`.

**Done when:** the dialog opens from the Info menu and renders CCP route health with badges.

---

## Stage 17.11c — Admin HTML tables → TanStack Table
**Mode:** Accept edits
**Goal:** Convert the three plain admin `<table>`s to TanStack Table.

`@tanstack/react-table` is already a dep; pattern is established in
`src/components/stats/StatsTable.tsx`. Pages stay server components feeding `rows`; extract a client
table component per page (each with a `.md`):
- `src/app/(admin)/admin/maps/page.tsx` → `src/components/admin/AdminMapsTable.tsx` (keep `MapActionsMenu`).
- `src/app/(admin)/admin/members/page.tsx` → `src/components/admin/AdminMembersTable.tsx`.
- `src/app/(admin)/admin/maps/[mapId]/webhooks/page.tsx` → `src/components/admin/AdminWebhooksTable.tsx`
  (keep `WebhookRowActions` + health badge).

**Leave `CorpRightsMatrix.tsx` as-is** — it is a radio form matrix, not a data table.

**Done when:** all three tables render via TanStack with sortable headers; admin actions still work.

---

## Stage 17.11d — Intel notes textarea → Tiptap
**Mode:** Accept edits
**Goal:** Replace the intel-notes `<textarea>` with a Tiptap editor.

`@tiptap/react` + `@tiptap/starter-kit` are already deps; nothing uses them yet.
- New `src/components/sidebar/IntelNotesEditor.tsx` (+ `.md`): controlled Tiptap (`StarterKit`) editor
  replacing the textarea in `InspectorModule.tsx` (the `intelNotes` field, ~lines 159–173). Preserve
  **commit-on-blur** (`onPatch({ intelNotes })`). Store the editor's **HTML**; existing plaintext
  loads fine. Render saved value through a read-only Tiptap instance (**not**
  `dangerouslySetInnerHTML`) so content stays constrained to StarterKit nodes/marks.
- No schema change: `ap_map_system.intel_notes` now holds Tiptap HTML (alpha app, no data migration).

**Done when:** notes edit as rich text, persist on blur, and reload correctly.

---

## Stage 17.11e — Drop `empty.js` (doc cleanup)
**Mode:** Accept edits
**Goal:** Mark the plugin/`empty.js` rows resolved.

No code exists. Note "dropped per SPEC §8.2, never ported" in: `docs/plans/stage-17-ui-catchup.md`,
`docs/spec/08-frontend-ui-modules.md` (open-questions), `docs/spec/10-feature-matrix.md` (the
`BaseModule.isPlugin` row).

---

## Stage 17.11f — Phase-4 gate suite + parity checklist
**Mode:** Plan mode
**Goal:** Demonstrate Phase-4 parity (SPEC §9/§10).

- New `tests/integration/phase4-gate.test.ts` (real Postgres, `RUN_DB_TESTS` gate) reusing existing
  readers/helpers:
  - **§8 Admin** — maps list (`listAdminMaps`), members (`listAdminMembers`), notification config
    (webhook CRUD), global settings, setup-cookie gate, statistics (`loadActivityStats`), changelog
    fetch, API status fetch, manual/credits reachable.
  - **§10 Permissions** — exercise the `tests/integration/permissions.test.ts` truth-table; add
    admin-action enforcement (kick/ban/activate/hard-delete require role; Server-Action-only, no GET
    mutations).
  - **§14 Build/assets** — static assertion that legacy artifacts are absent (no `gulpfile.js`, no
    RequireJS `require.config`, no jsPlumb/DataTables/Summernote/PNotify imports) and asset usage goes
    through Next.
- New `docs/plans/phase-4-parity-checklist.md`: a table mapping **every** §§1–14 row to
  `Kept | Dropped(§8.2)` + its implementation + test file — the human-readable "gate green" artifact.

**Done when:** the gate suite passes and the checklist has a filled impl+test cell for every
non-dropped row.

---

## Verification

1. **Typecheck + lint:** `pnpm typecheck && pnpm lint` (verify script names in `package.json`).
2. **Migration round-trip:** apply `0025` then its `.rollback.sql` on a scratch DB; confirm
   `ap_map_connection_log` + the two `ap_event_kind` rows appear and roll back cleanly.
3. **DB/integration:** `docker compose up -d` then `RUN_DB_TESTS=1 pnpm test` — new
   `connection-mass-log` + `phase4-gate` suites green; existing admin/permissions/statistics suites
   still green.
4. **Manual (run the app):** record several jumps on a connection → cumulative total updates and
   survives reload; a second tab sees them via realtime. Info ▸ API status renders CCP route badges.
   Admin maps/members/webhooks tables sort on header click. Intel notes edit as rich text and persist.
5. **Parity checklist:** every non-dropped §§1–14 row has a filled implementation + test cell.

## Out of scope / deferred (record when closing 17.11)

- Full-screen blocking notification dialog (`notification.js`).
- ~~Auto-population of the mass-log from server-side location tracking (manual recording only).~~
  **Reversed in 17.11a:** the mass-log is now server-derived from location tracking with a read-only UI
  (no manual recording). See the 17.11a section above.
- Exact "% to next mass status" prediction — needs per-connection WH-type capture, not stored today.
