# Offline-First Patterns

## Building for the Real World

Mobile devices are unreliable. They lose connection in elevators, subways, and remote areas. An **Offline-First** app works 100% without internet and syncs when possible.

### Key Principle

> "The network is an optimization, not a requirement."

---

## 1. Local-First Architecture

**Concept:** The "Source of Truth" for the UI is the **Local Database**, not the API.

**Flow:**

1. User performs action (Create Session).
2. App writes to **Local DB** (SQLite/WatermelonDB).
3. UI updates **immediately** from Local DB.
4. **Sync Engine** runs in background to push changes to API.

**Diagram:**

```
[UI] <---> [Local DB] <---> [Sync Engine] <---> [API]
```

---

## 2. Optimistic UI Updates

**Concept:** Assume success. Update the UI immediately, then revert if it fails.

**Implementation (React Query):**

```typescript
const queryClient = useQueryClient();

useMutation({
  mutationFn: (newSession) => api.createSession(newSession),

  onMutate: async (newSession) => {
    // 1. Cancel outgoing refetches
    await queryClient.cancelQueries(["sessions"]);

    // 2. Snapshot previous value
    const previousSessions = queryClient.getQueryData(["sessions"]);

    // 3. Optimistically update local cache
    queryClient.setQueryData(["sessions"], (old) => [...old, newSession]);

    // 4. Return context with snapshot
    return { previousSessions };
  },

  onError: (err, newSession, context) => {
    // 5. Rollback on error
    queryClient.setQueryData(["sessions"], context.previousSessions);
    Alert.alert("Sync Failed", "Could not save session.");
  },

  onSettled: () => {
    // 6. Refetch to ensure consistency
    queryClient.invalidateQueries(["sessions"]);
  },
});
```

---

## 3. Sync Strategies

### A. Queue-Based Sync (Outbox Pattern)

When offline, actions go into a persistent **Outbox Queue**.

1. **Action:** `CreateSession { id: 1, name: 'Work' }`
2. **Store:** Save to `Outbox` table.
3. **Worker:** Watch network status.
4. **Online:** Process queue FIFO.
   - Send Request 1 -> Success -> Delete from Queue.
   - Send Request 2 -> Fail -> Retry later.

### B. Delta Sync (Soft Sync)

Don't download the whole database. Download only what changed since last sync.

**Request:** `GET /sync?last_synced_at=2023-10-27T10:00:00Z`
**Response:**

```json
{
  "changes": {
    "sessions": {
      "created": [...],
      "updated": [...],
      "deleted": ["id_1", "id_2"]
    }
  },
  "timestamp": "2023-10-27T11:00:00Z"
}
```

---

## 4. Conflict Resolution

What if User A edits on Phone 1 (Offline) and User B edits on Phone 2 (Online)?

### Strategy 1: Last Write Wins (LWW)

The update with the latest timestamp overwrites the other.

- ✅ Simple.
- ❌ Data loss risk.

### Strategy 2: Client Wins

The device currently syncing overwrites the server.

- ✅ User sees their changes.
- ❌ Overwrites other users.

### Strategy 3: Server Wins

The server rejects the conflict. Client must fetch new version and re-apply.

- ✅ Safe.
- ❌ Bad UX (User has to redo work).

### Strategy 4: Semantic Resolution (Merge)

Combine changes intelligently.

- **Example:** User A changed `Name`, User B changed `Color`.
- **Result:** New Name + New Color.

---

## 5. Background Sync

Mobile OSs (iOS/Android) restrict background execution.

**Tools:**

- **React Native Background Fetch:** Wake up app every 15m.
- **WorkManager (Android) / BGTasks (iOS):** Schedule jobs.

**Best Practice:**

- Don't rely on background sync for critical data.
- Trigger sync on **App Resume** (Foreground).
- Trigger sync on **Network Regained**.

---

## 6. Offline Storage Options

### 1. SQLite (react-native-quick-sqlite)

- ✅ SQL queries, relational, fast.
- ✅ Good for complex data.
- ❌ Requires schema management.

### 2. WatermelonDB

- ✅ Built on SQLite but reactive (Observable).
- ✅ Lazy loading.
- ✅ Excellent for React Native.

### 3. MMKV

- ✅ Key-Value storage (fastest).
- ✅ Synchronous.
- ❌ Not for relational data (only settings/cache).

### 4. Realm

- ✅ Object database, fast.
- ✅ Built-in sync (if using Atlas Device Sync).
- ❌ Large binary size.

---

## Summary

**Local-First:** Treat local DB as primary.
**Optimistic UI:** Show changes instantly.
**Outbox Pattern:** Queue offline actions.
**Conflict Resolution:** Plan for collisions (LWW or Merge).
**Storage:** Choose SQLite/WatermelonDB for structured data.

**Goal:** The user should never see a loading spinner for a write action.

---

## Related Documents

- [React Native Integration](./react-native-integration.md)
- [Persistence Patterns](./persistence-patterns.md)
- [Repositories](./repositories.md)

---

## References

- **Offline First** (offlinefirst.org)
- **Designing Data-Intensive Applications** by Martin Kleppmann
- **Building Offline-First Apps** (Google Developers)
