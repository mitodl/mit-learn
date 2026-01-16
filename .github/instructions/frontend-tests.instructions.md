---
applyTo: "**/*.test.ts,**/*.test.tsx"
---

# Frontend Testing Guidelines

## Quick Reference

```tsx
// 1. Mock APIs
import { setMockResponse, urls, factories } from "api/test-utils"
setMockResponse.get(
  urls.channels.list(),
  factories.channels.channels({ count: 3 }),
)

// 2. Render with providers
import { renderWithProviders, screen, user } from "@/test-utils"
renderWithProviders(<MyComponent />)

// 3. Query & interact
await user.click(screen.getByRole("button", { name: "Submit" }))
await screen.findByText("Success")
```

## Framework & Tools

- **Jest** + **JSDOM** + **React Testing Library** + **@testing-library/user-event**
- Tests are co-located with source files and end in `.test.ts` or `.test.tsx`

## Best Practices

1. **Query by role/label/text** (not class names or implementation details)
2. **Use factories for all test data** (don't manually construct objects)
3. **Mock all API calls** with `setMockResponse` before rendering
4. **Use `findBy*` for async content** (NOT `waitFor` combined with `getBy*`)
5. **Write descriptive test names** from user perspective
6. **User interactions:** prefer `@testing-library/user-event` over `fireEvent`

## Rendering Components

**In the `main` workspace (Next.js):**

```tsx
import { renderWithProviders, screen, user } from "@/test-utils"

renderWithProviders(<MyComponent />, {
  url: "/page?param=value", // optional
})
```

- In `frontends/main`, avoid importing and calling `render` from `@testing-library/react` directly; prefer `renderWithProviders` so tests use the same providers as the app.

**In other workspaces:**

```tsx
import { renderWithTheme } from "ol-components/test-utils"
renderWithTheme(<StyledComponent />)
```

## Mocking API Calls

Unmocked API calls will result in test failures.

**Import pattern varies by API:**

```tsx
// MIT Learn APIs - standard imports
import { setMockResponse, urls, factories } from "api/test-utils"

// MITxOnline APIs - separate test utils (note the aliases)
import { setMockResponse } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
```

**Usage is the same regardless:**

```tsx
// MIT Learn example
const channel = factories.channels.channel({ title: "Test" })
setMockResponse.get(
  urls.channels.details(channel.channel_type, channel.name),
  channel,
)

// MITxOnline example
const program = mitxFactories.programs.program()
setMockResponse.get(mitxUrls.pages.programPages(program.readable_id), program)
```

**Mock options:**

```tsx
setMockResponse.get(url, data) // Basic
setMockResponse.get(url, "Not Found", { code: 404 }) // Custom status
setMockResponse.post(url, data, {
  requestBody: expect.objectContaining({ id: 5 }),
}) // Body match
setMockResponse.get(
  expect.stringContaining(urls.learningResources.list()),
  data,
) // Partial URL
```

## Queries & Interactions

```tsx
// use queryBy alternatives to check for non-existence, findBy for async content
// getByAll, etc, when multiple matches expected
screen.getByRole("button", { name: "Submit" }) // Preferred role-based queries where possible
screen.getByLabelText("Email")
screen.getByText("Hello")
screen.getByTestId("custom-element")
// getBy, findBy include asserting in doc, extra expect() unnecessary
```

**User interactions:**

```tsx
await user.click(button)
await user.type(input, "text")
await user.clear(input)
```

**Scoped queries:**

```tsx
import { within } from "@/test-utils"
const card = screen.getByTestId("user-card")
within(card).getByText("John Doe")
```

## Factories

Use factories for test data. Override only properties you're testing.

```tsx
const channel = factories.channels.channel() // Use defaults
const course = factories.learningResources.resource({ resource_type: "course" }) // Override when needed
const resources = factories.learningResources.resources({ count: 5 }) // Lists
```

## Common Patterns

**Setup helpers & auth:**

```tsx
const setupApis = () => {
  const user = factories.user.user({ [Permission.ArticleEditor]: true })
  const data = factories.learningResources.resource()
  setMockResponse.get(urls.userMe.get(), user)
  setMockResponse.get(urls.learningResources.details({ id: data.id }), data)
  return { user, data }
}
```

**Mocking modules:**

```tsx
jest.mock("./Component", () => ({
  Component: jest.fn(() => <div>Mocked</div>),
}))
jest.mock("next/navigation", () =>
  jest.requireActual("next-router-mock/navigation"),
)
```

**Expected errors:**

```tsx
import { allowConsoleErrors } from "ol-test-utilities"
const { consoleError } = allowConsoleErrors()
// Usually errors caught and logged
expect(consoleError).toHaveBeenCalled()
// In rare cases, TestingErrorBoundary can be used to test thrown errors.
```

## Troubleshooting

- **"No response specified"** → Mock the API call with `setMockResponse`
- **"Unable to find element"** → Use `findBy*` for async, check with `screen.debug()`
- **"Unable to find role"** → Check accessibility attributes or use `getByText`/`getByTestId`
