import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider, useReconnectResync, type RealtimeStatus } from '@/lib/realtime/useRealtime';

// Fake SharedWorker port: the provider sets `onmessage` and calls `start()`;
// the test drives status transitions by invoking `onmessage` with status frames.
// The most recently constructed port is captured so the test can fire at it.
class FakePort {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  start = vi.fn();
  close = vi.fn();
}

let lastPort: FakePort | null = null;

class FakeSharedWorker {
  port: FakePort;
  constructor() {
    this.port = new FakePort();
    lastPort = this.port;
  }
}

function Probe({ onReconnect }: { onReconnect: () => void }) {
  useReconnectResync(onReconnect);
  return null;
}

describe('reconnect resync', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal('SharedWorker', FakeSharedWorker);
    lastPort = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function mount(onReconnect: () => void): FakePort {
    act(() => {
      root.render(
        <RealtimeProvider>
          <Probe onReconnect={onReconnect} />
        </RealtimeProvider>,
      );
    });
    expect(lastPort).not.toBeNull();
    return lastPort!;
  }

  function drive(port: FakePort, status: RealtimeStatus) {
    act(() => port.onmessage!({ data: { type: 'status', status } } as MessageEvent));
  }

  it('does not resync on the initial mount-open', () => {
    const onReconnect = vi.fn();
    const port = mount(onReconnect);
    // Provider boots at 'connecting'; the first 'open' is the page-load snapshot,
    // which is already fresh — no resync.
    drive(port, 'open');
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('resyncs once when the socket reopens after a disconnect', () => {
    const onReconnect = vi.fn();
    const port = mount(onReconnect);
    drive(port, 'open');
    drive(port, 'degraded');
    drive(port, 'open');
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('resyncs again on a second disconnect→reopen, but not on a repeat open', () => {
    const onReconnect = vi.fn();
    const port = mount(onReconnect);
    drive(port, 'open');
    drive(port, 'degraded');
    drive(port, 'open'); // first reconnect → fires
    drive(port, 'open'); // no intervening disconnect → no fire
    expect(onReconnect).toHaveBeenCalledTimes(1);
    drive(port, 'closed');
    drive(port, 'open'); // second reconnect → fires
    expect(onReconnect).toHaveBeenCalledTimes(2);
  });
});
