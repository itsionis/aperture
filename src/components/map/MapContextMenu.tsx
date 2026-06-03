'use client';

import { Menu as MenuPrimitive } from '@base-ui/react/menu';

import type { MapContextMenuTarget } from '@/types';
import { MenuItem } from '@/components/ui/menu';
import { cn } from '@/lib/utils';

/**
 * Controlled, cursor-anchored context menu for the map canvas. Driven entirely
 * by `target`: when non-null the menu opens, anchored to the stored client x/y
 * via a virtual anchor element. Items are stubbed for now (one disabled
 * placeholder per kind) — the `switch` below is the single spot real items get
 * added later.
 */
export function MapContextMenu({
  target,
  onClose,
}: {
  target: MapContextMenuTarget | null;
  onClose: () => void;
}) {
  // A zero-size virtual element at the cursor point; recreated per render so the
  // rect tracks the current target's coordinates.
  const anchor = target
    ? {
        getBoundingClientRect: () =>
          ({
            x: target.x,
            y: target.y,
            width: 0,
            height: 0,
            top: target.y,
            left: target.x,
            right: target.x,
            bottom: target.y,
          }) as DOMRect,
      }
    : null;

  return (
    <MenuPrimitive.Root
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          anchor={anchor}
          side="right"
          align="start"
          className="z-50 outline-none"
        >
          <MenuPrimitive.Popup
            data-slot="map-context-menu"
            className={cn(
              'min-w-40 overflow-hidden rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0',
            )}
          >
            {renderItems(target)}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

function renderItems(target: MapContextMenuTarget | null) {
  if (!target) return null;
  switch (target.kind) {
    case 'system':
      return <MenuItem disabled>System actions</MenuItem>;
    case 'connection':
      return <MenuItem disabled>Connection actions</MenuItem>;
    case 'pane':
      return <MenuItem disabled>Map actions</MenuItem>;
  }
}
