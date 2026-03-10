import React from "react"
import AiChatSyllabusSlideDown, {
  ChatTransitionState,
} from "./AiChatSyllabusSlideDown"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories } from "api/test-utils"
import invariant from "tiny-invariant"

const mockAiChat = jest.fn(() => <div data-testid="mock-ai-chat" />)
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

/**
 * Note: This component is primarily tested in @mitodl/smoot-design.
 *
 * Here we just check a few config settings.
 */
describe("AiChatSyllabus", () => {
  test("User's message is first message", async () => {
    const resource = factories.learningResources.course()

    renderWithProviders(
      <AiChatSyllabusSlideDown
        open
        resource={resource}
        onTransitionEnd={jest.fn()}
        scrollElement={null}
        contentTopPosition={0}
        chatTransitionState={ChatTransitionState.Open}
      />,
    )

    const input = screen.getByRole("textbox")
    expect(input).toBeInTheDocument()

    await user.type(input, "tell me more{enter}")

    const firstMessage = document.querySelector("[data-chat-role]")
    invariant(firstMessage instanceof HTMLElement)
    expect(firstMessage?.dataset.chatRole).toBe("user")
  })

  test("passes CSRF config in requestOpts", () => {
    const resource = factories.learningResources.course()
    mockAiChat.mockClear()

    renderWithProviders(
      <AiChatSyllabusSlideDown
        open
        resource={resource}
        onTransitionEnd={jest.fn()}
        scrollElement={null}
        contentTopPosition={0}
        chatTransitionState={ChatTransitionState.Open}
      />,
    )

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
