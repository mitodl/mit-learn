---
applyTo: "**/*.test.ts,**/*.test.tsx"
---

## Guidelines for writing frontend tests

- `@testing-library/react` and `@testing-library/user-event` for rendering, querying, and manipulation
- within the `main` package, use `renderWithProviders` from `@/test-utils` to render components with the necessary context providers
- use `setMockResponse` and `urls` from `api/src/test-utils` for mocking API calls in tests
- data factories for tests live in `api/src/test-utils/factories`. API Calls should be
