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

| Property    | Type            | Description                           | Mutability |
| ----------- | --------------- | ------------------------------------- | ---------- |
| `id`        | `ULID`          | Unique identifier for the category    | Immutable  |
| `name`      | `CategoryName`  | Display name of the category          | Mutable    |
| `createdAt` | `DateTime`      | Timestamp when category was created   | Immutable  |
| `color`     | `Color \| null` | Optional color for visual distinction | Mutable    |
| `icon`      | `Icon \| null`  | Optional icon for visual recognition  | Mutable    |

---

## Business Rules & Invariants

### 1. Name is Required and Valid

- **Rule:** Category must always have a valid `CategoryName` value object
- **Validation:** Delegated to `CategoryName` value object
- **Enforcement:** CategoryName.create() validates:
  - Name cannot be `null` or `undefined`
  - Name cannot be empty string
  - Name must be between 1 and 50 characters after trimming
  - Name must be a string type
- **Error:** `CategoryName` throws validation error if rules violated
- **Reference:** See `CategoryName` value object documentation for detailed validation rules

### 2. Unique Identity

- **Rule:** Each category has a unique ULID identifier
- **Validation:** ID is generated once at creation time
- **Enforcement:** Constructor sets `readonly id`
- **Note:** No two categories should have the same ID (enforced at repository level)

### 3. Creation Timestamp

- **Rule:** Category records when it was created
- **Validation:** `createdAt` is set to current time if not provided
- **Enforcement:** Constructor sets `readonly createdAt`
- **Default:** `Date.now()` if not specified

---

## Commands

### CreateCategory

**Input:**

- `name: CategoryName` (required - validated value object)
- `id?: ULID` (optional, for reconstruction from persistence)
- `createdAt?: DateTime` (optional, for reconstruction from persistence)
- `color?: Color` (optional)
- `icon?: Icon` (optional)

**Process:**

1. Accept `CategoryName` value object (validation already done)
2. Generate ULID if not provided
3. Set createdAt to current time if not provided
4. Create Category instance with provided properties
5. Emit `CategoryCreated` event (only if `id` not provided - new creation)

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

| Rule               | Check                          | Error Message                      | Enforced By  |
| ------------------ | ------------------------------ | ---------------------------------- | ------------ |
| Name is Valid      | `name instanceof CategoryName` | Delegated to CategoryName          | CategoryName |
| Name Not Null      | Delegated to CategoryName      | "Name cannot be null or undefined" | CategoryName |
| Name Not Empty     | Delegated to CategoryName      | "Name cannot be empty"             | CategoryName |
| Name Length (1-50) | Delegated to CategoryName      | "Name must be 1-50 characters"     | CategoryName |

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

**Category Aggregate Tests** (`Category.test.ts`):

1. **Creation with valid CategoryName**
   - Creates category with CategoryName value object
   - Generates ULID automatically
   - Sets createdAt to provided time
   - Accepts optional color and icon

2. **Reconstruction with all parameters**
   - Accepts optional id and createdAt for persistence reconstruction
   - Does not emit event when reconstructing (id provided)
   - Uses provided values instead of generating

3. **Event emission - CategoryCreated**
   - CategoryCreated event is emitted on new creation
   - Event contains categoryId, occurredAt
   - Event NOT emitted when reconstructing from persistence

4. **Event emission - CategoryEdited**
   - CategoryEdited event emitted when name changes
   - CategoryEdited event emitted when color changes
   - CategoryEdited event emitted when icon changes

5. **Property immutability**
   - `id` is readonly and cannot be changed after creation
   - `createdAt` is readonly and cannot be changed after creation

6. **Property mutability**
   - `name` can be changed via `setName()`
   - `color` can be changed via `setColor()`
   - `icon` can be changed via `setIcon()`

**CategoryName Value Object Tests** (`CategoryName.test.ts`):

> ℹ️ **Note:** Name validation tests belong in `CategoryName.test.ts`, not `Category.test.ts`
>
> The CategoryName value object is responsible for validating:
>
> - Name is not null/undefined
> - Name is not empty string
> - Name is not whitespace-only
> - Name length is between 1-50 characters
> - Name is a valid string type
>
> See `CategoryName` documentation for detailed validation test requirements.

---

## Related Documents

- [EventStorming Session - 2025-11-23](../eventStorming/eventStorming-19-11-25.md)
- [CategoryName Value Object](../valueObjects/CategoryName-requirements.md) - Name validation rules
- [Color Value Object](../valueObjects/Color-requirements.md) - Color validation rules
- [Icon Value Object](../valueObjects/Icon-requirements.md) - Icon validation rules
- [Aggregate Root Pattern](../theory/aggregate-root-pattern.md)
- [Domain Events](../theory/domain-events.md)
- [Value Objects Pattern](../theory/value-objects.md)

---

**Last Updated:** 2025-11-23  
**Status:** Active - Currently Implemented  
**Next Steps:** Implement rename functionality, add color/icon support
