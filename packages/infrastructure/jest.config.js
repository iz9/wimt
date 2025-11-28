import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/expo-sqlite*"],
  moduleNameMapper: {
    "^drizzle-orm/expo-sqlite$": "<rootDir>/src/__mocks__/drizzle-expo.ts",
  },
};
