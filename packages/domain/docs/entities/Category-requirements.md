# Category Entity - Business Requirements

## Domain Context

Category represents a classification or tag for tracking different types of activities in the user's time. Categories are the fundamental organizational unit in the time tracking system - users start time tracking sessions by selecting a category.

**Examples:** "Work", "Routine", "Hobby", "Exercise", "Learning"

---

## Entity Type

**Aggregate Root** ✓

Category is an Aggregate Root because:

- It has its own lifecycle independent of other entities
- It has a unique identifier (ULID)
- It is the entry point for all category-related operations
- It can be directly loaded/saved via repository
- It emits its own domain events

---

## Properties

| Property    | Type       | Description                         | Mutability |
| ----------- | ---------- | ----------------------------------- | ---------- |
| `id`        | `ULID`     | Unique identifier for the category  | Immutable  |
| `name`      | `string`   | Display name of the category        | Mutable    |
| `createdAt` | `DateTime` | Timestamp when category was created | Immutable  |

---

## Business Rules & Invariants

### 1. Name is Required

- **Rule:** Category must always have a non-empty name
- **Validation:** Name cannot be `null`, `undefined`, or empty string after trimming
- **Enforcement:** Constructor validation
- **Error:** Throw invariant error if violated

### 2. Name has Minimum Length

- **Rule:** Category name must have at least one character after trimming whitespace
- **Validation:** `trim(name).length > 0`
- **Enforcement:** Constructor validation
- **Error:** Throw invariant error if violated

### 3. Unique Identity

- **Rule:** Each category has a unique ULID identifier
- **Validation:** ID is generated once at creation time
- **Enforcement:** Constructor sets `readonly id`
- **Note:** No two categories should have the same ID (enforced at repository level)

### 4. Creation Timestamp

- **Rule:** Category records when it was created
- **Validation:** `createdAt` is set to current time if not provided
- **Enforcement:** Constructor sets `readonly createdAt`
- **Default:** `Date.now()` if not specified

---

## Commands

### CreateCategory

**Input:**

- `name: string` (required)
- `id?: ULID` (optional, for reconstruction from persistence)
- `createdAt?: DateTime` (optional, for reconstruction from persistence)

**Process:**

1. Validate name invariants
2. Generate ULID if not provided
3. Set createdAt to current time if not provided
4. Create Category instance
5. Emit `CategoryCreated` event

**Output:**

- Category aggregate instance

**Events Emitted:**

- `CategoryCreated` (only on new creation, not on reconstruction)

---

## Domain Events

### CategoryCreated

**When:** User creates a new category in the system

**Data:**

- `categoryId: ULID` - ID of the created category
- `categoryName: string` - Name of the category
- `occurredAt: DateTime` - When the event occurred

**Subscribers (future):**

- UI layer - Update category list display
- Analytics - Track category usage patterns
- Read model - Update category summary view

---

## Use Cases

### 1. Create New Category

**Actor:** User  
**Trigger:** User wants to track time for a new type of activity  
**Flow:**

1. User provides category name (e.g., "Deep Work")
2. System validates name is not empty
3. System generates unique ID
4. System creates Category aggregate
5. System emits CategoryCreated event
6. System persists category via repository

**Business Value:** Allows users to organize their time by custom categories

### 2. Rename Category (Future)

**Actor:** User  
**Trigger:** User wants to change category name  
**Note:** Currently not implemented, but name is mutable to support future enhancement

### 3. View Categories

**Actor:** User  
**Trigger:** User needs to see all available categories to start a session  
**Flow:**

1. User opens main screen
2. System loads all categories from repository
3. System displays categories (e.g., as cards/buttons)

---

## Relationships

### With Session Aggregate

- **Type:** One-to-Many (Category has many Sessions)
- **Relationship:** Session references Category via `categoryId`
- **Constraint:** Sessions cannot exist without a Category reference
- **Navigation:** Category does NOT hold references to sessions (unidirectional)
- **Why:** Maintains aggregate boundaries - Category doesn't need to know about sessions

### With User (Future)

- **Type:** One-to-Many (User has many Categories)
- **Note:** Multi-user support not yet implemented
- **Future:** Categories will be scoped to individual users

---

## Validation Rules Summary

| Rule           | Check                   | Error Message      |
| -------------- | ----------------------- | ------------------ |
| Name Not Null  | `isNotNil(name)`        | "name is required" |
| Name Not Empty | `trim(name).length > 0` | "name is required" |

---

## Future Enhancements

### 1. Category Colors

- Add `color: string` property for visual distinction
- Allows users to quickly identify categories by color
- Default color generation based on category name hash

### 2. Category Icons

- Add `icon: string` property for emoji or icon identifier
- Enhances visual recognition on mobile UI

### 3. Category Editing

- Implement `rename(newName: string)` method
- Emit `CategoryRenamed` event
- Validate new name against same invariants

### 4. Category Archiving

- Add `isArchived: boolean` property
- Allow hiding categories without deleting
- Preserves historical session data

### 5. Category Statistics Integration

- Add method to calculate total time spent
- Requires querying SessionRepository
- Could be implemented as a Domain Service

---

## Design Decisions

### Why is Category an Aggregate Root?

- **Independent Lifecycle:** Categories can be created/modified independently
- **Transactional Boundary:** All category changes happen atomically
- **Repository Access:** Categories are loaded/saved as complete units
- **Event Source:** Categories emit their own domain events

### Why doesn't Category hold Session references?

- **Aggregate Boundary:** Keeps Category aggregate small and focused
- **Performance:** Avoids loading all sessions when loading a category
- **Scalability:** Sessions can grow to large numbers per category
- **Direction:** Sessions depend on Categories, not vice versa
- **Query Pattern:** Use SessionRepository to query sessions by categoryId

### Why use ULID instead of UUID?

- **Time-ordered:** ULIDs are sortable by creation time
- **Readable:** More human-friendly than UUIDs
- **Performance:** Better for database indexing
- **Compatibility:** Can be parsed to extract timestamp if needed

---

## Testing Requirements

### Unit Tests Required

1. **Creation with valid name**
   - Creates category with provided name
   - Generates ULID automatically
   - Sets createdAt to current time

2. **Creation with all parameters**
   - Accepts optional id and createdAt
   - Uses provided values instead of generating

3. **Name validation - null**
   - Throws error when name is null

4. **Name validation - undefined**
   - Throws error when name is undefined

5. **Name validation - empty string**
   - Throws error when name is ""

6. **Name validation - whitespace only**
   - Throws error when name is " "

7. **Event emission**
   - CategoryCreated event is emitted with correct data
   - Event contains categoryId, categoryName, occurredAt

8. **Property immutability**
   - `id` cannot be changed after creation
   - `createdAt` cannot be changed after creation

9. **Name mutability**
   - `name` can be changed (for future rename feature)

---

## Related Documents

- [EventStorming Session - 2025-11-23](../eventStorming/eventStorming-19-11-25.md)
- [Aggregate Root Pattern](../theory/aggregate-root-pattern.md)
- [Domain Events](../theory/domain-events.md)

---

**Last Updated:** 2025-11-23  
**Status:** Active - Currently Implemented  
**Next Steps:** Implement rename functionality, add color/icon support
