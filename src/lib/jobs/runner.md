## runner.ts

**Purpose:** graphile-worker boot, shutdown, and one-shot helpers. Owns the long-lived `Runner` for the embedded worker process (SPEC §5.3).
**File:** `src/lib/jobs/runner.ts`

---

### startWorker(extraModules?): Promise<Runner>
Idempotent boot. Runs graphile-worker's own `runMigrations` to create/upgrade the `graphile_worker` schema, re-arms the location-poll loop after an unclean shutdown (see below), then calls `run({ pgPool, taskList, parsedCronItems, … })` and returns the `Runner`. Repeat calls in the same process return the existing instance.

`extraModules` appends to the registered set in `registry.ts` — primarily for tests / scripts that need a one-off task.

### stopWorker(): Promise<void>
Graceful shutdown via `runner.stop()`. No-op when no worker is running. Wired into `server.ts`' SIGTERM/SIGINT handlers.

### runWorkerOnce(extraModules?): Promise<void>
Run every due cron job once and exit. Used by `pnpm worker:once`. Runs migrations first so a fresh DB works.

### isWorkerRunning(): boolean
Whether `startWorker` has booted in this process. For tests/health.

### Notes
- **Shares the app's `pg.Pool`** (`@/db/client.pool`) — no separate connection pool for the worker. graphile-worker's LISTEN client is internal to the runner.
- **`noHandleSignals: true`** — `server.ts` owns process signals and shuts the worker down explicitly. Letting graphile-worker install its own SIGTERM handler would race with our HTTP server shutdown.
- **Location-poll re-arm (all environments).** Before `run()`, `startWorker` clears any orphaned `location-poll` lock (`key LIKE 'location-poll:%'`) and makes it runnable now. graphile-worker 0.16 only reclaims a lock left by a crashed worker after a **hardcoded 4h** (`get_job` / `resetLockedAt`; the `min/maxResetLockedInterval` options change only the sweep cadence, not the 4h threshold). `location-poll` is a single self-perpetuating job per character, so an unclean shutdown — a prod crash (OOM/SIGKILL/power loss), or `tsx watch` hard-killing the dev child on Windows — would otherwise silently stop that character's tracking for up to 4h, unrecoverable even by an immediate restart. Scoped to `location-poll` only because it's idempotent (jump-fold dedupe + `jobKey: 'replace'`); a long, non-idempotent job like `sdeIngest` held by a still-draining instance must not be unlocked, which is why a worker-scoped `force_unlock_workers` is **not** used. Other tasks fall back to graphile-worker's own 4h recovery.
- **Graceful shutdown still primary.** `server.ts` catches SIGTERM/SIGINT → `stopWorker()` → `runner.stop()`, releasing all locks cleanly. That covers prod redeploys and Ctrl+C; the re-arm above is the safety net for the cases where no catchable signal is delivered.
- The `graphile_worker` schema name is the library default — kept as-is; no operational reason to rename.
- `concurrency` and `pollInterval` come from `apertureConfig`. LISTEN/NOTIFY drives the fast dispatch path; the poll interval is only the fallback for scheduled retries.
