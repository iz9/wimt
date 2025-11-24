# React Native Integration

## Connecting Clean Architecture to React Native

**React Native** is your **Presentation Layer**. It should be kept separate from your domain and application logic, communicating through well-defined interfaces.

### Key Principle

> "React Native renders UI and handles user interaction. Domain and application layers contain all business logic."

**The Architecture Flow:**

```
User Interaction
      ↓
React Component
      ↓
Custom Hook (useCreateCategory)
      ↓
DI Container
      ↓
Use Case (CreateCategoryUseCase)
      ↓
Domain (Category entity)
      ↓
Repository (ICategoryRepository)
      ↓
Infrastructure (AsyncStorage/SQLite)
```

---

## Project Structure

```
apps/mobile/                    # React Native app
├── src/
│   ├── screens/
│   │   ├── categories/
│   │   │   ├── CategoryListScreen.tsx
│   │   │   ├── CreateCategoryScreen.tsx
│   │   │   └── CategoryDetailScreen.tsx
│   │   └── sessions/
│   │       ├── SessionListScreen.tsx
│   │       └── ActiveSessionScreen.tsx
│   ├── components/
│   │   ├── CategoryCard.tsx
│   │   ├── SessionTimer.tsx
│   │   └── DurationDisplay.tsx
│   ├── hooks/
│   │   ├── useContainer.ts           # DI container
│   │   ├── category/
│   │   │   ├── useCreateCategory.ts
│   │   │   ├── useListCategories.ts
│   │   │   └── useDeleteCategory.ts
│   │   └── session/
│   │       ├── useStartSession.ts
│   │       ├── usePauseSession.ts
│   │       └── useActiveSession.ts
│   ├── navigation/
│   │   └── AppNavigator.tsx
│   └── App.tsx

packages/application/           # Use cases
packages/domain/                # Domain logic
packages/infrastructure/        # Persistence, DI
```

---

## Setting Up DI Container

### Container Provider

```typescript
// hooks/useContainer.ts
import { Container } from 'inversify';
import { createContext, useContext, useMemo } from 'react';
import { createContainer } from '@wimt/infrastructure/di/container';

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({ children }: { children: React.ReactNode }) {
  // Create container once
  const container = useMemo(() => createContainer(), []);

  return (
    <ContainerContext.Provider value={container}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useContainer(): Container {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error('useContainer must be used within ContainerProvider');
  }
  return context;
}
```

### App Setup

```typescript
// App.tsx
import React from 'react';
import { ContainerProvider } from './hooks/useContainer';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './navigation/AppNavigator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ContainerProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </ContainerProvider>
  );
}
```

---

## Custom Hooks Pattern

### Command Hook (Mutations)

```typescript
// hooks/category/useCreateCategory.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../useContainer';
import { TYPES } from '@wimt/infrastructure/di/types';
import { CreateCategoryUseCase } from '@wimt/application/useCases/category/CreateCategoryUseCase';
import { CreateCategoryCommand } from '@wimt/application/commands/CreateCategoryCommand';

export function useCreateCategory() {
  const container = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      // Get use case from container
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase
      );

      // Execute
      return await useCase.execute(command);
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => {
      console.error('Failed to create category:', error);
    }
  });
}

// Usage in component
export function CreateCategoryScreen() {
  const [name, setName] = useState('');
  const createCategory = useCreateCategory();

  const handleSubmit = async () => {
    try {
      await createCategory.mutateAsync({ name });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create category');
    }
  };

  return (
    <View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Category name"
      />
      <Button
        title="Create"
        onPress={handleSubmit}
        disabled={createCategory.isPending}
      />
      {createCategory.isPending && <ActivityIndicator />}
    </View>
  );
}
```

### Query Hook (Reads)

```typescript
// hooks/category/useListCategories.ts
import { useQuery } from '@tanstack/react-query';
import { useContainer } from '../useContainer';
import { TYPES } from '@wimt/infrastructure/di/types';
import { ListCategoriesQuery } from '@wimt/application/queries/category/ListCategoriesQuery';
import { CategoryDTO } from '@wimt/application/dtos/CategoryDTO';

export function useListCategories() {
  const container = useContainer();

  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<CategoryDTO[]> => {
      const query = container.get<ListCategoriesQuery>(
        TYPES.ListCategoriesQuery
      );
      return await query.execute({});
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Usage in component
export function CategoryListScreen() {
  const { data: categories, isLoading, error } = useListCategories();

  if (isLoading) {
    return <ActivityIndicator />;
  }

  if (error) {
    return <ErrorView message="Failed to load categories" />;
  }

  return (
    <FlatList
      data={categories}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <CategoryCard category={item} />}
    />
  );
}
```

### Session Management Hooks

```typescript
// hooks/session/useStartSession.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContainer } from "../useContainer";
import { TYPES } from "@wimt/infrastructure/di/types";
import { StartSessionUseCase } from "@wimt/application/useCases/session/StartSessionUseCase";

export function useStartSession() {
  const container = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const useCase = container.get<StartSessionUseCase>(
        TYPES.StartSessionUseCase,
      );
      return await useCase.execute({ categoryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    },
  });
}

// hooks/session/useActiveSession.ts
import { useQuery } from "@tanstack/react-query";
import { useContainer } from "../useContainer";
import { TYPES } from "@wimt/infrastructure/di/types";
import { GetActiveSessionQuery } from "@wimt/application/queries/session/GetActiveSessionQuery";

export function useActiveSession() {
  const container = useContainer();

  return useQuery({
    queryKey: ["activeSession"],
    queryFn: async () => {
      const query = container.get<GetActiveSessionQuery>(
        TYPES.GetActiveSessionQuery,
      );
      return await query.execute({});
    },
    refetchInterval: 1000, // Refetch every second for live timer
  });
}

// hooks/session/usePauseSession.ts
export function usePauseSession() {
  const container = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const useCase = container.get<PauseSessionUseCase>(
        TYPES.PauseSessionUseCase,
      );
      return await useCase.execute({ sessionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
```

---

## Components

### Category Card

```typescript
// components/CategoryCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CategoryDTO } from '@wimt/application/dtos/CategoryDTO';
import { useNavigation } from '@react-navigation/native';

interface CategoryCardProps {
  category: CategoryDTO;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('CategoryDetail', { id: category.id })}
    >
      <View
        style={[
          styles.colorIndicator,
          { backgroundColor: category.color || '#999' }
        ]}
      />

      <View style={styles.content}>
        <Text style={styles.name}>{category.name}</Text>
        <Text style={styles.stats}>
          {category.sessionCount} sessions · {formatDuration(category.totalDurationMs)}
        </Text>
      </View>

      {category.icon && (
        <Text style={styles.icon}>{category.icon}</Text>
      )}
    </TouchableOpacity>
  );
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stats: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  icon: {
    fontSize: 24,
  },
});
```

### Session Timer

```typescript
// components/SessionTimer.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useActiveSession } from '../hooks/session/useActiveSession';

export function SessionTimer() {
  const { data: activeSession } = useActiveSession();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return;
    }

    // Update timer every second
    const interval = setInterval(() => {
      const now = Date.now();
      const duration = now - activeSession.startTime;
      setElapsed(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  if (!activeSession) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.categoryName}>{activeSession.categoryName}</Text>
      <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
      <View style={[styles.statusIndicator, styles.active]} />
    </View>
  );
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const displayHours = hours;
  const displayMinutes = minutes % 60;
  const displaySeconds = seconds % 60;

  return `${pad(displayHours)}:${pad(displayMinutes)}:${pad(displaySeconds)}`;
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    fontVariant: ['tabular-nums'],
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 12,
  },
  active: {
    backgroundColor: '#34C759',
  },
});
```

---

## Screens

### Category List Screen

```typescript
// screens/categories/CategoryListScreen.tsx
import React from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useListCategories } from '../../hooks/category/useListCategories';
import { CategoryCard } from '../../components/CategoryCard';
import { useNavigation } from '@react-navigation/native';

export function CategoryListScreen() {
  const navigation = useNavigation();
  const { data: categories, isLoading, error } = useListCategories();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load categories</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <CategoryCard category={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No categories yet</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateCategory')}
            >
              <Text style={styles.createButtonText}>Create Category</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCategory')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 32,
  },
  error: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
  },
  retry: {
    fontSize: 16,
    color: '#007AFF',
  },
});
```

### Active Session Screen

```typescript
// screens/sessions/ActiveSessionScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useActiveSession } from '../../hooks/session/useActiveSession';
import { usePauseSession } from '../../hooks/session/usePauseSession';
import { useStopSession } from '../../hooks/session/useStopSession';
import { SessionTimer } from '../../components/SessionTimer';

export function ActiveSessionScreen() {
  const { data: activeSession } = useActiveSession();
  const pauseSession = usePauseSession();
  const stopSession = useStopSession();

  const handlePause = async () => {
    if (!activeSession) return;

    try {
      await pauseSession.mutateAsync(activeSession.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to pause session');
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;

    Alert.alert(
      'Stop Session',
      'Are you sure you want to stop this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            try {
              await stopSession.mutateAsync(activeSession.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to stop session');
            }
          }
        }
      ]
    );
  };

  if (!activeSession) {
    return (
      <View style={styles.center}>
        <Text style={styles.noSession}>No active session</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SessionTimer />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.pauseButton]}
          onPress={handlePause}
          disabled={pauseSession.isPending}
        >
          <Text style={styles.buttonText}>
            {activeSession.isActive ? 'Pause' : 'Resume'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.stopButton]}
          onPress={handleStop}
          disabled={stopSession.isPending}
        >
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSession: {
    fontSize: 18,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## Error Handling in UI

### Error Boundary

```typescript
// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
    // Log to error reporting service
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Oops! Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Toast Notifications

```typescript
// hooks/useToast.ts
import { useCallback } from "react";
import Toast from "react-native-toast-message";

export function useToast() {
  const showSuccess = useCallback((message: string) => {
    Toast.show({
      type: "success",
      text1: "Success",
      text2: message,
    });
  }, []);

  const showError = useCallback((message: string) => {
    Toast.show({
      type: "error",
      text1: "Error",
      text2: message,
    });
  }, []);

  return { showSuccess, showError };
}

// Usage
export function CreateCategoryScreen() {
  const createCategory = useCreateCategory();
  const toast = useToast();

  const handleSubmit = async () => {
    try {
      await createCategory.mutateAsync({ name });
      toast.showSuccess("Category created successfully");
      navigation.goBack();
    } catch (error) {
      if (error instanceof DuplicateCategoryError) {
        toast.showError("Category already exists");
      } else {
        toast.showError("Failed to create category");
      }
    }
  };
}
```

---

## Offline Support

### Optimistic Updates

```typescript
// hooks/category/useCreateCategory.ts
export function useCreateCategory() {
  const container = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase,
      );
      return await useCase.execute(command);
    },
    onMutate: async (command) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(["categories"]);

      // Optimistically update
      queryClient.setQueryData(["categories"], (old: CategoryDTO[]) => [
        ...old,
        {
          id: "temp-" + Date.now(),
          name: command.name,
          color: null,
          icon: null,
          sessionCount: 0,
          totalDurationMs: 0,
          createdAt: Date.now(),
        },
      ]);

      return { previous };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["categories"], context.previous);
      }
    },
    onSettled: () => {
      // Refetch to get real data
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
```

---

## Best Practices

### ✅ DO:

**1. Use custom hooks for all use cases**

```typescript
// ✅ Good - Encapsulated in hook
const createCategory = useCreateCategory();
await createCategory.mutateAsync({ name });

// ❌ Bad - DI in component
const useCase = container.get(TYPES.CreateCategoryUseCase);
await useCase.execute({ name });
```

**2. Use React Query for state management**

```typescript
// ✅ Good - React Query handles caching, refetching
const { data: categories } = useListCategories();

// ❌ Bad - Manual state management
const [categories, setCategories] = useState([]);
useEffect(() => {
  loadCategories().then(setCategories);
}, []);
```

**3. Handle errors gracefully**

```typescript
// ✅ Good - User-friendly messages
catch (error) {
  if (error instanceof DuplicateCategoryError) {
    toast.showError('Category already exists');
  } else {
    toast.showError('Failed to create category');
  }
}
```

**4. Use TypeScript for type safety**

```typescript
// ✅ Good - Typed DTOs
const { data: categories } = useListCategories(); // CategoryDTO[]

// ❌ Bad - Untyped
const { data: categories } = useListCategories(); // any
```

### ❌ DON'T:

**1. Don't put business logic in components**

```typescript
// ❌ Bad - Business logic in component
const handlePause = () => {
  if (session.segments.every((s) => s.stoppedAt !== null)) {
    // Business logic!
  }
};

// ✅ Good - Business logic in domain
const handlePause = async () => {
  await pauseSession.mutateAsync(sessionId);
};
```

**2. Don't access repositories directly**

```typescript
// ❌ Bad - Component using repository
const repo = container.get<ICategoryRepository>(TYPES.ICategoryRepository);
const categories = await repo.findAll();

// ✅ Good - Component using query
const { data: categories } = useListCategories();
```

**3. Don't store domain objects in React state**

```typescript
// ❌ Bad - Domain object in state
const [session, setSession] = useState<Session>();

// ✅ Good - DTO in state
const [session, setSession] = useState<SessionDTO>();
```

---

## Summary

**React Native Integration:**

- Presentation layer only
- Use custom hooks for all use cases
- React Query for state management
- DI container provides use cases

**Pattern:**

```
Component → Hook → Container → Use Case → Domain
```

**Key Libraries:**

- `inversify` - Dependency injection
- `@tanstack/react-query` - State management
- `react-navigation` - Navigation

**Custom Hooks:**

- Commands: `useCreateCategory`, `useStartSession`
- Queries: `useListCategories`, `useActiveSession`
- Encapsulate DI container access

**Benefits:**

- Clean separation of concerns
- Testable components
- Type-safe
- Offline support
- Optimistic updates

---

## Related Documents

- [Dependency Injection](./dependency-injection.md)
- [Commands and Queries](./commands-and-queries.md)
- [DTOs and Mapping](./dtos-and-mapping.md)

---

## References

- **React Native Documentation** - https://reactnative.dev
- **TanStack Query** - https://tanstack.com/query
- **Clean Architecture** by Robert C. Martin
