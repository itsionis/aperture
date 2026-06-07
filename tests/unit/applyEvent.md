## applyEvent.test.ts

**Purpose:** Unit coverage for the pure `applyEvent` reducer — specifically the `connection.delete` cascade that mirrors the `ON DELETE CASCADE` on `ap_map_signature.map_connection_id`.
**File:** `tests/unit/applyEvent.test.ts`

No DB required (pure function, jsdom env). Builds minimal `MapViewData` fixtures.

Cases:
1. **Cascade**: a connection with one linked signature (`mapConnectionId` set) and one unlinked (`null`); applying `connection.delete` removes the connection AND the linked signature, leaving the unlinked one. Guards the "Signature not found." orphan bug: the server only emits `connection.delete` while Postgres silently cascade-deletes the signature row, so the reducer must drop it client-side.
2. **Isolation**: with two connections each carrying a linked signature, deleting one connection drops only its own signature and leaves the other connection + signature intact.
