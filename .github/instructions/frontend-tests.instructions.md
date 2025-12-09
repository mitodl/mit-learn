---
applyTo: "**/*.test.ts,**/*.test.tsx"
---

# Frontend Testing Guidelines

## Framework & Tools

- **Jest** + **JSDOM** + **React Testing Library** + **@testing-library/user-event**
- Tests are co-located with source files and end in `.test.ts` or `.test.tsx`

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

**MIT Learn APIs:**

```tsx
import { setMockResponse, urls, factories } from "api/test-utils"

const channel = factories.channels.channel({ title: "Test" })
setMockResponse.get(
  urls.channels.details(channel.channel_type, channel.name),
  channel,
)
```

**MITxOnline APIs:**

```tsx
import { setMockResponse } from "api/test-utils"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"

const program = mitxFactories.programs.program()

setMockResponse.get(mitxUrls.pages.programPages(program.readable_id), {
  items: [program],
})
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

**Testing loading states:**

```tsx
import { ControlledPromise } from "ol-test-utilities"

const response = new ControlledPromise()
setMockResponse.get(url, response)
renderWithProviders(<MyComponent />)
screen.getByText("Loading...")
response.resolve(data)
await screen.findByText("Loaded!")
```

## Queries & Interactions

**Finding elements (in priority order):**

```tsx
screen.getByRole("button", { name: "Submit" }) // Preferred
screen.getByLabelText("Email")
screen.getByText("Hello")
screen.getByTestId("custom-element")
screen.queryByText("Maybe not here") // Returns null if not found
await screen.findByText("Async content") // Waits for element
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

**Always use factories for test data:**

```tsx
const channel = factories.channels.channel() // Default
const course = factories.learningResources.resource({
  title: "Custom",
  resource_type: "course",
})
const resources = factories.learningResources.resources({ count: 5 }) // List
```

## Common Patterns

**Setup helper:**

```tsx
const setupApis = () => {
  const user = factories.user.user({ is_authenticated: true })
  const data = factories.learningResources.resource()
  setMockResponse.get(urls.userMe.get(), user)
  setMockResponse.get(urls.learningResources.details({ id: data.id }), data)
  return { user, data }
}
```

**Testing auth:**

```tsx
import { Permission } from "api/hooks/user"
const user = factories.user.user({ [Permission.Admin]: true })
setMockResponse.get(urls.userMe.get(), user)
```

**Mocking dependencies:**

```tsx
jest.mock("./Component", () => ({
  Component: jest.fn(() => <div>Mocked</div>),
}))
jest.mock("next/navigation", () =>
  jest.requireActual("next-router-mock/navigation"),
)
```

**Error handling:**

```tsx
import { allowConsoleErrors } from "ol-test-utilities"
const { consoleError } = allowConsoleErrors()
// test code
expect(consoleError).toHaveBeenCalled()
```

## Best Practices

1. **Query by role/label/text** (not class names or implementation details)
2. **Use factories for all test data** (don't manually construct objects)
3. **Mock all API calls** with `setMockResponse` before rendering
4. **Use `findBy*` for async content** (not `getBy*`)
5. **Write descriptive test names** from user perspective
6. **Keep tests focused** but multiple related assertions are fine

## Troubleshooting

- **"No response specified"** → Mock the API call with `setMockResponse`
- **"Unable to find element"** → Use `findBy*` for async, check with `screen.debug()`
- **"Unable to find role"** → Check accessibility attributes or use `getByText`/`getByTestId`
