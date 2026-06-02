import {
  parseCronItems,
  run as graphileRun,
  runMigrations,
  runOnce as graphileRunOnce,
  type RunnerOptions,
  type Runner,
} from 'graphile-worker';
import { apertureConfig } from '../../../aperture.config';
import { pool } from '@/db/client';
import { buildCronItems, buildTaskList, type JobModule } from './registry';

/**
 * The graphile-worker runtime for Stage 11. Single Node process, shares the
 * app's pg.Pool, no Redis, no separate worker container (SPEC §5.3).
 *
 * Boot order:
 *   1. `startWorker()` calls graphile-worker's own `runMigrations` to create /
 *      upgrade the `graphile_worker` schema.
 *   2. Then `run({ pgPool, taskList, parsedCronItems, ... })` returns the
 *      long-lived `Runner` which holds the worker pool + cron + LISTEN side.
 *
 * `noHandleSignals: true` is set because `server.ts` owns process-level
 * SIGTERM/SIGINT and explicitly calls `stopWorker` so we don't race with
 * graphile-worker's own signal handlers (which would also shut down our HTTP
 * server-attached resources independently).
 */

let activeRunner: Runner | null = null;

function baseOptions(extra: readonly JobModule[]): RunnerOptions {
  return {
    pgPool: pool,
    concurrency: apertureConfig.JOB_WORKER_CONCURRENCY,
    pollInterval: apertureConfig.JOB_POLL_INTERVAL_MS,
    noHandleSignals: true,
    taskList: buildTaskList(extra),
    parsedCronItems: parseCronItems(buildCronItems(extra) as Parameters<typeof parseCronItems>[0]),
  };
}

/**
 * Boot the worker. Idempotent within a process — repeated calls return the
 * existing Runner. `extraModules` lets tests inject one-off tasks (the
 * standard registry modules from `registry.ts` are always included).
 */
export async function startWorker(extraModules: readonly JobModule[] = []): Promise<Runner> {
  if (activeRunner) return activeRunner;
  const opts = baseOptions(extraModules);
  await runMigrations(opts);
  await rearmLocationPollLoop();
  activeRunner = await graphileRun(opts);
  return activeRunner;
}

/**
 * Re-arm the location-poll loop after an unclean shutdown, on boot before the
 * pool starts. `server.ts` releases worker locks gracefully on SIGTERM/SIGINT,
 * but a crash (OOM / SIGKILL / power loss) — or, in dev, `tsx watch` hard-killing
 * the child on Windows — bypasses that. graphile-worker only reclaims an orphaned
 * lock after a hardcoded 4h (`get_job` / `resetLockedAt`, not configurable in
 * 0.16). Most tasks tolerate that wait (retryable, not singletons), but
 * `location-poll` is a single self-perpetuating job per character: a stuck lock
 * silently stops that character's tracking for up to 4h, and even an immediate
 * restart can't recover it because the fresh worker won't touch the locked row.
 *
 * Scoped to `location-poll` only. It is idempotent (the jump fold dedupes and the
 * re-enqueue uses `jobKey: 'replace'`), so the worst case under an overlapping
 * deploy is one character double-polling for a single tick. We deliberately do
 * NOT blanket-unlock every task — a long, non-idempotent job (e.g. `sdeIngest`)
 * legitimately held by a still-draining instance must not be yanked out from
 * under it, which is why a worker-scoped `force_unlock_workers` is wrong here.
 * The SET clause mirrors graphile-worker's own `resetLockedAt`.
 */
async function rearmLocationPollLoop(): Promise<void> {
  const res = await pool.query(
    `UPDATE graphile_worker._private_jobs
        SET locked_at = NULL, locked_by = NULL, run_at = GREATEST(run_at, now())
      WHERE locked_at IS NOT NULL AND key LIKE 'location-poll:%'`,
  );
  if (res.rowCount && res.rowCount > 0) {
    console.log(
      'graphile-worker: re-armed %d orphaned location-poll job(s) after an unclean shutdown',
      res.rowCount,
    );
  }
}

/**
 * Stop the running worker (graceful shutdown of the worker pool + cron + LISTEN
 * client). Safe to call when no worker is running.
 */
export async function stopWorker(): Promise<void> {
  if (!activeRunner) return;
  const runner = activeRunner;
  activeRunner = null;
  await runner.stop();
}

/**
 * Run every due cron job once and exit. Used by `pnpm worker:once` (CI / cron
 * smoke). Does NOT install LISTEN or start a long-lived worker pool. Migrations
 * run first so a fresh DB works.
 */
export async function runWorkerOnce(extraModules: readonly JobModule[] = []): Promise<void> {
  const opts = baseOptions(extraModules);
  await runMigrations(opts);
  await graphileRunOnce(opts);
}

/** True iff `startWorker` has booted (and `stopWorker` has not yet been called). Exposed for tests/health. */
export function isWorkerRunning(): boolean {
  return activeRunner !== null;
}
