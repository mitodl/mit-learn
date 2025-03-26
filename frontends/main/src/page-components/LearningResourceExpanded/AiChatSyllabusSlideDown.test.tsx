import React from "react"
import AiChatSyllabusSlideDown, {
  ChatTransitionState,
} from "./AiChatSyllabusSlideDown"
import { renderWithProviders, screen, user } from "@/test-utils"
import { factories, setMockResponse, urls } from "api/test-utils"

/**
 * Note: This component is primarily tested in @mitodl/smoot-design.
 *
 * Here we just check a few config settings.
 */
describe("AiChatSyllabus", () => {
  test("User clicks a starter. Greets authenticated user by name", async () => {
    const resource = factories.learningResources.course()
    const userMe = factories.user.user()

    // Sanity
    expect(userMe.profile?.name).toBeTruthy()

    setMockResponse.get(urls.userMe.get(), userMe)
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

    await user.click(
      screen.getByRole("button", { name: "What is this course about?" }),
    )

    // byAll because there are two instances, one is SR-only in an aria-live area
    // check for username and resource title
    await screen.findAllByText(
      new RegExp(`Hello ${userMe.profile?.name}.*${resource.title}.*`),
    )
  })

  test("User enters a prompt. Greets anonymous user generically", async () => {
    const resource = factories.learningResources.course()

    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
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

    // byAll because there are two instances, one is SR-only in an aria-live area
    // check for username and resource title
    await screen.findAllByText(new RegExp(`Hello and.*${resource.title}.*`))
  })
})
