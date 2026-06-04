'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchWormholeTypes } from '@/lib/map/client';
import type { WormholeTypeOption } from '@/types';

const NONE_VALUE = '__none__';

/**
 * Class-filtered wormhole-type dropdown for the signature inspector
 * (SPEC §6.4). Lazy-loads options from `/api/map/[mapId]/wormhole-types?systemId=`
 * when mounted, then keeps them in a per-(mapId, universeSystemId) cache so
 * swapping between systems doesn't re-fetch.
 */
export function WormholeTypeSelect({
  mapId,
  universeSystemId,
  value,
  onValueChange,
  disabled,
}: {
  mapId: string;
  universeSystemId: number;
  /** Selected `universe_wormhole.type_id`, or null when unset. */
  value: number | null;
  onValueChange: (next: number | null) => void;
  disabled?: boolean;
}) {
  // Combine `loading` and `options` in one state object so the effect body only
  // calls `setState` from the async resolver — never synchronously during the
  // effect run (which would trip the cascading-render lint rule).
  const [state, setState] = useState<{ loading: boolean; options: WormholeTypeOption[] }>({
    loading: true,
    options: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetchWormholeTypes({ mapId, universeSystemId }).then((result) => {
      if (cancelled) return;
      setState({ loading: false, options: result.ok ? result.data : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [mapId, universeSystemId]);

  const { loading, options } = state;

  const items = useMemo(() => {
    const labels: Record<string, string> = { [NONE_VALUE]: 'Select type…' };
    for (const opt of options) labels[String(opt.typeId)] = opt.name;
    return labels;
  }, [options]);

  // Pin the system's statics to the top so they're the first thing the user
  // sees; the rest keep the server's alphabetical order.
  const { statics, others } = useMemo(() => {
    const statics: WormholeTypeOption[] = [];
    const others: WormholeTypeOption[] = [];
    for (const opt of options) (opt.isStatic ? statics : others).push(opt);
    return { statics, others };
  }, [options]);

  const stringValue = value == null ? NONE_VALUE : String(value);

  return (
    <Select<string>
      value={stringValue}
      onValueChange={(next) => {
        if (!next || next === NONE_VALUE) onValueChange(null);
        else onValueChange(Number(next));
      }}
      items={items}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{loading ? 'Loading…' : 'Select type…'}</SelectItem>
        {statics.length > 0 && (
          <>
            <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-medium uppercase text-muted-foreground">
              Statics
            </div>
            {statics.map((opt) => (
              <SelectItem key={opt.typeId} value={String(opt.typeId)}>
                {opt.name}
                {opt.targetClass ? ` → ${opt.targetClass}` : ''}
              </SelectItem>
            ))}
            {others.length > 0 && <div className="my-1 h-px bg-border" />}
          </>
        )}
        {others.map((opt) => (
          <SelectItem key={opt.typeId} value={String(opt.typeId)}>
            {opt.name}
            {opt.targetClass ? ` → ${opt.targetClass}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
