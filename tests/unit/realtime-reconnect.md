## realtime-reconnect.test.tsx

**Purpose:** Proves `useReconnectResync` fires its callback when the realtime socket returns to `open` after a disconnect — and never on the initial mount-open — closing the reconnect-backfill gap (the SharedWorker resumes only NEW events on reconnect, so the canvas must refetch to recover the gap).
**File:** `tests/unit/realtime-reconnect.test.tsx`

### Setup
- Reuses the Stage 1 harness pattern: stubs `globalThis.SharedWorker` with a `FakeSharedWorker` whose `port` (a `FakePort`) is captured in a module-level `lastPort`. The provider sets `port.onmessage` and calls `port.start()`; the test drives status transitions by invoking `port.onmessage({ data: { type: 'status', status } })`.
- Renders with `react-dom/client` `createRoot` + React's `act` (sets `IS_REACT_ACT_ENVIRONMENT`) so mount effects flush. No `@testing-library/react` dependency.
- A `Probe` component calls `useReconnectResync(spy)`; `spy` is a `vi.fn()`.

### Cases
- **does not resync on the initial mount-open** — provider boots at `connecting`; drive `→ open`; assert `spy` not called (page-load snapshot is already fresh).
- **resyncs once when the socket reopens after a disconnect** — drive `open → degraded → open`; assert `spy` called exactly once.
- **resyncs again on a second disconnect→reopen, but not on a repeat open** — after a first reconnect, a second `open` with no intervening disconnect does not fire; a later `closed → open` fires again (asserts the disconnect flag re-arms per gap).

### Depends On
- `@/lib/realtime/useRealtime` (`RealtimeProvider`, `useReconnectResync`, `RealtimeStatus` type).
