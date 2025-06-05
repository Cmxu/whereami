import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
	testDir: './tests',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		['list'], // Simple list reporter for console output
		['html', { open: 'never' }] // Generate HTML report but never auto-open
	],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/config#global-configuration */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: 'https://whereami-5kp.pages.dev',
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		/* Take screenshot on failure */
		screenshot: 'only-on-failure',
		/* Run headless by default */
		headless: true
	},

	/* Configure projects for major browsers */
	projects: [
		// Setup project for authentication - always headless
		{
			name: 'setup',
			testMatch: /.*\.setup\.ts/,
			use: {
				headless: true // Always headless for setup
			}
		},

		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				headless: true,
				// Use prepared auth state
				storageState: 'playwright/.auth/user.json'
			},
			dependencies: ['setup']
		},

		{
			name: 'firefox',
			use: {
				...devices['Desktop Firefox'],
				headless: true,
				// Use prepared auth state
				storageState: 'playwright/.auth/user.json'
			},
			dependencies: ['setup']
		},

		{
			name: 'webkit',
			use: {
				...devices['Desktop Safari'],
				headless: true,
				// Use prepared auth state
				storageState: 'playwright/.auth/user.json'
			},
			dependencies: ['setup']
		},

		// Project for tests that don't need authentication
		{
			name: 'no-auth',
			use: {
				...devices['Desktop Chrome'],
				headless: true, // Explicitly ensure headless
				// Reset storage state for unauthenticated tests
				storageState: { cookies: [], origins: [] }
			},
			testMatch: /.*no-auth.*\.spec\.(js|ts)/
		},

		// Project for API tests that don't need browser auth
		{
			name: 'api-tests',
			use: {
				...devices['Desktop Chrome'],
				headless: true // Explicitly ensure headless
			},
			testMatch: /.*api.*\.spec\.(js|ts)|.*api.*\.js/
		}
	]

	/* Run your local dev server before starting the tests */
	// webServer: {
	//   command: 'npm run start',
	//   url: 'http://127.0.0.1:3000',
	//   reuseExistingServer: !process.env.CI,
	// },
});
