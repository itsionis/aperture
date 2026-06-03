'use client';

import { GripVertical, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/types';

// The grid's `dragConfig.handle` selector targets this class so only the grip
// icon at the header's left edge initiates a drag — the rest of the header and
// the panel body (e.g. the ReactFlow canvas) keep their own pointer events
// (pan/zoom/box-select, header control clicks).
export const PANEL_DRAG_HANDLE_CLASS = 'ap-panel-drag';
// react-draggable's `cancel` selector: pointers starting inside this class never
// begin a drag, so header controls (the hide button, `headerRight` actions)
// stay clickable even though they live on the drag handle.
export const PANEL_NO_DRAG_CLASS = 'nodrag';

export interface MapPanelProps {
  id: PanelId;
  title: string;
  onHide: (id: PanelId) => void;
  headerRight?: ReactNode;
  /**
   * Overrides the body's default `min-h-0 flex-1 overflow-auto p-0` styling. The
   * canvas panel passes `min-h-0 flex-1 overflow-hidden p-0` so ReactFlow fills a
   * clean, padding-free, definite-height cell instead of a scrolling inset.
   */
  contentClassName?: string;
  children: ReactNode;
}

export function MapPanel({
  id,
  title,
  onHide,
  headerRight,
  contentClassName,
  children,
}: MapPanelProps) {
  return (
    <Card className="h-full gap-0 py-0">
      <div className="flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5">
        <GripVertical
          className={cn(
            PANEL_DRAG_HANDLE_CLASS,
            'size-3.5 shrink-0 cursor-move text-muted-foreground',
          )}
          aria-label="Drag panel"
        />
        <span className="truncate font-heading text-sm font-medium">{title}</span>
        <div className={cn(PANEL_NO_DRAG_CLASS, 'ml-auto flex items-center gap-1')}>
          {headerRight}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Hide ${title}`}
            onClick={() => onHide(id)}
          >
            <X />
          </Button>
        </div>
      </div>
      <div
        className={cn(
          // Card-in-card dedupe: most modules render their own <Card> as the body's
          // direct child. Strip that card's frame (ring + rounded corners) so the
          // panel reads as a single card — the module keeps its own inner padding,
          // header and any nested sub-cards. The canvas body is a plain div, so this
          // variant simply doesn't match it.
          '[&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:ring-0',
          contentClassName ?? 'min-h-0 flex-1 overflow-auto p-0',
        )}
      >
        {children}
      </div>
    </Card>
  );
}
