import "@testing-library/jest-dom";


// 1. Global Mock for Appwrite Configuration & SDK Methods
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