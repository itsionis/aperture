import 'server-only';
import { reconcileHomeStaticExemption } from './service';
import { updateSystem } from '@/lib/map/mutations/systems';

/**
 * Apply the ABC home-static exemption after a trigger that can change which
 * system is the Home static target (a connection `isStatic` toggle/delete, or a
 * map-settings change to `tagScheme`/`homeMapSystemId`/`exemptHomeStaticFromTag`).
 *
 * Computes the tag reconciliation (`reconcileHomeStaticExemption`) and commits
 * each change as its own `system.update` event via `updateSystem` — one
 * mutation = one event, the same pattern the connections POST route uses for
 * `assignTagOnConnect`. Lives in its own module so neither `service.ts` (read
 * side) nor the route closes an import cycle with `mutations/systems.ts`.
 *
 * Best-effort: any failure is swallowed by the caller's try/catch — tagging must
 * never fail the primary mutation.
 */
export async function applyHomeStaticExemption(
  mapId: bigint,
  characterId: bigint | null,
): Promise<void> {
  const changes = await reconcileHomeStaticExemption(mapId);
  for (const change of changes) {
    await updateSystem({
      mapId,
      mapSystemId: change.mapSystemId,
      characterId,
      patch: { tag: change.tag },
    });
  }
}
