import React from "react"
import { renderWithProviders } from "@/test-utils"
import AiRecommendationBotDrawer from "./AiRecommendationBotDrawer"
import { RECOMMENDER_QUERY_PARAM } from "@/common/urls"

const mockAiChat = jest.fn<React.JSX.Element, [Record<string, unknown>]>(() => (
  <div data-testid="mock-ai-chat" />
))
jest.mock("@mitodl/smoot-design/ai", () => {
  const actual = jest.requireActual("@mitodl/smoot-design/ai")
  return {
    ...actual,
    AiChat: (props: Record<string, unknown>) => {
      mockAiChat(props)
      return actual.AiChat(props)
    },
  }
})

describe("AiRecommendationBotDrawer", () => {
  test("passes CSRF config in requestOpts", () => {
    mockAiChat.mockClear()

    renderWithProviders(<AiRecommendationBotDrawer />, {
      url: `?${RECOMMENDER_QUERY_PARAM}`,
    })

    const call = mockAiChat.mock.calls[0][0] as Record<string, unknown>
    const requestOpts = call.requestOpts as Record<string, unknown>
    expect(requestOpts.csrfCookieName).toBe(
      process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken",
    )
    expect(requestOpts.csrfHeaderName).toBe("X-CSRFToken")
    expect((requestOpts.fetchOpts as Record<string, unknown>).credentials).toBe(
      "include",
    )
  })
})
