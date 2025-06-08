# Playwright Test Setup

## Overview

This document describes the Playwright test setup for the WhereAmI application. Tests are fully automated and headless using direct Supabase authentication.

## Configuration Changes

1. **Fully headless**: All tests run headless including authentication setup
2. **Base URL**: Uses `https://geo.cmxu.io` (always contains the most up-to-date deployment)
3. **Authentication**: Automated using direct Supabase client authentication
4. **HTML Report**: HTML reports are generated but never auto-open to avoid interrupting workflow

## Environment Variables

Create a `.env` file in the project root with your test credentials:

```env
# Test credentials for Playwright
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
```

**Security Note**: The `.env` file is already in `.gitignore` so your credentials won't be committed to the repository.

## Running Tests

### All Tests (headless)

```bash
npx playwright test
```

### Specific Test File

```bash
npx playwright test tests/check-website-errors.spec.js
```

### View HTML Report (when needed)

```bash
npx playwright show-report
```

## Authentication Setup

The authentication setup (`tests/auth.setup.ts`) will:

1. Navigate to the home page
2. Directly authenticate using the Supabase client API with provided credentials
3. Save authentication state to `playwright/.auth/user.json`
4. Verify authentication by checking protected routes
5. Run completely headless in all environments

## Test Structure

- **Setup project**: Handles authentication setup (always headless)
- **Main browsers**: chromium, firefox, webkit (all headless, use saved auth state)

## URLs

All tests use `https://geo.cmxu.io` as the base URL, which always contains the most up-to-date deployment.

## Reports

- **Console output**: Uses list reporter for clean console output during test runs
- **HTML report**: Generated but never auto-opens (use `npx playwright show-report` to view when needed)
- **Screenshots**: Test screenshots are saved to `tests/screenshots/` for debugging and verification

## Environment Variables

- `TEST_EMAIL`: Email address for test authentication
- `TEST_PASSWORD`: Password for test authentication

## Screenshots

Test screenshots are saved to `tests/screenshots/` for debugging and verification.

## Troubleshooting

If authentication fails:

1. Verify your credentials in the `.env` file
2. Check the authentication setup screenshot at `tests/screenshots/auth-setup-complete.png`
3. Ensure your test account exists and has proper permissions
4. Review console output for authentication errors
