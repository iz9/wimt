# Event Sourcing

## What is Event Sourcing?

**Event Sourcing** is a pattern where the state of an application is determined by a sequence of events. Instead of storing just the _current state_ of data in a domain, we store a log of _everything that happened_.

### Key Principle

> "Don't store the current state. Store the facts that led to it."

**Traditional (State-Oriented):**

- Table: `Sessions`
- Row: `{ id: 1, status: 'PAUSED', duration: 500 }`
- **Problem:** We lost the history. When was it paused? How many times?

**Event Sourcing:**

- Table: `Events`
- Rows:
  1. `SessionStarted { id: 1, at: 10:00 }`
  2. `SessionPaused { id: 1, at: 10:30 }`
  3. `SessionResumed { id: 1, at: 10:35 }`
  4. `SessionStopped { id: 1, at: 10:40 }`
- **Current State:** Calculated by replaying events (10:00 -> 10:30 = 30m, 10:35 -> 10:40 = 5m, Total = 35m).

---

## How It Works

### 1. The Event Store

The database only stores events. It is an append-only log. Events are immutable facts.

```typescript
interface EventStore {
  save(
    streamId: ULID,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void>;
  load(streamId: ULID): Promise<DomainEvent[]>;
}
```

### 2. Rehydration (Replay)

To get an aggregate, we load its history and replay it.

```typescript
class Session extends AggregateRoot {
  // Internal state
  private _status: SessionStatus;
  private _segments: Segment[];

  // Reconstitute from history
  static loadFromHistory(events: DomainEvent[]): Session {
    const session = new Session();
    for (const event of events) {
      session.apply(event); // Update internal state
    }
    return session;
  }

  // Apply event to update state
  private apply(event: DomainEvent) {
    if (event instanceof SessionStarted) {
      this._status = "ACTIVE";
      this._segments.push(new Segment(event.startTime));
    } else if (event instanceof SessionPaused) {
      this._status = "PAUSED";
      this.currentSegment.stop(event.pausedAt);
    }
  }
}
```

### 3. Projections (Read Models)

Querying the event stream is slow and hard. We create **Read Models** (Projections) optimized for queries.

- **Events:** `SessionStarted`, `SessionStopped`
- **Projection:** `DailySummary` table (SQL)

When an event happens, a background worker updates the Read Model.

```typescript
class DailySummaryProjector {
  on(event: SessionStopped) {
    const day = toDay(event.stoppedAt);
    db.run(
      "UPDATE daily_summaries SET total_duration = total_duration + ? WHERE day = ?",
      [event.duration, day],
    );
  }
}
```

---

## Benefits

1. **Complete Audit Log:** You know exactly what happened and when. Zero data loss.
2. **Time Travel:** You can reconstruct the state of the system at any point in time.
3. **Temporal Queries:** "How many sessions were active at 2 PM yesterday?"
4. **Debuggability:** Copy the event stream to a dev machine and replay to reproduce bugs exactly.

---

## Challenges

1. **Complexity:** Much harder to implement than CRUD.
2. **Event Versioning:** What happens when the event structure changes? (Need upgraders).
3. **Eventual Consistency:** Read models might lag behind write models.
4. **Storage Size:** Event streams grow forever (need Snapshots).

---

## Snapshots

To avoid replaying 1,000,000 events, we save a **Snapshot** every N events.

1. Load Snapshot (Version 1000).
2. Load Events (1001 - 1005).
3. Apply Events.

```typescript
interface SnapshotStore {
  save(id: ULID, snapshot: SessionSnapshot): Promise<void>;
  load(id: ULID): Promise<SessionSnapshot | null>;
}
```

---

## When to Use It

✅ **High Audit Requirements:** Finance, Legal, Healthcare.
✅ **Complex Business Logic:** Where the _sequence_ of changes matters more than the result.
✅ **Collaborative Domains:** Google Docs, Trello (many users editing same thing).
✅ **Analytics-Heavy:** You need to derive many different reports from the same data.

## When NOT to Use It

❌ **Simple CRUD:** Overkill for a blog or simple settings.
❌ **High Performance Reads:** If you need instant consistency.
❌ **Small Team:** High learning curve.

---

## Summary

**Event Sourcing** persists the _history_ of changes, not the current state.
**Aggregates** are rehydrated by replaying events.
**Projections** provide optimized views for querying (CQRS).
**Snapshots** optimize performance for long streams.

**Power:** Infinite history, time travel, perfect audit.
**Cost:** Complexity, eventual consistency.

---

## Related Documents

- [Domain Events](./domain-events.md)
- [CQRS](./commands-and-queries.md)
- [Read Models](./read-models-query-optimization.md)

---

## References

- **Event Sourcing** by Martin Fowler
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Versioning in an Event Sourced System** by Greg Young
