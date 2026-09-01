import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Properly handle ESM default export + TypeScript types + JSX syntax
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => (
    React.createElement("div", null, children),
  ),
}));

// Polyfill TextEncoder and TextDecoder for Next.js server streams in JSDOM
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// Require undici AFTER TextDecoder is attached to global (prevents hoisting)
const { Request, Response, Headers } = require("undici");
// Polyfill Web Fetch API globals for Next.js server features in JSDOM
if (typeof global.Request === "undefined") {
  global.Request = Request as unknown as typeof global.Request;
}
if (typeof global.Response === "undefined") {
  global.Response = Response as unknown as typeof global.Response;
}
if (typeof global.Headers === "undefined") {
  global.Headers = Headers as unknown as typeof global.Headers;
}

if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
}

if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
  window.HTMLElement.prototype.hasPointerCapture = jest.fn();
  window.HTMLElement.prototype.releasePointerCapture = jest.fn();
}
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Global Mock for Appwrite Configuration & SDK Methods
jest.mock("@/lib/actions/appwrite.config", () => {
  // Create mock instances of Appwrite services with basic chainable/spy methods
  const mockClient = {
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  };

  const mockDatabases = {
    createDocument: jest.fn(() => Promise.resolve({ $id: "mock-doc-id" })),
    getDocument: jest.fn(() => Promise.resolve({ $id: "mock-doc-id", data: {} })),
    updateDocument: jest.fn(() => Promise.resolve({ $id: "mock-doc-id" })),
    deleteDocument: jest.fn(() => Promise.resolve(true)),
    listDocuments: jest.fn(() => Promise.resolve({ total: 0, documents: [] })),
  };

  const mockUsers = {
    create: jest.fn(() => Promise.resolve({ $id: "mock-user-id" })),
    get: jest.fn(() => Promise.resolve({ $id: "mock-user-id" })),
  };

  const mockStorage = {
    createFile: jest.fn(() => Promise.resolve({ $id: "mock-file-id" })),
    getFileDownload: jest.fn(() => "https://example.com/mock-file"),
    deleteFile: jest.fn(() => Promise.resolve(true)),
  };

  const mockMessaging = {
    createSms: jest.fn(() => Promise.resolve({ $id: "mock-msg-id" })),
  };

  return {
    ENDPOINT: "https://mock-endpoint.appwrite.io/v1",
    PROJECT_ID: "mock-project-id",
    API_KEY: "mock-api-key",
    DATABASE_ID: "mock-database-id",
    PATIENT_COLLECTION_ID: "mock-patient-id",
    DOCTOR_COLLECTION_ID: "mock-doctor-id",
    APPOINTMENT_COLLECTION_ID: "mock-appointment-id",
    BUCKET_ID: "mock-bucket-id",
    BUCKET_URL: "https://mock-bucket.url",
    client: mockClient,
    databases: mockDatabases,
    users: mockUsers,
    messaging: mockMessaging,
    storage: mockStorage,
  };
});

// 2. Clear out noise and warning messages (fetchPriority, act, etc.)
const originalError = console.error;
const hideNoise = (...args: any[]) => {
  const message = args.join(" ");
  if (message.toLowerCase().includes("fetchpriority")) {
    return;
  }
  if (message.includes("not wrapped in act(...)")) {
    return;
  }
  originalError.call(console, ...args);
};

console.error = hideNoise;
console.warn = hideNoise;