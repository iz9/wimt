// Mock drizzle db client
export const createMockDbClient = () => {
  const storage = new Map<string, any>();

  return {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            const all = Array.from(storage.values());
            // Simple mock for eq condition
            const filtered = all.filter((row) => {
              // This is a simplified implementation
              return true;
            });
            return Promise.resolve(filtered.slice(0, n));
          },
        }),
        then: (resolve: any) => {
          resolve(Array.from(storage.values()));
        },
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => {
        storage.set(data.id, data);
        return Promise.resolve();
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => {
          storage.set(data.id, data);
          return Promise.resolve();
        },
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => {
        // Extract id from condition - this is a simplified mock
        const entries = Array.from(storage.entries());
        if (entries.length > 0) {
          storage.delete(entries[entries.length - 1]![0]);
        }
        return Promise.resolve();
      },
    }),
    _storage: storage, // For testing purposes
  };
};
