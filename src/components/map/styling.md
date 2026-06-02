## styling.ts

**Purpose:** Pure styling helpers translating system status, system class, and connection state into SVG-safe colours/strokes for the map canvas.
**File:** `src/components/map/styling.ts`

---

### systemClassColor(cls: string | null | undefined): string
Maps a `universe_system.security` or `universe_wormhole.target_class` label to a hex colour.
- `H` green, `L` orange, `0.0` firetruck-red, `P` (Pochven) deep rose-red, `A` (Abyssal) teal.
- `C1`–`C6` progress from sky-blue → cyan → emerald → amber → orange → orangy-red.
- Unknown/null → grey `#6b7280`.

### systemStatusColor(status): string
Maps a `system_status` enum value to a hex colour (unknown→grey, friendly→blue, occupied→amber, hostile→red, empty→green, unscanned→purple).

### homeAccentColor(): string
Returns the amber/gold accent (`#fbbf24`) used to mark the map's designated Home system (accent ring + header icon in `SystemNode`). Deliberately distinct from the status palette so it never reads as a system status.

### connectionStyle(edge: MapConnectionEdge): EdgeStyle
Returns `{ stroke, strokeWidth, strokeDasharray? }`. Scope sets the base colour; wormholes are recoloured by `massStatus` (fresh/reduced/critical). `eolStage` dashes the line — `critical` (1h) dashes tighter (`2 3`) than `eol` (4h, `6 4`) to read as more urgent; `jumpMassClass === 's'` thins the stroke (frigate/small holes).

### connectionBadges(edge: MapConnectionEdge): string[]
Short labels for a connection: jump-mass class (`S`/`M`/`L`/`XL`), then `EOL` (eol stage) or `EOL 1h` (critical stage), `ROLL`, `PRES`.

### Notes
- Colours mirror legacy semantics, not exact legacy hex. Kept out of Tailwind tokens because they're consumed inside SVG/inline styles.
