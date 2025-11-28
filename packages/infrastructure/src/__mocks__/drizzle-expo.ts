/**
 * Mock for drizzle-orm/expo-sqlite to prevent Jest from loading React Native code
 * This mock is only used in tests - production code uses the real drizzle-orm/expo-sqlite
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const drizzle = (..._args: any[]): any => {
  throw new Error(
    "drizzle-orm/expo-sqlite should not be called in tests. Use sql.js mock instead.",
  );
};
