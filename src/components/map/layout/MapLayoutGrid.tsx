'use client';

import 'react-grid-layout/css/styles.css';

import {
  Responsive as ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import { type ReactNode, useMemo } from 'react';

import { PANEL_BREAKPOINTS, PANEL_COLS } from '@/lib/map/layout/panels';
import type { Breakpoint } from '@/types';

import { PANEL_DRAG_HANDLE_CLASS, PANEL_NO_DRAG_CLASS } from './MapPanel';

// Pixel height of one grid row; a layout item's `h` multiplies this.
const ROW_HEIGHT = 40;
// [horizontal, vertical] gap between grid items, in px.
const GRID_MARGIN: readonly [number, number] = [8, 8];

export interface MapLayoutGridProps {
  /** Per-breakpoint arrangements; each item's `i` matches a child's `key`. */
  layouts: Record<Breakpoint, Layout>;
  /** RGL fires this on every drag/resize with the active + all-breakpoint layouts. */
  onLayoutChange: (current: Layout, all: ResponsiveLayouts<Breakpoint>) => void;
  /** One element per visible panel, each keyed by its `PanelId`. */
  children: ReactNode;
}

export function MapLayoutGrid({ layouts, onLayoutChange, children }: MapLayoutGridProps) {
  // ResizeObserver-based width (replaces the SSR-hostile WidthProvider). `mounted`
  // gates the grid until a real width is measured, avoiding a hydration flash.
  const { width, containerRef, mounted } = useContainerWidth();

  const dragConfig = useMemo(
    () => ({ handle: `.${PANEL_DRAG_HANDLE_CLASS}`, cancel: `.${PANEL_NO_DRAG_CLASS}` }),
    [],
  );

  return (
    <div ref={containerRef} className="h-full w-full">
      {mounted ? (
        <ResponsiveGridLayout<Breakpoint>
          width={width}
          breakpoints={PANEL_BREAKPOINTS}
          cols={PANEL_COLS}
          layouts={layouts}
          rowHeight={ROW_HEIGHT}
          margin={GRID_MARGIN}
          dragConfig={dragConfig}
          onLayoutChange={onLayoutChange}
        >
          {children}
        </ResponsiveGridLayout>
      ) : (
        // First paint before measurement: a plain stacked fallback.
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}
