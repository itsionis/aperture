import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/db/client';
import { apMap, apMapSystem, universeSystem } from '@/db/schema';
import { auth } from '@/lib/auth';
import { adminVisibilityScope, isManagerOrAdmin, mapScopeFilterFor } from '@/lib/auth/rights';
import { MapAdminSettingsForm } from '@/components/admin/MapAdminSettingsForm';

function parseMapId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export default async function AdminMapSettingsPage({
  params,
}: {
  params: Promise<{ mapId: string }>;
}) {
  const { mapId: rawMapId } = await params;
  const mapId = parseMapId(rawMapId);
  if (mapId === null) notFound();

  const session = await auth();
  if (!(await isManagerOrAdmin(session))) redirect('/maps');
  const scope = await adminVisibilityScope(session);
  if (scope === null) redirect('/maps');

  const [map] = await db
    .select({
      id: apMap.id,
      name: apMap.name,
      deletedAt: apMap.deletedAt,
      deleteExpiredConnections: apMap.deleteExpiredConnections,
      deleteEolConnections: apMap.deleteEolConnections,
      trackAbyssalJumps: apMap.trackAbyssalJumps,
      logActivity: apMap.logActivity,
      tagScheme: apMap.tagScheme,
      homeMapSystemId: apMap.homeMapSystemId,
      exemptHomeStaticFromTag: apMap.exemptHomeStaticFromTag,
    })
    .from(apMap)
    .where(and(eq(apMap.id, mapId), mapScopeFilterFor(scope) ?? sql`true`));
  if (!map || map.deletedAt !== null) notFound();

  const systems = await db
    .select({
      id: apMapSystem.id,
      name: universeSystem.name,
      alias: apMapSystem.alias,
    })
    .from(apMapSystem)
    .innerJoin(universeSystem, eq(apMapSystem.systemId, universeSystem.id))
    .where(and(eq(apMapSystem.mapId, mapId), eq(apMapSystem.visible, true)))
    .orderBy(asc(universeSystem.name));

  const settings = {
    deleteExpiredConnections: map.deleteExpiredConnections,
    deleteEolConnections: map.deleteEolConnections,
    trackAbyssalJumps: map.trackAbyssalJumps,
    logActivity: map.logActivity,
    tagScheme: map.tagScheme,
    homeMapSystemId: map.homeMapSystemId?.toString() ?? null,
    exemptHomeStaticFromTag: map.exemptHomeStaticFromTag,
  };

  const systemItems = systems.map((s) => ({
    id: s.id.toString(),
    name: s.name,
    alias: s.alias,
  }));

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href={{ pathname: '/admin/maps' }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3" />
            Back to maps
          </Link>
          <h1 className="text-xl font-semibold">
            Settings — <span className="text-muted-foreground">{map.name}</span>
          </h1>
        </div>
        <span className="text-xs text-muted-foreground">
          Map id <code>{map.id.toString()}</code>
        </span>
      </header>

      <div className="rounded-lg border border-border bg-card p-6">
        <MapAdminSettingsForm
          mapId={map.id.toString()}
          settings={settings}
          systems={systemItems}
        />
      </div>
    </section>
  );
}
