import React from "react"
import AiChatSyllabusSlideDown, {
  ChatTransitionState,
} from "./AiChatSyllabusSlideDown"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories } from "api/test-utils"
import invariant from "tiny-invariant"

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
})
