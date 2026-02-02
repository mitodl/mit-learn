# Playwright E2E Testing

Playwright is set up for end-to-end testing of the MIT Learn frontend.

## Setup

Playwright is installed during the Docker build process, so it's ready to use immediately after building the watch container.

**Rebuild after updates:**

```bash
docker-compose build watch
docker-compose up -d watch
```

## Running Tests

**Prerequisites:** Make sure all services are running:

```bash
docker-compose up -d  # Start backend, nginx, and watch services
```

**Run tests:**

```bash
# Run all tests (defaults to http://nginx:8063 in Docker)
docker exec -it mit-learn-watch-1 yarn playwright

# Run against RC environment
docker exec -it mit-learn-watch-1 yarn playwright:rc

# Run against CI environment
docker exec -it mit-learn-watch-1 yarn playwright:ci

# Run specific test file
docker exec -it mit-learn-watch-1 yarn playwright e2e/smoke.spec.ts

# Run with UI mode (interactive)
docker exec -it mit-learn-watch-1 yarn playwright:ui

# View test report
docker exec -it mit-learn-watch-1 yarn playwright:report
```

## Configuration

- **Base URL**: Defaults to `http://nginx:8063` (Docker service name), configurable via `PLAYWRIGHT_BASE_URL` environment variable
- **Tests**: Located in `e2e/` directory
- **Videos**: Recorded on failure, saved to `test-results/`
- **Screenshots**: Captured on failure
- **Traces**: Captured on first retry for debugging

## Writing Tests

Create test files in `e2e/` with the `.spec.ts` extension:

```typescript
import { test, expect } from "@playwright/test"

test.describe("My Feature", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("Success")).toBeVisible()
  })
})
```

Playwright uses built-in locators like `getByRole`, `getByText`, etc. for accessible queries.

## Debugging

- **UI Mode**: Run `yarn playwright:ui` for interactive debugging
- **Traces**: View traces in the HTML report after test failures
- **Videos**: Check `test-results/` directory for failure videos
