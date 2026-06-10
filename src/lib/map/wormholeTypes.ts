import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  universeDogmaAttribute,
  universeSystem,
  universeSystemStatic,
  universeTypeAttributeEffective,
  universeWormhole,
  whJumpMass,
} from '@/db/schema';

type WhJumpMass = (typeof whJumpMass.enumValues)[number];

/** Dogma attribute carrying a wormhole's per-jump max mass (kg). */
const JUMP_MASS_ATTR_NAME = 'wormholeMaxJumpMass';

/**
 * Bucket a wormhole's `wormholeMaxJumpMass` (kg) into the four community size
 * bands the connection editor uses. The thresholds sit in the wide gaps between
 * EVE's discrete jump-mass values (5M / 62M / 300M·375M / 1B+), so they're
 * robust to which exact value a given WH carries:
 *   - `s`  frigate holes (5,000,000)
 *   - `m`  no battleships (≤ 62,000,000)
 *   - `l`  battleships (300,000,000 / 375,000,000) — e.g. O477
 *   - `xl` capitals (≥ 1,000,000,000)
 * Returns `null` when the type has no jump-mass dogma value (can't infer).
 */
export function jumpMassBand(kg: number | null): WhJumpMass | null {
  if (kg == null) return null;
  if (kg <= 5_000_000) return 's';
  if (kg <= 100_000_000) return 'm';
  if (kg < 1_000_000_000) return 'l';
  return 'xl';
}

/**
 * Wormhole-catalog lookups for two use-cases:
 *   1. class-filtered WH-type suggestion when marking a signature as a wormhole;
 *   2. "mark as static" — identifying which of a system's statics a connection is.
 *
 * Class join key: `universe_system.security` (the C1–C6 / H / L / 0.0 labels),
 * NOT `universe_system.security_class`. `universe_wormhole`'s
 * `source_classes`/`target_class` use the same labels as `universe_system.security`,
 * and the seeded catalog uses exactly those (e.g. a C3 static carries
 * `source_classes = {'C3'}`). `security_class` is the unrelated SDE ore-spawn field.
 */

export type WormholeTypeOption = {
  typeId: number;
  /** WH code, e.g. `A239`, `K162`. */
  name: string;
  /** Classes it can spawn in; null = source unspecified (K162 + Drifter/shattered-access holes). */
  sourceClasses: string[] | null;
  /** Class it leads into; null = resolved from the far side. */
  targetClass: string | null;
  /** Inferred per-jump size band from `wormholeMaxJumpMass`; null = unknown (e.g. K162). */
  jumpMassClass: WhJumpMass | null;
  /** True when this type is one of the host system's statics (anoik.is). */
  isStatic: boolean;
  /**
   * True when this hole plausibly spawns in the host system: its source set is
   * null (appears anywhere), contains the system's class, or it is one of the
   * system's statics. Drives the dropdown's default vs. "show all" split.
   */
  matchesClass: boolean;
};

export type StaticMatch = {
  typeId: number;
  name: string;
  /** The static's destination class — equals the target system's class on a match. */
  targetClass: string | null;
};

/**
 * The full wormhole catalog, annotated for a given system's WH-type dropdown.
 * Returns every catalog row ordered by code, each tagged with `isStatic` (one of
 * the system's statics, pinned to the top) and `matchesClass` (plausibly spawns
 * here — null source, source set contains the system's class, or it's a static).
 * The dropdown shows matches by default and the rest behind "show all"; the
 * static clause keeps a shattered system's odd-class statics from being hidden.
 * An unknown `systemId` yields `[]`.
 */
export async function wormholeTypesForSystem(systemId: number): Promise<WormholeTypeOption[]> {
  const [system] = await db
    .select({ security: universeSystem.security })
    .from(universeSystem)
    .where(eq(universeSystem.id, systemId));
  if (!system) return [];

  const staticRows = await db
    .select({ typeId: universeSystemStatic.typeId })
    .from(universeSystemStatic)
    .where(eq(universeSystemStatic.systemId, systemId));
  const staticTypeIds = new Set(staticRows.map((r) => r.typeId));

  const matches = (typeId: number, sourceClasses: string[] | null): boolean =>
    sourceClasses == null ||
    (system.security != null && sourceClasses.includes(system.security)) ||
    staticTypeIds.has(typeId);

  // The jump-mass band is derived from the `wormholeMaxJumpMass` dogma value,
  // read through the effective view (so any override is honoured). Resolve the
  // attribute id by name — an SDE renumber must surface as a null band, not a
  // silently wrong join.
  const [jumpMassAttr] = await db
    .select({ id: universeDogmaAttribute.id })
    .from(universeDogmaAttribute)
    .where(eq(universeDogmaAttribute.name, JUMP_MASS_ATTR_NAME));

  if (!jumpMassAttr) {
    const rows = await db
      .select({
        typeId: universeWormhole.typeId,
        name: universeWormhole.name,
        sourceClasses: universeWormhole.sourceClasses,
        targetClass: universeWormhole.targetClass,
      })
      .from(universeWormhole)
      .orderBy(universeWormhole.name);
    return rows.map((r) => ({
      ...r,
      jumpMassClass: null,
      isStatic: staticTypeIds.has(r.typeId),
      matchesClass: matches(r.typeId, r.sourceClasses),
    }));
  }

  const rows = await db
    .select({
      typeId: universeWormhole.typeId,
      name: universeWormhole.name,
      sourceClasses: universeWormhole.sourceClasses,
      targetClass: universeWormhole.targetClass,
      jumpMass: universeTypeAttributeEffective.value,
    })
    .from(universeWormhole)
    .leftJoin(
      universeTypeAttributeEffective,
      and(
        eq(universeTypeAttributeEffective.typeId, universeWormhole.typeId),
        eq(universeTypeAttributeEffective.attrId, jumpMassAttr.id),
      ),
    )
    .orderBy(universeWormhole.name);

  return rows.map(({ jumpMass, ...r }) => ({
    ...r,
    jumpMassClass: jumpMassBand(jumpMass),
    isStatic: staticTypeIds.has(r.typeId),
    matchesClass: matches(r.typeId, r.sourceClasses),
  }));
}

/**
 * "Mark as static": which of the source system's statics lead into the target
 * system's class. Resolves the target system's class label, then matches it
 * against each of the source system's `universe_system_static` rows via
 * `universe_wormhole.target_class`. Returns every matching static (a system can
 * have more than one); empty when nothing matches or the target class is unknown.
 */
export async function staticMatchForConnection(args: {
  /** System the connection leaves from (the one whose statics we check). */
  sourceSystemId: number;
  /** System the connection leads into. */
  targetSystemId: number;
}): Promise<StaticMatch[]> {
  const [target] = await db
    .select({ security: universeSystem.security })
    .from(universeSystem)
    .where(eq(universeSystem.id, args.targetSystemId));
  if (!target?.security) return [];

  return db
    .select({
      typeId: universeWormhole.typeId,
      name: universeWormhole.name,
      targetClass: universeWormhole.targetClass,
    })
    .from(universeSystemStatic)
    .innerJoin(universeWormhole, eq(universeSystemStatic.typeId, universeWormhole.typeId))
    .where(
      and(
        eq(universeSystemStatic.systemId, args.sourceSystemId),
        eq(universeWormhole.targetClass, target.security),
      ),
    );
}
