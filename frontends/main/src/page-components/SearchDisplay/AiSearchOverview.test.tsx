import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useAiChat } from "@mitodl/smoot-design/ai"
import AiSearchOverview from "./AiSearchOverview"
import type { RegisteredSearchParams } from "@/common/searchParams"

jest.mock("posthog-js/react")
jest.mock("@mitodl/smoot-design/ai", () => ({
  ...jest.requireActual("@mitodl/smoot-design/ai"),
  AiChatProvider: ({ children }: { children: React.ReactNode }) => children,
  AiChatDisplay: () => <div data-testid="ai-chat-display" />,
  useAiChat: jest.fn(),
}))

const mockUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockUseAiChat = jest.mocked(useAiChat)

const params = (q?: string) =>
  new URLSearchParams(q ? { q } : {}) as unknown as RegisteredSearchParams

const setupChat = (
  overrides: Partial<ReturnType<typeof useAiChat>> = {},
): jest.Mock => {
  const append = jest.fn()
  mockUseAiChat.mockReturnValue({
    messages: [],
    status: "submitted",
    append,
    ...overrides,
  } as unknown as ReturnType<typeof useAiChat>)
  return append
}

describe("AiSearchOverview", () => {
  beforeEach(() => {
    mockUseFeatureFlagEnabled.mockReturnValue(true)
  })

  test("renders nothing when the feature flag is disabled", () => {
    mockUseFeatureFlagEnabled.mockReturnValue(false)
    const append = setupChat()
    renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
    expect(screen.queryByText(/AI Overview/)).not.toBeInTheDocument()
    expect(append).not.toHaveBeenCalled()
  })

  test("renders nothing when there is no search query", () => {
    const append = setupChat()
    renderWithProviders(<AiSearchOverview searchParams={params()} />)
    expect(screen.queryByText(/AI Overview/)).not.toBeInTheDocument()
    expect(append).not.toHaveBeenCalled()
  })

  test("sends a templated prompt once and shows a loading state", () => {
    const append = setupChat()
    renderWithProviders(
      <AiSearchOverview searchParams={params("machine learning")} />,
    )
    expect(screen.getByText("Reviewing your request…")).toBeInTheDocument()
    expect(append).toHaveBeenCalledTimes(1)
    expect(append.mock.calls[0][0]).toEqual({
      role: "user",
      content: expect.stringContaining(
        'if i search "machine learning". start with "here are some courses"',
      ),
    })
  })

  test("shows the response and opens the drawer on Show more", async () => {
    setupChat({
      status: "ready",
      messages: [
        { id: "1", role: "user", content: "prompt" },
        { id: "2", role: "assistant", content: "Here are some courses" },
      ],
    })
    renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
    expect(screen.getByText("Here are some courses")).toBeInTheDocument()
    expect(screen.queryByTestId("ai-chat-display")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show more" }))
    expect(screen.getByTestId("ai-chat-display")).toBeInTheDocument()
  })

  test("renders nothing on error", () => {
    setupChat({ status: "error" })
    renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
    expect(screen.queryByText(/AI Overview/)).not.toBeInTheDocument()
  })
})
