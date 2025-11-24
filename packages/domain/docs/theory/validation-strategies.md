# Validation Strategies

## What is Validation?

**Validation** is the process of checking whether data meets certain requirements before proceeding with an operation. In a layered architecture, validation happens at **multiple layers**, each with a different purpose.

### Key Principle

> "Validate at the boundary where data enters your system, and enforce invariants in your domain."

**The Confusion:**

```typescript
// ❌ Many developers put ALL validation in one place
// Where does this validation belong?
if (!name) throw new Error("Name required");
if (name.length > 100) throw new Error("Name too long");
if (!isValidEmail(email)) throw new Error("Invalid email");
if (await categoryExists(name)) throw new Error("Already exists");
```

**The Answer:** Different layers, different validation types!

---

## Three Layers of Validation

### 1. Domain Layer (Invariants) - Business Rules

**Purpose:** Ensure domain objects are **always in a valid state**.

**What to validate:**

- Business rules that must **never** be violated
- Data that makes the object **meaningless** if invalid
- Structural integrity of the domain

**Example:**

```typescript
export class Category extends AggregateRoot {
  constructor(params: { name: string }) {
    super();

    // ✅ Domain validation (invariants)
    this.ensureValidName(params.name);

    this.name = params.name;
    this.id = makeId();
  }

  private ensureValidName(name?: string): asserts name is string {
    // Invariants - MUST be true for Category to exist
    invariant(
      isNotNil(name),
      new EntityInvariantError("Category name is required"),
    );

    invariant(
      trim(name).length > 0,
      new EntityInvariantError("Category name cannot be empty"),
    );

    // Business rule: Category name max length
    invariant(
      name.length <= 100,
      new EntityInvariantError("Category name too long (max 100 characters)"),
    );
  }
}
```

**Why here:**

- Category **cannot exist** without a valid name
- This is a **business rule**, not a UI concern
- Protects domain integrity

### 2. Application Layer - Context & Business Logic

**Purpose:** Validate **application-specific rules** and **cross-aggregate** constraints.

**What to validate:**

- Uniqueness checks (requires repository)
- Cross-aggregate rules
- User permissions
- Command structure

**Example:**

```typescript
@injectable()
export class CreateCategoryCommandHandler {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<{ id: ULID }> {
    // ✅ Application validation
    await this.validateCommand(command);

    // Domain handles its own validation
    const category = new Category({ name: command.name });

    await this.categoryRepo.save(category);

    return { id: category.id };
  }

  private async validateCommand(command: CreateCategoryCommand): Promise<void> {
    // Application-level: uniqueness check (requires repository)
    const existing = await this.categoryRepo.findByName(command.name);
    if (existing) {
      throw new ApplicationError(
        `Category with name "${command.name}" already exists`,
        "DUPLICATE_CATEGORY",
      );
    }

    // Application-level: business constraints
    const totalCategories = await this.categoryRepo.count();
    if (totalCategories >= 50) {
      throw new ApplicationError(
        "Maximum number of categories reached (50)",
        "MAX_CATEGORIES_REACHED",
      );
    }
  }
}
```

**Why here:**

- Requires repository (domain can't access infrastructure)
- Application-specific rule (max categories)
- Cross-aggregate constraint

### 3. Presentation Layer - User Input

**Purpose:** Validate **user input** before it reaches the application layer.

**What to validate:**

- Input format (email, phone, etc.)
- Required fields (UI requirement)
- Input length (UI constraint)
- Data types

**Example:**

```typescript
// React Native component
export function CreateCategoryForm() {
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): boolean => {
    const newErrors: string[] = [];

    // ✅ Presentation validation
    if (!name.trim()) {
      newErrors.push('Category name is required');
    }

    if (name.length > 100) {
      newErrors.push('Category name is too long (max 100 characters)');
    }

    if (!/^[a-zA-Z0-9\s-]+$/.test(name)) {
      newErrors.push('Category name can only contain letters, numbers, spaces, and hyphens');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    // Validate before sending to application
    if (!validate()) return;

    try {
      await createCategoryUseCase.execute({ name });
      navigation.goBack();
    } catch (error) {
      // Application or domain validation failed
      if (error instanceof ApplicationError) {
        setErrors([error.message]);
      } else if (error instanceof EntityInvariantError) {
        setErrors([error.message]);
      }
    }
  };

  return (
    <View>
      <TextInput
        value={name}
        onChangeText={setName}
        onBlur={validate}
      />
      {errors.map((error, i) => (
        <Text key={i} style={styles.error}>{error}</Text>
      ))}
      <Button onPress={handleSubmit}>Create Category</Button>
    </View>
  );
}
```

**Why here:**

- Immediate feedback to user
- Reduce unnecessary API calls
- Better UX (don't wait for server round-trip)

---

## The Validation Pyramid

```
┌─────────────────────────────────────┐
│     Presentation (UI)               │  ← User input, format, UX
│     - Required fields               │
│     - Format (email, phone)         │
│     - Length limits                 │
├─────────────────────────────────────┤
│     Application (Use Cases)         │  ← Context, cross-aggregate
│     - Uniqueness                    │
│     - Permissions                   │
│     - Business constraints          │
├─────────────────────────────────────┤
│     Domain (Entities)               │  ← Invariants, core rules
│     - Business rules                │  ← MOST IMPORTANT
│     - Structural integrity          │
└─────────────────────────────────────┘
```

**Each layer validates what it cares about:**

- **Domain:** "Is this object valid?"
- **Application:** "Can I do this operation?"
- **Presentation:** "Is the user input reasonable?"

---

## Validation vs Invariants vs Business Rules

### Invariants (Domain)

**Definition:** Properties that must **always** be true for an object to be valid.

```typescript
class Category {
  constructor(params: { name: string }) {
    // Invariant: Category MUST have a name
    invariant(isNotNil(params.name), new EntityInvariantError("name required"));
    this.name = params.name;
  }

  changeName(params: { name: string }): void {
    // Invariant still enforced
    this.ensureValidName(params.name);
    this.name = params.name;
  }
}
```

**Key:** Can **never** be violated. Checked in constructor and all mutating methods.

### Business Rules (Domain or Application)

**Definition:** Rules that govern what operations are allowed.

```typescript
// Domain business rule
class Session {
  pause(timeProvider: TimeProvider): void {
    // Business rule: Can't pause stopped session
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    // Business rule: Must have active segment
    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    activeSegment.stop(timeProvider);
  }
}

// Application business rule
class StartSessionUseCase {
  async execute(command: StartSessionCommand): Promise<void> {
    // Business rule: Can't start session if one is already active
    const activeSession = await this.sessionRepo.findActive();
    if (activeSession) {
      throw new ApplicationError(
        "Cannot start new session while another is active",
        "ACTIVE_SESSION_EXISTS",
      );
    }

    const session = Session.create(command.categoryId, this.timeProvider);
    await this.sessionRepo.save(session);
  }
}
```

### Validation (All Layers)

**Definition:** Checking if data meets requirements.

```typescript
// Presentation validation - Format
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Application validation - Context
async function validateCategoryExists(id: ULID): Promise<void> {
  const category = await categoryRepo.findById(id);
  if (!category) {
    throw new ApplicationError("Category not found");
  }
}

// Domain validation - Invariant
function validateCategoryName(name: string): void {
  invariant(isNotNil(name), new EntityInvariantError("name required"));
}
```

---

## Command Validation Pattern

### Command DTO

```typescript
export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}
```

### Validator

```typescript
export class CreateCategoryCommandValidator {
  validate(command: CreateCategoryCommand): ValidationResult {
    const errors: ValidationError[] = [];

    // Required field
    if (!command.name || trim(command.name).length === 0) {
      errors.push({
        field: "name",
        message: "Category name is required",
      });
    }

    // Length
    if (command.name && command.name.length > 100) {
      errors.push({
        field: "name",
        message: "Category name too long (max 100 characters)",
      });
    }

    // Format
    if (command.color && !this.isValidHexColor(command.color)) {
      errors.push({
        field: "color",
        message: "Color must be a valid hex color (e.g., #FF0000)",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}
```

### Use in Command Handler

```typescript
@injectable()
export class CreateCategoryCommandHandler {
  constructor(
    private validator: CreateCategoryCommandValidator,
    private categoryRepo: ICategoryRepository,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<{ id: ULID }> {
    // 1. Validate command structure
    const validation = this.validator.validate(command);
    if (!validation.isValid) {
      throw new ValidationError(
        "Invalid create category command",
        validation.errors,
      );
    }

    // 2. Validate business constraints
    await this.validateBusinessRules(command);

    // 3. Create domain object (domain validates invariants)
    const category = new Category({ name: command.name });

    if (command.color) {
      category.setColor({ color: command.color });
    }

    await this.categoryRepo.save(category);

    return { id: category.id };
  }

  private async validateBusinessRules(
    command: CreateCategoryCommand,
  ): Promise<void> {
    // Uniqueness
    const existing = await this.categoryRepo.findByName(command.name);
    if (existing) {
      throw new ApplicationError(
        `Category "${command.name}" already exists`,
        "DUPLICATE_CATEGORY",
      );
    }
  }
}
```

---

## Using Validation Libraries

### With Zod (Recommended)

```typescript
import { z } from 'zod';

// Define schema
const CreateCategoryCommandSchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long (max 100 characters)')
    .regex(
      /^[a-zA-Z0-9\s-]+$/,
      'Only letters, numbers, spaces, and hyphens allowed'
    ),

  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color')
    .nullable()
    .optional(),

  icon: z.string()
    .nullable()
    .optional()
});

// Type inference
export type CreateCategoryCommand = z.infer<typeof CreateCategoryCommandSchema>;

// Validate
export class CreateCategoryCommandValidator {
  validate(command: unknown): CreateCategoryCommand {
    try {
      return CreateCategoryCommandSchema.parse(command);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid command',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  }
}

// In command handler
async execute(command: unknown): Promise<{ id: ULID }> {
  // Validate and get typed command
  const validCommand = this.validator.validate(command);

  // Now validCommand is typed as CreateCategoryCommand
  const category = new Category({ name: validCommand.name });
  // ...
}
```

### With class-validator

```typescript
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
} from "class-validator";
import { validate } from "class-validator";

export class CreateCategoryCommand {
  @IsString()
  @IsNotEmpty({ message: "Category name is required" })
  @MaxLength(100, { message: "Category name too long (max 100 characters)" })
  @Matches(/^[a-zA-Z0-9\s-]+$/, {
    message: "Only letters, numbers, spaces, and hyphens allowed",
  })
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-F]{6}$/i, { message: "Invalid hex color" })
  color?: string | null;

  @IsString()
  @IsOptional()
  icon?: string | null;
}

// Validate
export class CreateCategoryCommandValidator {
  async validate(command: CreateCategoryCommand): Promise<ValidationResult> {
    const errors = await validate(command);

    if (errors.length > 0) {
      return {
        isValid: false,
        errors: errors.flatMap((e) =>
          Object.values(e.constraints || {}).map((message) => ({
            field: e.property,
            message,
          })),
        ),
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  }
}
```

---

## Validation in Our Project

### Category Command Validation

```typescript
// CreateCategoryCommand validation
const CreateCategoryCommandSchema = z.object({
  name: z
    .string()
    .min(1, "Name required")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Invalid characters"),

  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Invalid color")
    .nullable()
    .optional(),

  icon: z.string().nullable().optional(),
});

// RenameCategoryCommand validation
const RenameCategoryCommandSchema = z.object({
  categoryId: z.string().min(1, "Category ID required"),
  newName: z.string().min(1, "Name required").max(100, "Name too long"),
});
```

### Session Command Validation

```typescript
// StartSessionCommand validation
const StartSessionCommandSchema = z.object({
  categoryId: z.string().min(1, "Category ID required"),
});

// PauseSessionCommand validation
const PauseSessionCommandSchema = z.object({
  sessionId: z.string().min(1, "Session ID required"),
});

// StopSessionCommand validation
const StopSessionCommandSchema = z.object({
  sessionId: z.string().min(1, "Session ID required"),
});
```

---

## Error Messages

### User-Friendly Messages

```typescript
// ❌ Technical message (bad for users)
throw new Error("name is null or undefined");

// ✅ User-friendly message
throw new Error("Please enter a category name");

// ✅ Even better - specific and actionable
throw new Error(
  "Category name is required. Please enter a name between 1 and 100 characters.",
);
```

### Error Message Rules

1. **Be specific:** "Category name is required" not "Invalid input"
2. **Be actionable:** Tell user what to do
3. **Be polite:** "Please enter..." not "You must..."
4. **Avoid technical jargon:** "Name too long" not "String length exceeds maximum"

### Internationalization

```typescript
// i18n-ready error messages
export const ValidationMessages = {
  CATEGORY_NAME_REQUIRED: 'validation.category.name.required',
  CATEGORY_NAME_TOO_LONG: 'validation.category.name.too_long',
  CATEGORY_NAME_INVALID_CHARS: 'validation.category.name.invalid_chars',
  CATEGORY_ALREADY_EXISTS: 'validation.category.already_exists'
};

// In validator
if (!name) {
  errors.push({
    field: 'name',
    message: i18n.t(ValidationMessages.CATEGORY_NAME_REQUIRED)
  });
}

// In en.json
{
  "validation": {
    "category": {
      "name": {
        "required": "Category name is required",
        "too_long": "Category name is too long (maximum 100 characters)",
        "invalid_chars": "Category name can only contain letters, numbers, spaces, and hyphens"
      },
      "already_exists": "A category with this name already exists"
    }
  }
}
```

---

## Async Validation

### Pattern: Validate After User Input

```typescript
// In React component
export function CreateCategoryForm() {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);

  const checkNameAvailability = async (name: string) => {
    if (!name) return;

    setIsCheckingName(true);

    try {
      const exists = await checkCategoryNameExists(name);
      if (exists) {
        setNameError('Category with this name already exists');
      } else {
        setNameError(null);
      }
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleNameChange = (newName: string) => {
    setName(newName);

    // Debounce async validation
    clearTimeout(nameCheckTimeout);
    nameCheckTimeout = setTimeout(() => {
      checkNameAvailability(newName);
    }, 500);
  };

  return (
    <View>
      <TextInput
        value={name}
        onChangeText={handleNameChange}
      />
      {isCheckingName && <Text>Checking...</Text>}
      {nameError && <Text style={styles.error}>{nameError}</Text>}
    </View>
  );
}
```

---

## Testing Validation

### Test Domain Validation

```typescript
describe("Category invariants", () => {
  it("should throw on null name", () => {
    expect(() => new Category({ name: null as any })).toThrow(
      EntityInvariantError,
    );
  });

  it("should throw on empty name", () => {
    expect(() => new Category({ name: "" })).toThrow(EntityInvariantError);
  });

  it("should throw on name too long", () => {
    expect(() => new Category({ name: "a".repeat(101) })).toThrow(
      EntityInvariantError,
    );
  });

  it("should create with valid name", () => {
    const category = new Category({ name: "Work" });
    expect(category.name).toBe("Work");
  });
});
```

### Test Application Validation

```typescript
describe("CreateCategoryCommandHandler validation", () => {
  it("should throw if category name already exists", async () => {
    // Setup: existing category
    const existing = new Category({ name: "Work" });
    await categoryRepo.save(existing);

    const handler = new CreateCategoryCommandHandler(categoryRepo);

    await expect(handler.execute({ name: "Work" })).rejects.toThrow(
      'Category "Work" already exists',
    );
  });

  it("should create if name is unique", async () => {
    const handler = new CreateCategoryCommandHandler(categoryRepo);

    const result = await handler.execute({ name: "Work" });

    expect(result.id).toBeDefined();
  });
});
```

### Test Command Validator

```typescript
describe("CreateCategoryCommandValidator", () => {
  let validator: CreateCategoryCommandValidator;

  beforeEach(() => {
    validator = new CreateCategoryCommandValidator();
  });

  it("should fail on empty name", () => {
    const result = validator.validate({ name: "" });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "name",
      message: expect.stringContaining("required"),
    });
  });

  it("should fail on name too long", () => {
    const result = validator.validate({ name: "a".repeat(101) });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "name",
      message: expect.stringContaining("too long"),
    });
  });

  it("should fail on invalid color", () => {
    const result = validator.validate({
      name: "Work",
      color: "red", // Not hex
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "color",
      message: expect.stringContaining("hex color"),
    });
  });

  it("should pass with valid data", () => {
    const result = validator.validate({
      name: "Work",
      color: "#FF0000",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Validate at appropriate layer**

```typescript
// ✅ Domain - Invariants
class Category {
  constructor(params: { name: string }) {
    invariant(isNotNil(params.name), ...);
  }
}

// ✅ Application - Context
class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand) {
    const existing = await this.repo.findByName(command.name);
    if (existing) throw new Error('Already exists');
  }
}

// ✅ Presentation - User input
function validateForm() {
  if (!name.trim()) {
    setError('Name required');
  }
}
```

**2. Fail fast**

```typescript
// ✅ Validate early
async execute(command: CreateCategoryCommand) {
  // Validate first
  this.validate(command);

  // Then proceed
  const category = new Category({ name: command.name });
  await this.repo.save(category);
}
```

**3. Return all errors**

```typescript
// ✅ Return all validation errors
const errors: ValidationError[] = [];

if (!name) errors.push({ field: "name", message: "Required" });
if (name.length > 100) errors.push({ field: "name", message: "Too long" });
if (!color) errors.push({ field: "color", message: "Required" });

return { isValid: errors.length === 0, errors };

// ❌ Don't throw on first error
if (!name) throw new Error("Name required");
if (name.length > 100) throw new Error("Too long"); // Never reached!
```

### ❌ DON'T:

**1. Don't validate in wrong layer**

```typescript
// ❌ Domain checking uniqueness (needs repository!)
class Category {
  constructor(params: { name: string }, repo: ICategoryRepository) {
    const existing = await repo.findByName(params.name); // ❌ NO!
  }
}

// ✅ Application checks uniqueness
class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand) {
    const existing = await this.repo.findByName(command.name); // ✅ YES!
  }
}
```

**2. Don't duplicate validation logic**

```typescript
// ❌ Validation logic duplicated
// In UI
if (name.length > 100) setError("Too long");

// In validator
if (name.length > 100) errors.push("Too long");

// In domain
if (name.length > 100) throw new Error("Too long");

// ✅ Share validation logic
const MAX_CATEGORY_NAME_LENGTH = 100;

// Use constant everywhere
if (name.length > MAX_CATEGORY_NAME_LENGTH) {
}
```

---

## Summary

**Three Layers:**

1. **Domain (Invariants)** - Object must be valid
2. **Application (Context)** - Operation is allowed
3. **Presentation (Input)** - User input is reasonable

**What to validate where:**

- **Domain:** Structural integrity, core business rules
- **Application:** Uniqueness, permissions, cross-aggregate rules
- **Presentation:** Format, required fields, UX

**In Our Project:**

- Domain: `ensureValidName()` in Category
- Application: Check category name uniqueness
- Presentation: Form validation before submit

**Pattern:**

```typescript
// Presentation validates input
if (!validateForm()) return;

// Application validates context
const validation = validator.validate(command);
if (!validation.isValid) throw new ValidationError(...);

// Domain validates invariants
const category = new Category({ name }); // Throws if invalid
```

**Key Principle:** Each layer validates what it knows about. Domain is the ultimate guardian of validity.

---

## Related Documents

- [Invariants](./invariants.md)
- [Domain Errors](./domain-errors.md)
- [Application Layer](./application-layer.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 5: A Model Expressed in Software)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 6: Entities)
- **Clean Architecture** by Robert C. Martin
