'use client';

import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { adminUpdateMapSettings } from '@/app/(admin)/actions/maps';

type ToggleKey =
  | 'deleteExpiredConnections'
  | 'deleteEolConnections'
  | 'trackAbyssalJumps'
  | 'logActivity';

type TagScheme = 'none' | 'abc' | '0121';

const TOGGLES: { key: ToggleKey; label: string; description: string }[] = [
  {
    key: 'deleteExpiredConnections',
    label: 'Delete expired connections',
    description: 'Auto-remove connections past their lifetime.',
  },
  {
    key: 'deleteEolConnections',
    label: 'Delete EOL connections',
    description: 'Auto-remove connections once they pass end-of-life.',
  },
  {
    key: 'trackAbyssalJumps',
    label: 'Track abyssal jumps',
    description: 'Record abyssal traversals as connections.',
  },
  { key: 'logActivity', label: 'Log activity', description: 'Record map activity to history.' },
];

const TAG_SCHEME_OPTIONS: { value: TagScheme; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'abc', label: 'ABC — per-class letters' },
  { value: '0121', label: '0121 — chain numbering' },
];

function BehaviorForm({
  mapId,
  initialValues,
}: {
  mapId: string;
  initialValues: Record<ToggleKey, boolean>;
}) {
  const [values, setValues] = useState(initialValues);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await adminUpdateMapSettings({ mapId, ...values });
      if (result.ok) toast.success('Settings saved.');
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {TOGGLES.map((t) => (
        <label key={t.key} className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={values[t.key]}
            onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.checked }))}
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.description}</span>
          </span>
        </label>
      ))}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save />
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function TaggingForm({
  mapId,
  initialScheme,
  initialHomeMapSystemId,
  initialExemptHomeStatic,
  systems,
}: {
  mapId: string;
  initialScheme: TagScheme;
  initialHomeMapSystemId: string | null;
  initialExemptHomeStatic: boolean;
  systems: { id: string; name: string; alias: string | null }[];
}) {
  const [scheme, setScheme] = useState<TagScheme>(initialScheme);
  const [homeMapSystemId, setHomeMapSystemId] = useState(initialHomeMapSystemId ?? '');
  const [exemptHomeStatic, setExemptHomeStatic] = useState(initialExemptHomeStatic);
  const [pending, startTransition] = useTransition();

  const canExempt = scheme === 'abc' && homeMapSystemId !== '';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await adminUpdateMapSettings({
        mapId,
        tagScheme: scheme,
        homeMapSystemId: homeMapSystemId === '' ? null : homeMapSystemId,
        exemptHomeStaticFromTag: exemptHomeStatic,
      });
      if (result.ok) toast.success('Tagging updated.');
      else toast.error(result.error);
    });
  }

  const selectClass =
    'h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-tag-scheme" className="text-sm font-medium">
          Auto-tagging scheme
        </label>
        <select
          id="admin-tag-scheme"
          value={scheme}
          onChange={(e) => setScheme(e.target.value as TagScheme)}
          className={selectClass}
        >
          {TAG_SCHEME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Newly discovered systems are tagged automatically. ABC assigns per-class letters; 0121
          numbers each system by its position in the chain off Home.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-home-system" className="text-sm font-medium">
          Home system
        </label>
        <select
          id="admin-home-system"
          value={homeMapSystemId}
          onChange={(e) => setHomeMapSystemId(e.target.value)}
          disabled={scheme === 'none'}
          className={`${selectClass} disabled:opacity-50`}
        >
          <option value="">— None —</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.alias ? `${s.alias} (${s.name})` : s.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The central node both schemes calculate from. It cannot be removed from the map while
          designated.
        </p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary disabled:opacity-50"
          checked={exemptHomeStatic}
          disabled={!canExempt}
          onChange={(e) => setExemptHomeStatic(e.target.checked)}
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium">Exempt home static from auto-tag</span>
          <span className="text-xs text-muted-foreground">
            ABC only. Leave the system on the far side of Home&apos;s static connection untagged — its
            letter is freed for reclaim. Mark the connection as Static via its right-click menu.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save />
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export function MapAdminSettingsForm({
  mapId,
  settings,
  systems,
}: {
  mapId: string;
  settings: {
    deleteExpiredConnections: boolean;
    deleteEolConnections: boolean;
    trackAbyssalJumps: boolean;
    logActivity: boolean;
    tagScheme: TagScheme;
    homeMapSystemId: string | null;
    exemptHomeStaticFromTag: boolean;
  };
  systems: { id: string; name: string; alias: string | null }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Behavior</h2>
        <BehaviorForm
          mapId={mapId}
          initialValues={{
            deleteExpiredConnections: settings.deleteExpiredConnections,
            deleteEolConnections: settings.deleteEolConnections,
            trackAbyssalJumps: settings.trackAbyssalJumps,
            logActivity: settings.logActivity,
          }}
        />
      </section>
      <hr className="border-border" />
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Auto-tagging</h2>
        <TaggingForm
          mapId={mapId}
          initialScheme={settings.tagScheme}
          initialHomeMapSystemId={settings.homeMapSystemId}
          initialExemptHomeStatic={settings.exemptHomeStaticFromTag}
          systems={systems}
        />
      </section>
    </div>
  );
}
