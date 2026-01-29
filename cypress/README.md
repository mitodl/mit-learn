# Cypress E2E Testing

Cypress is set up for end-to-end testing of the MIT Learn frontend.

## Setup

Cypress is installed during the Docker build process, so it's ready to use immediately after building the watch container.

## Running Tests

**Prerequisites:** Make sure all services are running:

```bash
docker-compose up -d  # Start backend, nginx, and watch services
```

**Run tests:**

```bash
# Run all tests
docker exec -it mit-learn-watch-1 yarn cypress

# Run specific test file
docker exec -it mit-learn-watch-1 yarn cypress --spec "cypress/e2e/smoke.cy.ts"

# Run with custom base URL
docker exec -it mit-learn-watch-1 bash -c "CYPRESS_BASE_URL=http://nginx:8063 yarn cypress"
```

## Configuration

- **Base URL**: Defaults to `http://nginx:8063` (Docker service name), configurable via `CYPRESS_BASE_URL` environment variable
  - For local runs outside Docker: set `CYPRESS_BASE_URL=http://localhost:9080`
- **Tests**: Located in `cypress/e2e/`
- **Custom commands**: Define in `cypress/support/e2e.js`
- **TypeScript support**: Configured in `cypress/tsconfig.json`
- **Videos**: Enabled by default, saved to `cypress/videos/`
- **Screenshots**: Captured on test failure, saved to `cypress/screenshots/`

## Writing Tests

Create test files in `cypress/e2e/` with the `.cy.ts` or `.cy.js` extension:

```typescript
describe("My Feature", () => {
  it("should do something", () => {
    cy.visit("/")
    cy.findByRole("button", { name: "Submit" }).click()
    cy.findByText("Success").should("exist")
  })
})
```

Uses `@testing-library/cypress` for accessible queries like `findByRole`, `findByText`, etc.
