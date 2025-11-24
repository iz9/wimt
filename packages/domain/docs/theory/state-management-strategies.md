# State Management Strategies

## Managing State in DDD Applications

In a clean architecture application, "state" is not a single global blob. It is divided into distinct categories with different lifecycles and owners.

### Key Principle

> "Separate Server State from Client State."

---

## 1. Server State vs. Client State

### Server State

Data that persists on the server (or local database).

- **Examples:** List of Categories, User Profile, Active Session.
- **Characteristics:** Asynchronous, shared, potentially stale.
- **Tool:** **React Query (TanStack Query)**.

### Client State

Data that exists only in the UI session.

- **Examples:** Is modal open? Form input value, Dark mode preference.
- **Characteristics:** Synchronous, local, temporary.
- **Tool:** **Zustand**, **React Context**, or **Local State**.

---

## 2. Managing Server State (React Query)

Don't put server data in Redux/Zustand. Use a cache.

**Pattern:**

```typescript
// Custom Hook wrapping Use Case
function useCategories() {
  const container = useContainer();

  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const useCase = container.get(ListCategoriesUseCase);
      return await useCase.execute();
    }
  });
}

// UI Component
function CategoryList() {
  const { data, isLoading } = useCategories();

  if (isLoading) return <Spinner />;
  return <FlatList data={data} ... />;
}
```

**Benefits:**

- Automatic caching & background refetching.
- Deduping requests.
- Loading/Error states built-in.
- Optimistic updates.

---

## 3. Managing Client State (Zustand)

For global UI state (like themes or user preferences), use a lightweight store.

**Pattern:**

```typescript
interface UIStore {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const useUIStore = create<UIStore>((set) => ({
  theme: "light",
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "light" ? "dark" : "light",
    })),
}));
```

**When to use:**

- Global UI settings.
- Complex multi-step form state (wizard).
- Session-only data that doesn't need persistence.

---

## 4. State Machines (XState)

For complex UI logic, boolean flags (`isLoading`, `isSuccess`, `isError`) explode in complexity. Use **State Machines**.

**Example: Session Timer UI**
States: `IDLE` -> `RUNNING` -> `PAUSED` -> `FINISHED`

```typescript
const sessionMachine = createMachine({
  id: "session",
  initial: "idle",
  states: {
    idle: { on: { START: "running" } },
    running: { on: { PAUSE: "paused", STOP: "finished" } },
    paused: { on: { RESUME: "running", STOP: "finished" } },
    finished: { type: "final" },
  },
});
```

**Benefits:**

- Impossible states become impossible.
- Visualizable logic.
- Deterministic behavior.

---

## 5. Optimistic Updates Deep Dive

Making the app feel instant by predicting the server response.

**The Flow:**

1. **User Action:** Click "Like".
2. **Optimistic Update:** Update UI to show "Liked" immediately.
3. **Network Request:** Send "Like" to API.
4. **Success:** Do nothing (UI is already correct).
5. **Failure:** Rollback UI to "Unliked" and show error.

**Implementation with React Query:**

```typescript
useMutation({
  onMutate: async (newItem) => {
    await queryClient.cancelQueries(["items"]);
    const previous = queryClient.getQueryData(["items"]);
    queryClient.setQueryData(["items"], (old) => [...old, newItem]);
    return { previous };
  },
  onError: (err, newItem, context) => {
    queryClient.setQueryData(["items"], context.previous);
  },
});
```

---

## 6. Form State (React Hook Form)

Don't use global state for forms. Use **React Hook Form**.

- **Uncontrolled Inputs:** Better performance (no re-renders on every keystroke).
- **Validation:** Integration with Zod/Yup.

```typescript
const { control, handleSubmit } = useForm({
  resolver: zodResolver(schema),
});

const onSubmit = (data) => createCategory.mutate(data);
```

---

## Summary

**Server State:** Use **React Query**. It handles caching, loading, and syncing.
**Client State:** Use **Zustand** for global UI state. Use **useState** for local component state.
**Complex Logic:** Use **State Machines** (XState) to avoid boolean flag hell.
**Forms:** Use **React Hook Form**.

**Anti-Pattern:** Putting everything in Redux.
**Best Practice:** Keep state as close to where it's used as possible.

---

## Related Documents

- [React Native Integration](./react-native-integration.md)
- [Offline-First Patterns](./offline-first-patterns.md)

---

## References

- **Thinking in React** (React Docs)
- **TanStack Query Documentation**
- **Zustand Documentation**
- **XState Documentation**
