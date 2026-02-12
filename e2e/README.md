# Playwright E2E Testing

Playwright is set up for end-to-end testing of the MIT Learn frontend. Tests are located in the `e2e/` directory and can be run inside the `watch` Docker container.

We would like this to be able to run in several contexts:

- Locally, against the Dockerized mit-learn services using synthetic data we populate by script.
- Against the RC environment, using known good OR synthetic data we populate via script. Eventually, we'd like this to be an automated quality gate.

With good test coverage running in these contexts, we can have more confidence that changes to the frontend won't break critical user flows, and by establishing and maintaining a synthetic dataset, we may also be able to formalize and automate getting representative data onto local machines to reduce the need for manual testcase setup.

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

You should also ensure that mitxonline is running locally for any pages which need API data.

**Run tests:**

```bash
# Run all tests (defaults to http://nginx:8063 in Docker)
docker exec -it mit-learn-watch-1 yarn playwright

# Run all tests against a specific Base URL
docker exec -it -e PLAYWRIGHT_BASE_URL=http://learn.odl.local:9080 mit-learn-watch-1 yarn playwright

# Run all tests with specific test and assertion timeouts
docker exec -it -e PLAYWRIGHT_TIMEOUT=60000 -e PLAYWRIGHT_EXPECT_TIMEOUT=10000 mit-learn-watch-1 yarn playwright

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
- **Traces**: Captured on failure, saved to `test-results/`. This contains DOM state and network calls, useful for non-obvious issues.

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
- **Traces**: Check `test-results/` for trace files, these can be uploaded to https://trace.playwright.dev/
- **Videos**: Check `test-results/` directory for failure videos

By default, on failure it'll serve up an HTML report with traces and screenshots for debugging, accessible at localhost:9229

## Common Test failure modes

- **Timeouts**:
  - Increase timeout in `playwright.config.ts` if tests are slow. Locals appear to be significantly slower than production in some cases. Full test timeout can be changed by setting the `PLAYWRIGHT_TIMEOUT` environment variable and the per assertion timeout can be set via `PLAYWRIGHT_EXPECT_TIMEOUT`. More information can be found here, and if they are not set we use the [playwright defaults](https://playwright.dev/docs/test-timeouts)
  - If the page appears blank, ensure that the URL can be resolved from within the Docker container. You may need to add host entries in `docker-compose.yml` for local domains. You can always attempt to `curl` the URL in question to determine if it is reachable
