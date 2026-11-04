import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { SearchField } from "./SearchField"
import { PostHogEvents } from "@/common/constants"
import { capturePostHog } from "@/common/analytics/posthog"

jest.mock("@/common/analytics/posthog", () => ({
  capturePostHog: jest.fn(),
  initPostHog: jest.fn(),
}))

const mockCapturePostHog = jest.mocked(capturePostHog)

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
  mockCapturePostHog.mockClear()
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
  expect(mockCapturePostHog).toHaveBeenCalledExactlyOnceWith(
    PostHogEvents.SearchUpdate,
    { search_term: "policy", isEnter },
  )
})
