import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config: Config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  // 1. Force explicit mapping for hoisted strings like jest.mock()
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // 2. Fallback lookup directories
  moduleDirectories: ["node_modules", "<rootDir>/src"],
  testMatch: [
    "<rootDir>/__tests__/unit-tests/**/*.test.{ts,tsx}",
    "<rootDir>/__tests__/integration-tests/**/*.test.{ts,tsx}",
  ],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/e2e/"],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
