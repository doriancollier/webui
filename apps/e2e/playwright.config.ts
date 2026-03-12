import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const PORT = process.env.DORKOS_PORT || '4242';
const VITE_PORT = process.env.VITE_PORT || '4241';

// Port for the test-mode server (TestModeRuntime). Uses a different port to
// avoid conflicting with the real server when both are running locally.
const MOCK_PORT = process.env.DORKOS_MOCK_PORT || '4243';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  timeout: 30_000,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    CI ? ['github'] : ['list'],
    ['./reporters/manifest-reporter.ts'],
  ],

  use: {
    baseURL: `http://localhost:${VITE_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: [
    {
      command: 'dotenv -- turbo dev --filter=@dorkos/server',
      url: `http://localhost:${PORT}/api/health`,
      name: 'Express API',
      timeout: 120_000,
      reuseExistingServer: !CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'dotenv -- turbo dev --filter=@dorkos/client',
      url: `http://localhost:${VITE_PORT}`,
      name: 'Vite Client',
      timeout: 120_000,
      reuseExistingServer: !CI,
      stdout: 'pipe',
    },
    // Test-mode server: uses TestModeRuntime (no real Claude API calls).
    // Only started when the mock-browser project runs — separated by port so it
    // does not interfere with the real server used by integration tests.
    {
      command: `DORKOS_TEST_RUNTIME=true DORKOS_PORT=${MOCK_PORT} dotenv -- turbo dev --filter=@dorkos/server`,
      url: `http://localhost:${MOCK_PORT}/api/health`,
      name: 'Express API (test-mode)',
      timeout: 120_000,
      reuseExistingServer: !CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [
    {
      // Standard integration project — runs all tests except mock-browser specs.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/chat-mock.spec.ts'],
    },
    {
      // Mock-browser project — runs chat-mock.spec.ts against the test-mode server.
      // No real Claude API calls; responses are controlled via /api/test/scenario.
      name: 'chromium-mock',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${VITE_PORT}`,
      },
      testMatch: ['**/chat-mock.spec.ts'],
    },
  ],
});
