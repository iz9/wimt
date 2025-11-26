# Session Entity - Business Requirements

## Domain Context

Session represents a time tracking activity for a specific category. A session consists of one or more time segments that track when the user is actively working on that category. Users can start, pause, resume, and stop sessions, creating a timeline of focused activity periods.

**Examples:**

- A "Work" session with 3 segments: 9:00-10:30, 11:00-12:00, 13:00-14:15
- A "Hobby" session paused multiple times throughout the day

---

## Entity Type

**Aggregate Root** ✓

Session is an Aggregate Root because:

- It has its own lifecycle independent of other entities
- It has a unique identifier (ULID)
- It is the entry point for all session-related operations
- It manages the lifecycle of its child entities (Segments)
- It can be directly loaded/saved via repository
- It emits its own domain events
- It enforces consistency boundaries for its segments

---

## Properties

| Property        | Type                     | Description                                    | Mutability           |
| --------------- | ------------------------ | ---------------------------------------------- | -------------------- |
| `id`            | `ULID`                   | Unique identifier for the session              | Immutable            |
| `categoryId`    | `ULID`                   | Reference to the category being tracked        | Immutable            |
| `activeSegment` | `SessionSegment \| null` | Currently active segment (0 or 1)              | Mutable              |
| `history`       | `SessionSegment[]`       | Array of stopped/validated segments            | Mutable              |
| `createdAt`     | `DateTime`               | Timestamp when session was created (started)   | Immutable            |
| `stoppedAt`     | `DateTime \| null`       | Timestamp when session was finalized (stopped) | Mutable (write-once) |

---

## Session States

A session can be in one of three states, determined by the state of its segments and the `stoppedAt` property:

| State       | Last Segment State | Session.stoppedAt | Can Resume? | Can Pause? | Can Stop? | Description                        |
| ----------- | ------------------ | ----------------- | ----------- | ---------- | --------- | ---------------------------------- |
| **Active**  | `active`           | `null`            | ❌ No       | ✅ Yes     | ✅ Yes    | Currently tracking time            |
| **Paused**  | `stopped`          | `null`            | ✅ Yes      | ❌ No      | ✅ Yes    | Temporarily paused, can be resumed |
| **Stopped** | `stopped`          | `!== null`        | ❌ No       | ❌ No      | ❌ No     | Finalized and immutable            |

**Key Distinction:**

- **Paused sessions** have all segments stopped BUT `session.stoppedAt === null`, meaning they can still be resumed
- **Stopped sessions** have `session.stoppedAt !== null`, marking them as finalized/immutable and preventing any further modifications

**State Computation:**

```typescript
get state(): SessionState {
  // If session itself is stopped, it's finalized
  if (this.stoppedAt !== null) return "stopped";

  // Check active segment
  if (this.activeSegment !== null) return "active";

  // No active segment and not stopped = paused
  return "paused";
}
```

---

## Business Rules & Invariants

### 1. Category Reference is Required

- **Rule:** Session must always reference a valid category
- **Validation:** `categoryId` cannot be `null` or `undefined`
- **Enforcement:** Constructor validation
- **Error:** Throw invariant error if violated

### 2. At Most One Active Segment

- **Rule:** A session can have at most one active segment
- **Validation:** `activeSegment` is either `null` (paused/stopped) or contains one `SessionSegment` (active)
- **Enforcement:** Type system guarantees this invariant through `SessionSegment | null` type
- **Note:** Active sessions have `activeSegment !== null`, paused/stopped sessions have `activeSegment === null`

### 3. No Overlapping Segments

- **Rule:** Segment time ranges must not overlap
- **Validation:** `activeSegment.startedAt` must be after last history segment's `stoppedAt`
- **Enforcement:** Validated when resuming session (adding new active segment)
- **Error:** Throw invariant error if overlapping detected

### 4. History Segments Are Immutable and Ordered

- **Rule:** History segments are chronologically ordered and immutable
- **Validation:** `history[i].startedAt < history[i+1].startedAt`
- **Enforcement:** History is only appended to (never modified) when pausing with valid duration
- **Note:** History only contains validated segments (>= 300ms duration)

### 5. Cannot Pause Already Paused Session

- **Rule:** Can only pause if there's an active segment
- **Validation:** Check if last segment has `stoppedAt === undefined`
- **Enforcement:** `pause()` method validation
- **Error:** Throw domain error if already paused

### 6. Cannot Resume Already Active Session

- **Rule:** Can only resume if session is currently paused
- **Validation:** Check if last segment has `stoppedAt !== undefined`
- **Enforcement:** `resume()` method validation
- **Error:** Throw domain error if already active

### 7. Cannot Stop Already Stopped Session

- **Rule:** Session can only be stopped once (finalized)
- **Validation:** Check that `stoppedAt === null`
- **Enforcement:** `stop()` method validation
- **Error:** Throw domain error if `stoppedAt !== null`
- **Note:** Once stopped, session is immutable and cannot be resumed, paused, or modified

### 8. Stopped Sessions Are Immutable

- **Rule:** Once a session is stopped (`stoppedAt !== null`), it cannot be modified
- **Validation:** All mutation methods (`pause()`, `resume()`, etc.) must check `stoppedAt === null`
- **Enforcement:** Guard clauses in all mutation methods
- **Error:** Throw domain error if attempting to modify stopped session
- **Purpose:** Ensure finalized sessions remain accurate for duration calculations and reporting

### 9. Minimum Segment Duration

- **Rule:** Segments shorter than 300ms are discarded (not added to history)
- **Validation:** `activeSegment.durationMs >= 300ms` before adding to history
- **Enforcement:** When pausing/stopping, check `activeSegment.durationMs` before pushing to history
- **Event:** Emit `SegmentTooShort` if segment is discarded, `SessionPaused` only if kept
- **Rationale:** Prevents accidental clicks from creating meaningless data
- **Implementation:** If duration < 300ms, set `activeSegment = null` without adding to history

---

## Commands

### StartSession

**Input:**

- `categoryId: ULID` (required)
- `id?: ULID` (optional, for reconstruction from persistence)
- `createdAt?: DateTime` (optional, for reconstruction from persistence)

**Process:**

1. Validate categoryId is not null/undefined
2. Generate ULID if not provided
3. Set createdAt to current time if not provided
4. Create Session instance with empty history array
5. Create first active segment with current timestamp
6. Set `activeSegment` to the new segment
7. Emit `SessionStarted` event

**Output:**

- Session aggregate instance with `activeSegment` set and empty history

**Events Emitted:**

- `SessionStarted`

---

### PauseSession

**Input:**

- `sessionId: ULID` (session to pause)
- `currentTime: DateTime` (time when pause occurred)

**Preconditions:**

- Session must have an active segment (`activeSegment !== null`)
- Session must not be stopped (`stoppedAt === null`)

**Process:**

1. Validate `activeSegment !== null`
2. Stop the active segment with `currentTime`
3. Calculate segment duration
4. If duration < 300ms:
   - Discard segment (don't add to history)
   - Set `activeSegment = null`
   - Emit `SegmentTooShort` event
5. Else:
   - Add segment to history array
   - Set `activeSegment = null`
   - Emit `SessionPaused` event

**Output:**

- Updated Session with `activeSegment = null` and potentially updated history

**Events Emitted:**

- `SessionPaused` OR `SegmentTooShort`

---

### ResumeSession

**Input:**

- `sessionId: ULID` (session to resume)
- `currentTime: DateTime` (time when resume occurred)

**Preconditions:**

- Session must be paused (`activeSegment === null` and `stoppedAt === null`)

**Process:**

1. Validate `activeSegment === null` and `stoppedAt === null`
2. Create new SessionSegment with `startedAt = currentTime`
3. Set `activeSegment` to the new segment
4. Emit `SessionResumed` event

**Output:**

- Updated Session with `activeSegment` set to new segment

**Events Emitted:**

- `SessionResumed`

---

### StopSession

**Input:**

- `sessionId: ULID` (session to stop)
- `currentTime: DateTime` (time when stop occurred)

**Preconditions:**

- Session must exist and not be already stopped (`stoppedAt === null`)

**Process:**

1. Validate `stoppedAt === null`
2. If `activeSegment !== null`:
   - Stop the active segment with `currentTime`
   - Check segment duration
   - If duration >= 300ms: add to history, else emit `SegmentTooShort`
   - Set `activeSegment = null`
3. Set `session.stoppedAt = currentTime` (finalize session)
4. Calculate total duration from history segments
5. Emit `SessionStopped` event with total duration

**Output:**

- Finalized Session with `stoppedAt` set, `activeSegment = null`, and validated history

**Events Emitted:**

- `SessionStopped`
- (Optionally `SegmentTooShort` if last segment was too short)

**Important:** Once stopped, the session becomes **immutable** and cannot be resumed or modified

---

## Domain Events

### SessionStarted

**When:** User starts tracking time for a category

**Data:**

- `sessionId: ULID` - ID of the created session
- `categoryId: ULID` - Category being tracked
- `startedAt: DateTime` - When session started
- `occurredAt: DateTime` - When the event occurred

**Subscribers (future):**

- UI layer - Update active session indicator
- Analytics - Track session patterns
- Read model - Update session timeline view

---

### SessionPaused

**When:** User pauses an active session

**Data:**

- `sessionId: ULID` - ID of the paused session
- `pausedAt: DateTime` - When session was paused
- `occurredAt: DateTime` - When the event occurred

**Subscribers (future):**

- UI layer - Update session status display
- Analytics - Track pause patterns
- Read model - Update session timeline

---

### SessionResumed

**When:** User resumes a paused session

**Data:**

- `sessionId: ULID` - ID of the resumed session
- `resumedAt: DateTime` - When session was resumed
- `occurredAt: DateTime` - When the event occurred

**Subscribers (future):**

- UI layer - Update session status to active
- Analytics - Track resume patterns
- Read model - Update session timeline

---

### SessionStopped

**When:** User completes and finalizes a session

**Data:**

- `sessionId: ULID` - ID of the stopped session
- `stoppedAt: DateTime` - When session was stopped
- `totalDuration: number` - Total milliseconds across all segments
- `segmentCount: number` - Number of segments in the session
- `occurredAt: DateTime` - When the event occurred

**Subscribers (future):**

- UI layer - Clear active session indicator
- Analytics - Track session completion patterns
- Read model - Update category statistics
- Export service - Generate session reports

---

### SegmentTooShort

**When:** A segment is discarded because it's shorter than 300ms

**Data:**

- `sessionId: ULID` - ID of the session
- `startedAt: DateTime` - When segment started
- `stoppedAt: DateTime` - When segment stopped
- `duration: number` - Duration in milliseconds (< 300)
- `occurredAt: DateTime` - When the event occurred

**Subscribers (future):**

- Analytics - Track accidental clicks/UI issues
- Logging - Debug session behavior

---

## Use Cases

### 1. Start New Session

**Actor:** User  
**Trigger:** User taps a category to start tracking time  
**Flow:**

1. User selects category from main screen
2. System validates category exists
3. System creates new Session with categoryId
4. System creates first active segment
5. System emits SessionStarted event
6. System persists session via repository
7. UI shows active session indicator

**Business Value:** Allows users to track time spent on activities

---

### 2. Pause Active Session

**Actor:** User  
**Trigger:** User needs to take a break or switch activities  
**Flow:**

1. User taps pause button on active session
2. System validates session has active segment
3. System stops current segment with current timestamp
4. System checks segment duration:
   - If < 300ms: discard segment, emit SegmentTooShort
   - If >= 300ms: keep segment, emit SessionPaused
5. System persists updated session
6. UI shows paused session status

**Business Value:** Accurately tracks only active work time, excluding breaks

---

### 3. Resume Paused Session

**Actor:** User  
**Trigger:** User returns from break and continues activity  
**Flow:**

1. User taps resume button on paused session
2. System validates session is paused
3. System creates new segment starting at current time
4. System emits SessionResumed event
5. System persists updated session
6. UI shows active session indicator

**Business Value:** Continues time tracking after interruptions

---

### 4. Stop Session

**Actor:** User  
**Trigger:** User completes activity and wants to finalize session  
**Flow:**

1. User taps stop button on session
2. If session has active segment:
   - System stops current segment
   - System validates minimum duration
3. System emits SessionStopped event
4. System calculates total duration across all segments
5. System persists completed session
6. UI clears active session, updates category statistics

**Business Value:** Finalizes time tracking for analysis and reporting

---

## Relationships

### With Category Aggregate

- **Type:** Many-to-One (Many Sessions belong to one Category)
- **Relationship:** Session references Category via `categoryId`
- **Constraint:** Session requires valid categoryId (foreign key)
- **Navigation:** Unidirectional - Session knows Category, but not vice versa
- **Integrity:** Category deletion should handle orphaned sessions (archive or cascade)

### With SessionSegment Entity

- **Type:** One-to-Many (One Session has many SessionSegments)
- **Relationship:** Session is the aggregate root, Segment is a child entity
- **Constraint:** Segments cannot exist outside of a Session
- **Navigation:** Session holds array of segments
- **Lifecycle:** Session manages segment creation, modification, deletion
- **Persistence:** Segments are saved/loaded together with Session (aggregate boundary)

### With User (Future)

- **Type:** Many-to-One (Many Sessions belong to one User)
- **Note:** Multi-user support not yet implemented
- **Future:** Sessions will be scoped to individual users

---

## Validation Rules Summary

| Rule                     | Check                                              | Error Message                        |
| ------------------------ | -------------------------------------------------- | ------------------------------------ |
| Category Required        | `isNotNil(categoryId)`                             | "categoryId is required"             |
| One Active Segment       | Last segment OR no active segment                  | "Session already has active segment" |
| No Overlapping Segments  | `segments[i].stoppedAt <= segments[i+1].startedAt` | "Segments cannot overlap"            |
| Cannot Pause Paused      | Last segment has no `stoppedAt`                    | "Session is not active"              |
| Cannot Resume Active     | Last segment has `stoppedAt`                       | "Session is already active"          |
| Cannot Modify Stopped    | `stoppedAt === null`                               | "Cannot modify stopped session"      |
| Cannot Stop Stopped      | `stoppedAt === null`                               | "Session is already stopped"         |
| Minimum Segment Duration | `duration >= 300ms`                                | N/A (event: SegmentTooShort)         |

---

## Future Enhancements

### 1. Session Notes/Description

- Add `description?: string` property
- Allow users to add context about what they did
- Could be added when stopping session

### 2. Session Tags

- Add `tags: string[]` property
- Allow more granular categorization within category
- Example: "Work" category with tags ["meeting", "email", "coding"]

### 3. Goal/Target Duration

- Add `targetDuration?: number` property
- Allow users to set goals for session length
- Emit event when target is reached

### 4. Automatic Session Stopping

- Stop sessions automatically after period of inactivity
- Configurable timeout threshold
- Requires integration with device activity monitoring

### 5. Session Merging

- Combine consecutive sessions of same category
- Useful for correcting accidental stops
- Would emit SessionMerged event

### 6. Session Splitting

- Split a session into multiple sessions
- Useful for correcting category mistakes
- Would emit SessionSplit event

---

## Design Decisions

### Why is Session an Aggregate Root?

- **Transactional Boundary:** All session and segment changes must be atomic
- **Consistency Enforcement:** Session enforces invariants across all segments
- **Lifecycle Control:** Session manages creation/deletion of segments
- **Event Source:** Session emits events for all state changes
- **Repository Access:** Sessions are loaded/saved as complete units with segments

### Why are Segments not separate Aggregate Roots?

- **No Independent Lifecycle:** Segments only exist within a session context
- **Consistency Boundary:** Segment invariants (no overlap, chronological order) require session-level enforcement
- **Performance:** Loading segments separately would be inefficient
- **Simplicity:** Keeping segments inside session simplifies the model

### Why discard segments < 300ms?

- **User Experience:** Prevents accidental taps from polluting data
- **Data Quality:** Short segments are likely mistakes, not intentional tracking
- **Analytics Accuracy:** Improves quality of time tracking statistics
- **Configurable:** Could be made configurable in future (user preference)

### Why allow multiple resume/pause cycles?

- **Real-world Usage:** People naturally take breaks and interruptions
- **Flexibility:** Supports various work patterns (Pomodoro, meetings, etc.)
- **Data Fidelity:** Captures actual work patterns rather than continuous time
- **Analysis:** Enables analysis of productive time vs total session time

---

## Testing Requirements

### Unit Tests Required

1. **Start session with valid categoryId**
   - Creates session with provided categoryId
   - Generates ULID automatically
   - Sets createdAt to current time
   - Creates first active segment
   - Emits SessionStarted event

2. **Start session - category validation**
   - Throws error when categoryId is null
   - Throws error when categoryId is undefined

3. **Pause active session**
   - Stops current active segment
   - Sets stoppedAt timestamp
   - Emits SessionPaused event
   - Session status becomes paused

4. **Pause already paused session**
   - Throws error when trying to pause paused session

5. **Pause session - discard short segment**
   - Discards segment if duration < 300ms
   - Emits SegmentTooShort event
   - Does not emit SessionPaused event

6. **Resume paused session**
   - Creates new active segment
   - Sets startedAt timestamp
   - Emits SessionResumed event
   - Session has two segments

7. **Resume already active session**
   - Throws error when trying to resume active session

8. **Stop active session**
   - Stops current active segment
   - Emits SessionStopped event with correct data
   - Calculates total duration correctly

9. **Stop paused session**
   - Stops session without active segment
   - Emits SessionStopped event
   - All segments are finalized

10. **Stop session - discard short last segment**
    - Removes last segment if < 300ms
    - Emits SegmentTooShort event
    - Emits SessionStopped event

11. **Session with multiple pause/resume cycles**
    - Creates multiple segments correctly
    - Maintains chronological order
    - No overlapping segments
    - Calculates total duration across all segments

12. **Segment ordering invariant**
    - All segments are chronologically ordered
    - Each segment starts after previous ends

13. **One active segment invariant**
    - At most one segment has no stoppedAt
    - Active segment is always the last one

---

## Related Documents

- [EventStorming Session - 2025-11-25](../eventStorming/eventStorming-19-11-25.md)
- [SessionSegment Requirements](./Segment-requirements.md)
- [Category Requirements](./Category-requirements.md)
- [Aggregate Root Pattern](../theory/aggregate-root-pattern.md)
- [Domain Events](../theory/domain-events.md)

---

**Last Updated:** 2025-11-24  
**Status:** Planning - Not Yet Implemented  
**Next Steps:** Implement Session aggregate with all business rules
