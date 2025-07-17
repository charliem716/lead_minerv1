// Jest setup file for Lead Miner Agent tests

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SERPAPI_KEY = 'test-serpapi-key';
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
process.env.GOOGLE_PRIVATE_KEY = 'test-private-key';
process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CONFIDENCE_THRESHOLD = '0.85';
process.env.MAX_LEADS_PER_DAY = '10';
process.env.BUDGET_LIMIT = '50';

// Extend expect with custom matchers if needed
// expect.extend({
//   // custom matchers can be added here
// });

// Global test setup
beforeEach(() => {
  // Clear any mocks or reset state before each test
  jest.clearAllMocks();
});

// Global test teardown
afterEach(() => {
  // Clean up after each test
});

// Configure console output for tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Only show console.error in tests if it's not expected
  if (args[0]?.includes && !args[0].includes('Test error')) {
    originalConsoleError(...args);
  }
}; 