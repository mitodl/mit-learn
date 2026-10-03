import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useAiChat } from "@mitodl/smoot-design/ai"
import type { AiChatProps } from "@mitodl/smoot-design/ai"
import AiSearchOverview from "./AiSearchOverview"
import type { RegisteredSearchParams } from "@/common/searchParams"

jest.mock("posthog-js/react")
const mockAiChatProvider = jest.fn()
jest.mock("@mitodl/smoot-design/ai", () => ({
  ...jest.requireActual("@mitodl/smoot-design/ai"),
  AiChatProvider: (props: {
    children: React.ReactNode
    requestOpts: AiChatProps["requestOpts"]
  }) => {
    mockAiChatProvider(props)
    return props.children
  },
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

  test("renders nothing when the search query is only whitespace", () => {
    const append = setupChat()
    renderWithProviders(<AiSearchOverview searchParams={params("   ")} />)
    expect(screen.queryByText(/AI Overview/)).not.toBeInTheDocument()
    expect(append).not.toHaveBeenCalled()
  })

  test("sends the search query once and shows a loading state", () => {
    const append = setupChat()
    renderWithProviders(
      <AiSearchOverview searchParams={params("machine learning")} />,
    )
    expect(screen.getByText("Reviewing your request…")).toBeInTheDocument()
    expect(append).toHaveBeenCalledTimes(1)
    expect(append.mock.calls[0][0]).toEqual({
      role: "user",
      content: "machine learning",
    })
  })

  test("uses the search summary endpoint", () => {
    const original = process.env.NEXT_PUBLIC_LEARN_AI_SEARCH_SUMMARY_ENDPOINT
    const url = "http://ai.test/http/search_summary_agent/"
    process.env.NEXT_PUBLIC_LEARN_AI_SEARCH_SUMMARY_ENDPOINT = url
    try {
      setupChat()
      renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
      const { requestOpts } = mockAiChatProvider.mock.calls[0][0]
      expect(requestOpts.apiUrl).toBe(url)
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_LEARN_AI_SEARCH_SUMMARY_ENDPOINT
      } else {
        process.env.NEXT_PUBLIC_LEARN_AI_SEARCH_SUMMARY_ENDPOINT = original
      }
    }
  })

  test("starts a fresh thread, then sends its thread_id with follow-ups", () => {
    setupChat()
    renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
    const { requestOpts } = mockAiChatProvider.mock.calls[0][0]
    // learn-ai ends each response with a metadata comment
    const withMetadata = (content: string, threadId: string) =>
      `${content}\n\n<!-- {"checkpoint_pk": 1, "thread_id": "${threadId}"} -->\n\n`
    const first = { id: "1", role: "user" as const, content: "first" }
    const reply = {
      id: "2",
      role: "assistant" as const,
      content: withMetadata("reply", "thread-1"),
    }
    const followUp = { id: "3", role: "user" as const, content: "follow-up" }
    const reply2 = {
      id: "4",
      role: "assistant" as const,
      content: withMetadata("reply 2", "thread-2"),
    }
    const followUp2 = { id: "5", role: "user" as const, content: "follow-up 2" }

    expect(requestOpts.transformBody([first])).toEqual({
      message: "first",
      clear_history: true,
    })
    expect(requestOpts.transformBody([first, reply, followUp])).toEqual({
      message: "follow-up",
      thread_id: "thread-1",
    })
    // Uses the thread_id from the latest response
    expect(
      requestOpts.transformBody([first, reply, followUp, reply2, followUp2]),
    ).toEqual({
      message: "follow-up 2",
      thread_id: "thread-2",
    })
  })

  test("starts a fresh thread if the response has no thread_id", () => {
    setupChat()
    renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
    const { requestOpts } = mockAiChatProvider.mock.calls[0][0]
    const first = { id: "1", role: "user" as const, content: "first" }
    const reply = { id: "2", role: "assistant" as const, content: "reply" }
    const followUp = { id: "3", role: "user" as const, content: "follow-up" }

    expect(requestOpts.transformBody([first, reply, followUp])).toEqual({
      message: "follow-up",
      clear_history: true,
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

  test("renders nothing when the assistant response includes an error message", () => {
    setupChat({
      status: "ready",
      messages: [
        { id: "1", role: "user", content: "prompt" },
        {
          id: "2",
          role: "assistant",
          content: "",
          data: { error: { message: "Something went wrong" } },
        },
      ],
    })
    renderWithProviders(<AiSearchOverview searchParams={params("ml")} />)
    expect(screen.queryByText(/AI Overview/)).not.toBeInTheDocument()
  })
})
