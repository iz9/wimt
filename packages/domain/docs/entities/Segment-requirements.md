# SessionSegment Entity - Business Requirements

## Domain Context

SessionSegment represents a continuous, uninterrupted period of time within a session. Each segment has a start time and an optional stop time. When a user pauses a session, the current segment is stopped. When they resume, a new segment begins. This allows tracking actual active work time rather than just total elapsed time.

**Examples:**

- Segment 1: 09:00 - 10:30 (90 minutes of focused work)
- Segment 2: 11:00 - 12:15 (75 minutes after coffee break)
- Segment 3: 13:00 - (still active, no stop time yet)

---

## Entity Type

**Entity** (NOT an Aggregate Root)

SessionSegment is an Entity because:

- It has a unique identifier (ULID)
- It has its own identity separate from other segments
- **BUT** it cannot exist independently of its parent Session
- It does not have its own repository
- It does not emit its own domain events
- Its lifecycle is managed entirely by the Session aggregate

---

## Properties

| Property    | Type        | Description                             | Mutability |
| ----------- | ----------- | --------------------------------------- | ---------- |
| `id`        | `ULID`      | Unique identifier for the segment       | Immutable  |
| `startedAt` | `DateTime`  | Timestamp when segment began            | Mutable\*  |
| `stoppedAt` | `DateTime?` | Timestamp when segment ended (optional) | Mutable    |

**Note:** `startedAt` and `stoppedAt` are mutable to support corrections via adjustment methods, but mutations must be done through Session aggregate to maintain invariants.

---

## Business Rules & Invariants

### 1. Start Time is Required

- **Rule:** Every segment must have a start time
- **Validation:** `startedAt` cannot be `null` or `undefined`
- **Enforcement:** Constructor validation
- **Error:** Throw invariant error if violated

### 2. Stop Time is Optional (for Active Segments)

- **Rule:** A segment can be active (no stop time) or completed (has stop time)
- **Validation:** `stoppedAt` can be `undefined` or a valid DateTime
- **Enforcement:** Constructor allows optional stoppedAt
- **Note:** Active state means segment is currently running

### 3. Stop Time Must Be After Start Time

- **Rule:** If segment has a stop time, it must be chronologically after start time
- **Validation:** `stoppedAt > startedAt`
- **Enforcement:** Validated when setting stoppedAt
- **Error:** Throw invariant error if violated
- **Edge Case:** stoppedAt === startedAt is invalid (zero duration)

### 4. Cannot Stop Already Stopped Segment

- **Rule:** Once a segment has stoppedAt set, it cannot be stopped again
- **Validation:** Check `stoppedAt === undefined` before setting
- **Enforcement:** Validated in stop() method
- **Error:** Throw domain error if already stopped

### 5. Duration Calculation

- **Rule:** Duration is always calculated, never stored
- **Formula:** `duration = stoppedAt - startedAt` (in milliseconds)
- **Active Segment:** For active segments, duration = current time - startedAt
- **Rationale:** Avoids data redundancy and ensures consistency

### 6. Adjustment Must Maintain Time Order

- **Rule:** When adjusting segment times, new times must maintain startedAt < stoppedAt
- **Validation:**
  - When adjusting `startedAt`: new value must be < `stoppedAt` (if segment is stopped)
  - When adjusting `stoppedAt`: new value must be > `startedAt`
- **Enforcement:** Validated in `adjustStartTime()` and `adjustStopTime()` methods
- **Error:** Throw invariant error if violated
- **Note:** Session aggregate must also validate no overlaps with other segments

---

## Commands

### CreateSegment

**Input:**

- `startedAt: DateTime` (required)
- `id?: ULID` (optional, for reconstruction from persistence)
- `stoppedAt?: DateTime` (optional, for reconstruction from persistence)

**Process:**

1. Validate startedAt is not null/undefined
2. Generate ULID if not provided
3. If stoppedAt provided, validate stoppedAt > startedAt
4. Create SessionSegment instance

**Output:**

- SessionSegment entity instance

**Events Emitted:**

- None (Session emits SessionStarted/SessionResumed)

---

### StopSegment

**Input:**

- `currentTime: DateTime` (time when segment should stop)

**Preconditions:**

- Segment must be active (stoppedAt === undefined)

**Process:**

1. Validate segment is active
2. Validate currentTime > startedAt
3. Set stoppedAt = currentTime
4. Calculate final duration

**Output:**

- Updated SessionSegment with stoppedAt set

**Events Emitted:**

- None (Session emits SessionPaused/SessionStopped)

---

### AdjustStartTime

**Input:**

- `newStartTime: DateTime` (new start time for the segment)

**Preconditions:**

- `newStartTime` is not null/undefined
- If segment is stopped: `newStartTime` must be < `stoppedAt`

**Process:**

1. Validate newStartTime is not null
2. If segment is stopped, validate newStartTime < stoppedAt
3. Set startedAt = newStartTime

**Output:**

- Updated SessionSegment with new startedAt

**Events Emitted:**

- None (Session emits SegmentAdjusted)

**Note:** Session aggregate must validate no overlaps after adjustment

---

### AdjustStopTime

**Input:**

- `newStopTime: DateTime` (new stop time for the segment)

**Preconditions:**

- `newStopTime` is not null/undefined
- `newStopTime` must be > `startedAt`

**Process:**

1. Validate newStopTime is not null
2. Validate newStopTime > startedAt
3. Set stoppedAt = newStopTime

**Output:**

- Updated SessionSegment with new stoppedAt

**Events Emitted:**

- None (Session emits SegmentAdjusted)

**Note:** Session aggregate must validate no overlaps after adjustment

---

## Domain Events

SessionSegment does **not** emit its own domain events. All events related to segments are emitted by the parent Session aggregate:

- `SessionStarted` - when first segment is created
- `SessionResumed` - when new segment is created after pause
- `SessionPaused` - when segment is stopped (paused)
- `SessionStopped` - when final segment is stopped
- `SegmentTooShort` - when segment is discarded due to duration < 300ms
- `SegmentAdjusted` - when segment times are manually corrected

This maintains the aggregate boundary and ensures Session remains the single source of events.

---

## Use Cases

### 1. Create Active Segment

**Actor:** Session Aggregate (internal)  
**Trigger:** User starts or resumes a session  
**Flow:**

1. Session aggregate calls CreateSegment
2. Segment created with startedAt = current time
3. Segment added to session's segments array
4. stoppedAt remains undefined (active)

**Business Value:** Tracks start of focused work period

---

### 2. Stop Active Segment

**Actor:** Session Aggregate (internal)  
**Trigger:** User pauses or stops a session  
**Flow:**

1. Session aggregate calls segment.stop(currentTime)
2. Segment validates it's active
3. Segment sets stoppedAt = currentTime
4. Session checks if duration >= 300ms
5. If too short, segment is discarded

**Business Value:** Tracks end of focused work period

---

### 3. Calculate Segment Duration

**Actor:** Session Aggregate or Read Model  
**Trigger:** Need to display or calculate time spent  
**Flow:**

1. If segment is stopped: duration = stoppedAt - startedAt
2. If segment is active: duration = currentTime - startedAt
3. Duration returned in milliseconds

**Business Value:** Provides accurate time tracking data

---

### 4. Adjust Segment Times

**Actor:** User (through Session aggregate)  
**Trigger:** User needs to correct segment times after tracking  
**Flow:**

1. User identifies segment with incorrect times
2. User provides new start time and/or stop time
3. Session aggregate calls segment.adjustStartTime() / adjustStopTime()
4. Segment validates new times maintain order (start < stop)
5. Session validates no overlaps with other segments
6. Session emits SegmentAdjusted event
7. System persists updated session

**Business Value:** Allows correction of mistakes without deleting/recreating sessions

---

## Relationships

### With Session Aggregate

- **Type:** Many-to-One (Many Segments belong to one Session)
- **Relationship:** Segment is a child entity within Session aggregate
- **Ownership:** Session owns and manages all segments
- **Navigation:** Session holds array of segments; Segment does not reference Session
- **Lifecycle:** Segments are created/deleted by Session
- **Persistence:** Segments are saved/loaded together with Session
- **Cascade:** Deleting Session deletes all its segments

---

## Validation Rules Summary

| Rule                           | Check                                   | Error Message                        |
| ------------------------------ | --------------------------------------- | ------------------------------------ |
| StartedAt Required             | `isNotNil(startedAt)`                   | "startedAt is required"              |
| StoppedAt After StartedAt      | `stoppedAt > startedAt`                 | "stoppedAt must be after startedAt"  |
| Cannot Stop Stopped            | `stoppedAt === undefined`               | "Segment is already stopped"         |
| Adjust StartTime - Not Null    | `isNotNil(newStartTime)`                | "newStartTime is required"           |
| Adjust StartTime - Before Stop | `newStartTime < stoppedAt` (if stopped) | "startedAt must be before stoppedAt" |
| Adjust StopTime - Not Null     | `isNotNil(newStopTime)`                 | "newStopTime is required"            |
| Adjust StopTime - After Start  | `newStopTime > startedAt`               | "stoppedAt must be after startedAt"  |

---

## Future Enhancements

### 1. Segment Location Tracking

- Add `location?: GeoCoordinates` property
- Track where user was during segment
- Privacy-aware: optional feature
- Useful for remote work or field work tracking

### 2. Segment Activity Metadata

- Add `metadata?: object` property
- Store app usage, keyboard activity, etc.
- Helps differentiate active vs idle time
- Privacy considerations important

### 3. Segment Pause Reason

- Add `pauseReason?: string` property
- Track why segment ended ("break", "meeting", "interruption")
- Helps analyze productivity patterns

---

## Design Decisions

### Why is SessionSegment NOT an Aggregate Root?

- **No Independent Lifecycle:** Segments only exist within a session
- **No Direct Repository Access:** Loaded/saved only through Session
- **Transactional Boundary:** Segment changes are part of session transaction
- **Event Source:** Session emits all events, not individual segments
- **Consistency:** Segment ordering/overlap rules require session-level enforcement

### Why is stoppedAt optional?

- **Active State Representation:** undefined stoppedAt means segment is currently running
- **Simplicity:** Single property instead of separate isActive flag
- **Type Safety:** TypeScript can distinguish active vs stopped segments
- **Clarity:** Explicitly shows that active segments have no end time yet

### Why calculate duration instead of storing it?

- **Single Source of Truth:** Duration is derived from startedAt and stoppedAt
- **No Synchronization Issues:** Cannot get out of sync with timestamps
- **Flexibility:** Can calculate duration using different currentTime for active segments
- **Storage Efficiency:** Saves one field per segment

### Why use ULID for segments?

- **Uniqueness:** Each segment needs unique identifier
- **Time Ordering:** ULIDs sort chronologically by default
- **Reference:** Can reference specific segments in logs/debugging
- **Future-proof:** Might need to reference segments individually later

### Why minimum 300ms threshold at Session level, not Segment level?

- **Separation of Concerns:** Segment represents raw time data
- **Business Logic Location:** Session enforces business rules
- **Reusability:** Segment is simple data container
- **Testing:** Easier to test business rules in one place (Session)

---

## Testing Requirements

### Unit Tests Required

1. **Create segment with startedAt**
   - Creates segment with provided startedAt
   - Generates ULID automatically
   - stoppedAt is undefined
   - Segment is active

2. **Create segment with all parameters**
   - Accepts optional id and stoppedAt
   - Uses provided values instead of generating
   - Segment is not active if stoppedAt provided

3. **StartedAt validation - null**
   - Throws error when startedAt is null

4. **StartedAt validation - undefined**
   - Throws error when startedAt is undefined

5. **Stop active segment**
   - Sets stoppedAt to provided time
   - Validates stoppedAt > startedAt
   - Segment becomes inactive

6. **Stop segment - time validation**
   - Throws error if stoppedAt <= startedAt
   - Throws error if stoppedAt === startedAt (zero duration)

7. **Stop already stopped segment**
   - Throws error when segment already has stoppedAt

8. **Duration calculation - stopped segment**
   - Returns stoppedAt - startedAt
   - Returns value in milliseconds

9. **Duration calculation - active segment**
   - Returns currentTime - startedAt
   - Accepts currentTime parameter
   - Returns value in milliseconds

10. **Property immutability**
    - `id` cannot be changed after creation

11. **Adjust start time**
    - Updates startedAt to new value
    - Validates new start time < stop time (if stopped)
    - Throws error if validation fails

12. **Adjust start time - validation**
    - Throws error when newStartTime is null/undefined
    - Throws error when newStartTime >= stoppedAt (for stopped segments)

13. **Adjust stop time**
    - Updates stoppedAt to new value
    - Validates new stop time > start time
    - Throws error if validation fails

14. **Adjust stop time - validation**
    - Throws error when newStopTime is null/undefined
    - Throws error when newStopTime <= startedAt

15. **Edge cases**
    - Handles very short durations (< 1ms) correctly
    - Handles very long durations (days/weeks) correctly
    - Handles startedAt and stoppedAt with same timestamp error

---

## Related Documents

- [EventStorming Session - 2025-11-25](../eventStorming/eventStorming-19-11-25.md)
- [Session Requirements](./Session-requirements.md)
- [Entity Pattern](../theory/entities-vs-value-objects.md)
- [Aggregate Pattern](../theory/aggregate-root-pattern.md)

---

**Last Updated:** 2025-11-24  
**Status:** In Progress - SessionSegment with adjustment logic  
**Next Steps:** Implement SessionSegment entity as part of Session aggregate
