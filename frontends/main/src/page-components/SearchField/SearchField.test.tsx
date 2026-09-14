import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { SearchField } from "./SearchField"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(),
}))

const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

/**
 * In the app, `onSubmit` triggers a router navigation that has not committed
 * when `capture` runs, so the URL posthog reads is one query behind. This
 * `onSubmit` leaves the surrounding state untouched to reproduce that.
 */
const ControlledSearchField = ({ onSubmit }: { onSubmit: () => void }) => {
  const [value, setValue] = React.useState("")
  return (
    <SearchField
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClear={() => setValue("")}
      onSubmit={onSubmit}
    />
  )
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
  mockCapture.mockClear()
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
})

test.each([
  { label: "Enter key", isEnter: true },
  { label: "search button", isEnter: false },
])("Submitting via $label captures the submitted term", async ({ isEnter }) => {
  const onSubmit = jest.fn()
  renderWithProviders(<ControlledSearchField onSubmit={onSubmit} />, {
    url: "/search?q=design",
  })

  const input = screen.getByRole("textbox", { name: "Search for" })
  await user.type(input, "policy")
  if (isEnter) {
    await user.type(input, "{Enter}")
  } else {
    await user.click(screen.getByRole("button", { name: "Search" }))
  }

  expect(onSubmit).toHaveBeenCalledTimes(1)
  expect(mockCapture).toHaveBeenCalledExactlyOnceWith(
    PostHogEvents.SearchUpdate,
    { search_term: "policy", isEnter },
  )
})

test("No event is captured without a posthog key", async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  renderWithProviders(<ControlledSearchField onSubmit={jest.fn()} />)

  const input = screen.getByRole("textbox", { name: "Search for" })
  await user.type(input, "policy{Enter}")

  expect(mockCapture).not.toHaveBeenCalled()
})
