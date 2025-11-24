# Ubiquitous Language

## What is Ubiquitous Language?

**Ubiquitous Language** is a shared vocabulary used by **everyone** on the team - developers, domain experts, product owners, designers - to describe the domain. It's the language of the business encoded in code.

### Key Principle

> "Use the same words in code that domain experts use when talking about the system."

**The Problem:**

```typescript
// ❌ Developers using technical jargon
class WorkLog {
  // "Work log" - not domain language
  private entries: WorkEntry[];

  addEntry(start: number, end: number): void {
    // Domain expert says "session", we say "entry"
  }

  getTotalTime(): number {
    // Domain expert says "duration"
    return this.entries.reduce((sum, e) => sum + (e.end - e.start), 0);
  }
}

// Domain expert: "What's a work log? We track sessions with segments."
// Developer: "Oh, that's the WorkLog class with WorkEntry objects."
// ❌ Translation barrier!
```

**The Solution:**

```typescript
// ✅ Using domain language
class Session {
  // ✅ Domain expert says "session"
  private segments: SessionSegment[]; // ✅ "segments"

  pause(): void {
    // ✅ "pause"
    // Domain expert says "pause a session"
  }

  getTotalDuration(): Duration {
    // ✅ "duration"
    return this.segments.reduce(
      (sum, segment) => sum.plus(segment.getDuration()),
      Duration.zero(),
    );
  }
}

// Domain expert: "We pause sessions and track duration."
// Developer: "Yes, session.pause() and getTotalDuration()."
// ✅ Same language!
```

---

## Why Ubiquitous Language Matters

### 1. **Reduces Miscommunication**

**Without UL:**

- Domain Expert: "Users can group their activities."
- Developer: "So we need a `UserActivityGrouping` table?"
- Domain Expert: "What? I meant categories!"

**With UL:**

- Domain Expert: "Users can create categories for their sessions."
- Developer: "Got it, `Category` entity with `Session` relationship."
- Domain Expert: "Exactly!"

### 2. **Makes Code Self-Documenting**

```typescript
// ❌ Need comments to explain
class TimeTracker {
  // This starts a new work period for a category
  begin(catId: string): void {}

  // This ends the current work period
  finish(): void {}
}

// ✅ Names explain themselves
class Session {
  static create(categoryId: ULID, timeProvider: TimeProvider): Session {}

  pause(timeProvider: TimeProvider): void {}

  stop(timeProvider: TimeProvider): void {}
}
```

### 3. **Enables Better Conversations**

```typescript
// All team members can read and understand
class Session {
  pause(timeProvider: TimeProvider): void {
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    activeSegment.stop(timeProvider.now());
  }
}

// Product Owner: "Can we pause a stopped session?"
// Developer: "No, session.pause() throws SessionAlreadyStoppedError."
// Product Owner: "Perfect, that matches our business rules."
```

---

## Building Ubiquitous Language

### Start with Event Storming

**Your event storming session captured domain language:**

```markdown
# Domain Events (from eventStorming-19-11-25.md)

Core Concepts:

- Session (not "work log" or "timer")
- Category (not "tag" or "group")
- Segment (not "time block" or "period")
- Pause/Resume (not "stop/start")
- Duration (not "time" or "length")
```

### Capture in a Glossary

```markdown
# Time Tracking Domain Glossary

## Entities

**Session**

- A period of focused work in a single category
- Can be paused and resumed
- Has one or more segments
- Example: "I started a session in the 'Work' category"

**Category**

- A way to organize sessions
- Has a name, optional color and icon
- Example: "I created a 'Study' category with a blue color"

**SessionSegment**

- An uninterrupted time period within a session
- Starts when session begins or resumes
- Stops when session pauses or stops
- Example: "My session has 3 segments because I paused twice"

## Value Objects

**Duration**

- A length of time measured in milliseconds
- Example: "The session duration was 2 hours"

**DateTime**

- A point in time (timestamp)
- Example: "The session started at 9:00 AM"

**CategoryName**

- A valid category name (1-100 characters)
- Example: "Work", "Study", "Hobby"

## Operations

**Start a Session**

- Begin tracking time for a category
- Creates first segment
- Example: "I started a session in 'Work'"

**Pause a Session**

- Temporarily stop tracking without ending session
- Stops current segment
- Example: "I paused my session for a break"

**Resume a Session**

- Continue tracking after a pause
- Creates new segment
- Example: "I resumed my session after lunch"

**Stop a Session**

- End tracking permanently
- Stops current segment
- Session cannot be resumed
- Example: "I stopped my session for the day"

## Domain Rules

**Session States**

- Active: Has at least one segment, not stopped
- Paused: No active segment, not stopped
- Stopped: Ended, cannot be resumed

**Segment Rules**

- Must have start time
- Stop time is null for active segments
- Duration is calculated from start to stop
- Segments cannot overlap
```

---

## Language in Code

### Class Names

```typescript
// ✅ Good - Domain language
class Session {}
class Category {}
class SessionSegment {}

// ❌ Bad - Technical jargon
class TimeTracker {}
class WorkLog {}
class TimeBlock {}
```

### Method Names

```typescript
class Session {
  // ✅ Good - Domain verbs
  pause(timeProvider: TimeProvider): void {}
  resume(timeProvider: TimeProvider): void {}
  stop(timeProvider: TimeProvider): void {}

  // ❌ Bad - Technical verbs
  suspend(): void {}
  unpause(): void {}
  terminate(): void {}
}
```

### Property Names

```typescript
class Session {
  // ✅ Good - Domain nouns
  private segments: SessionSegment[];
  private isStopped: boolean;
  private categoryId: ULID;

  // ❌ Bad - Technical or vague
  private items: Item[];
  private ended: boolean;
  private parentId: string;
}
```

### Error Names

```typescript
// ✅ Good - Describes business problem
class SessionAlreadyStoppedError extends DomainError {}
class NoActiveSegmentError extends DomainError {}
class CategoryNotFoundError extends ApplicationError {}

// ❌ Bad - Generic or technical
class InvalidOperationError extends Error {}
class NullReferenceError extends Error {}
class Error404 extends Error {}
```

### Event Names

```typescript
// ✅ Good - Past tense, domain events
class SessionStarted extends AbstractDomainEvent {}
class SessionPaused extends AbstractDomainEvent {}
class CategoryCreated extends AbstractDomainEvent {}

// ❌ Bad - Present tense or technical
class SessionStart extends Event {}
class PauseSession extends Event {}
class CategoryInserted extends Event {}
```

---

## Ubiquitous Language in Our Project

### Core Concepts

**Session Management:**

- `Session` - Main tracking entity
- `SessionSegment` - Uninterrupted time block
- `Category` - Organizational grouping
- `Duration` - Time measurement
- `DateTime` - Point in time

**Operations:**

- `session.create()` - Start tracking
- `session.pause()` - Temporarily stop
- `session.resume()` - Continue tracking
- `session.stop()` - End permanently

**States:**

- Active - Currently tracking
- Paused - Temporarily stopped
- Stopped - Ended

### Avoiding Ambiguity

**Problem: Multiple meanings**

```typescript
// ❌ "Stop" could mean pause or end
session.stop(); // Temporary or permanent?

// ✅ Clear distinction
session.pause(); // Temporary
session.stop(); // Permanent
```

**Problem: Unclear ownership**

```typescript
// ❌ Who has segments?
getSegments(); // Of what?

// ✅ Clear ownership
session.getSegments(); // Session's segments
```

---

## Language Evolution

### When Language Changes

**Scenario:** Domain expert realizes "Category" should be "Project"

**Wrong approach:**

```typescript
// ❌ Don't keep old names in code
class Category {
  // But domain says "Project" now!
  // Confusion grows
}
```

**Right approach:**

```typescript
// ✅ Refactor code to match new language
class Project {
  // Matches domain language
  // Code and conversation aligned
}

// Update everywhere
class Session {
  private projectId: ULID; // Was categoryId
}

// Update events
class ProjectCreated extends AbstractDomainEvent {} // Was CategoryCreated
```

### Continuous Refinement

**Listen during conversations:**

- Domain expert: "When users archive a category..."
- Developer: "Oh, we should add `category.archive()` method!"

**Update glossary:**

```markdown
## New Terms

**Archive a Category**

- Soft delete - hide from active list
- Keep historical data
- Example: "I archived my 'Old Project' category"
```

**Update code:**

```typescript
class Category {
  private isArchived: boolean = false;

  archive(): void {
    this.isArchived = true;
    this.addEvent(new CategoryArchived(this.id, Date.now()));
  }

  isActive(): boolean {
    return !this.isArchived;
  }
}
```

---

## Anti-Patterns

### ❌ Technical Leakage

```typescript
// ❌ Bad - Database terms in domain
class Category {
  private rowId: number; // ❌ "row" is database term
  private parentFK: number; // ❌ "FK" is technical
}

// ✅ Good - Domain terms
class Category {
  public readonly id: ULID; // ✅ Domain identity
  private parentCategoryId: ULID | null; // ✅ Domain relationship
}
```

### ❌ Generic Names

```typescript
// ❌ Bad - Too generic
class Item {}
class Data {}
class Manager {}
class Service {}

// ✅ Good - Specific domain names
class Category {}
class SessionData {}
class CategoryStatisticsCalculator {}
class SessionExportService {}
```

### ❌ Jargon Mismatch

```typescript
// Domain expert says: "Sessions have breaks"
// ❌ Developer says: "Pauses"
class Session {
  addPause(): void {} // Domain says "break"!
}

// ✅ Match domain language
class Session {
  addBreak(): void {} // Or convince domain expert "pause" is better
}
```

---

## Examples from Real Conversations

### Conversation 1: Session States

**Domain Expert:** "A session can be running, on break, or completed."

**Developer:** "So we have three states: `ACTIVE`, `PAUSED`, `STOPPED`?"

**Domain Expert:** "Yes, but we call them 'running', 'on break', and 'completed'."

**Resolution:**

```typescript
// ✅ Match language or agree on better terms
enum SessionState {
  ACTIVE = "active", // "running" in UI
  PAUSED = "paused", // "on break" in UI
  STOPPED = "stopped", // "completed" in UI
}

// Or use domain terms in code
enum SessionState {
  RUNNING = "running",
  ON_BREAK = "on_break",
  COMPLETED = "completed",
}
```

### Conversation 2: Duration

**Domain Expert:** "How long did the session last?"

**Developer:** "The session has a duration of 7200000 milliseconds."

**Domain Expert:** "What? I meant in hours and minutes!"

**Resolution:**

```typescript
// ✅ Speak in domain terms
class Duration {
  toHours(): number {}
  toMinutes(): number {}

  toString(): string {
    return `${this.toHours()}h ${this.toMinutes() % 60}m`;
  }
}

// Conversation now:
// Domain Expert: "How long did the session last?"
// Developer: "2 hours and 30 minutes."
// Domain Expert: "Perfect!"
```

---

## Documentation

### Code Comments

```typescript
/**
 * Pauses the session, stopping the current segment.
 *
 * A paused session can be resumed later. This is different from
 * stopping a session, which ends it permanently.
 *
 * @throws SessionAlreadyStoppedError if session is already stopped
 * @throws NoActiveSegmentError if there's no active segment to pause
 */
pause(timeProvider: TimeProvider): void {
  // Implementation
}
```

### README / User Docs

Use same language:

````markdown
# Session Management

## Creating a Session

Start a session by selecting a category:

```typescript
const session = Session.create(categoryId, timeProvider);
```
````

## Pausing a Session

Pause a session when taking a break:

```typescript
session.pause(timeProvider);
```

The session can be resumed later.

## Stopping a Session

Stop a session when finished:

```typescript
session.stop(timeProvider);
```

Stopped sessions cannot be resumed.

````

---

## Testing with Ubiquitous Language

```typescript
describe('Session', () => {
  describe('pause', () => {
    it('should pause active session', () => {
      // Arrange - using domain language
      const session = Session.create(categoryId, mockTime);

      // Act
      session.pause(mockTime);

      // Assert - using domain concepts
      expect(session.hasActiveSegment()).toBe(false);
    });

    it('should throw when pausing stopped session', () => {
      const session = Session.create(categoryId, mockTime);
      session.stop(mockTime);

      // Domain language in test names
      expect(() => session.pause(mockTime))
        .toThrow(SessionAlreadyStoppedError);
    });
  });

  describe('resume', () => {
    it('should create new segment when resuming', () => {
      const session = Session.create(categoryId, mockTime);
      session.pause(mockTime);

      mockTime.advanceMinutes(5);
      session.resume(mockTime);

      expect(session.getSegments()).toHaveLength(2);
    });
  });
});
````

---

## Refactoring to Ubiquitous Language

### Before

```typescript
class TimeLog {
  private items: LogEntry[];

  add(start: number, end: number): void {
    this.items.push({ start, end });
  }

  getTotal(): number {
    return this.items.reduce((sum, item) => sum + (item.end - item.start), 0);
  }
}
```

### After

```typescript
class Session {
  private segments: SessionSegment[];

  pause(timeProvider: TimeProvider): void {
    const activeSegment = this.getActiveSegment();
    if (activeSegment) {
      activeSegment.stop(timeProvider.now());
    }
  }

  getTotalDuration(): Duration {
    return this.segments.reduce(
      (total, segment) => total.plus(segment.getDuration() || Duration.zero()),
      Duration.zero(),
    );
  }
}
```

**Impact:**

- `TimeLog` → `Session` (domain term)
- `items` → `segments` (specific, not generic)
- `add()` → `pause()` (domain operation)
- `getTotal()` → `getTotalDuration()` (clear what's being totaled)
- `number` → `Duration` (domain concept)

---

## Best Practices

### ✅ DO:

**1. Use domain expert's words**

```typescript
// Domain expert says: "Categories can be archived"
class Category {
  archive(): void {} // ✅ Their word
}
```

**2. Be consistent**

```typescript
// ✅ Same term everywhere
session.pause();
SessionPaused;
PauseSessionCommand;
pauseSession();

// ❌ Inconsistent
session.pause();
SessionSuspended;
HaltSessionCommand;
stopSession();
```

**3. Avoid abbreviations**

```typescript
// ✅ Full words
getTotalDuration();
SessionSegment;

// ❌ Abbreviations
getTotalDur();
SessSeg;
```

**4. Update when language evolves**

```typescript
// Domain changes "Category" to "Project"
// ✅ Refactor code immediately
class Project {} // Was Category
```

### ❌ DON'T:

**1. Don't use technical jargon**

```typescript
// ❌ Technical
class DataAccessObject {}
class EntityManager {}

// ✅ Domain
class CategoryRepository {}
class SessionService {}
```

**2. Don't keep outdated names**

```typescript
// ❌ Code uses old language
class WorkLog {} // Domain now says "Session"

// ✅ Update to match
class Session {}
```

**3. Don't mix languages**

```typescript
// ❌ Mixed
session.pause(); // English
session.reprendre(); // French
session.停止(); // Chinese

// ✅ One language
session.pause();
session.resume();
session.stop();
```

---

## Summary

**Ubiquitous Language:**

- Shared vocabulary between developers and domain experts
- Used in code, conversations, docs, tests
- Reduces miscommunication
- Makes code self-documenting

**Building UL:**

- Start with event storming
- Create glossary
- Use domain terms in code
- Evolve with domain understanding

**In Our Project:**

- `Session`, `Category`, `SessionSegment`
- `pause()`, `resume()`, `stop()`
- `Duration`, `DateTime`
- `SessionStarted`, `SessionPaused`

**Key Benefit:** Everyone speaks the same language - no translation needed between business and code!

---

## Related Documents

- [Domain Events](./domain-events.md)
- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Bounded Contexts](./bounded-contexts.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 2: Communication and the Use of Language)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 1: Getting Started with DDD)
- **Domain Modeling Made Functional** by Scott Wlaschin
