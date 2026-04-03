import React from "react"
import AiChatSyllabusSlideDown, {
  ChatTransitionState,
  STARTERS,
} from "./AiChatSyllabusSlideDown"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories } from "api/test-utils"
import { ResourceTypeEnum, ResourceTypeGroupEnum } from "api"
import invariant from "tiny-invariant"

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

  test.each([
    {
      overrides: {
        resource_type: ResourceTypeEnum.Course,
        resource_type_group: ResourceTypeGroupEnum.Course,
      },
    },
    {
      overrides: {
        resource_type: ResourceTypeEnum.Program,
        resource_type_group: ResourceTypeGroupEnum.Program,
      },
    },
  ] as const)(
    "passes conversation starters for $resource_type_group",
    ({ overrides }) => {
      mockAiChat.mockClear()
      const resource = factories.learningResources.resource(overrides)

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
      expect(call.conversationStarters).toEqual(
        STARTERS[overrides.resource_type_group],
      )
    },
  )

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
      process.env.NEXT_PUBLIC_LEARN_AI_CSRF_COOKIE_NAME || "csrftoken",
    )
    expect(requestOpts.csrfHeaderName).toBe("X-CSRFToken")
    expect((requestOpts.fetchOpts as Record<string, unknown>).credentials).toBe(
      "include",
    )
  })
})
