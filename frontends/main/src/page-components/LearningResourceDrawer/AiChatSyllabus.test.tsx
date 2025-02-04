import React from "react"
import AiChatSyllabus from "./AiChatSyllabus"
import { renderWithProviders, screen } from "@/test-utils"
import { factories, setMockResponse, urls } from "api/test-utils"

/**
 * Note: This component is primarily tested in @mitodl/smoot-design.
 *
 * Here we just check a few config settings.
 */
describe("AiChatSyllabus", () => {
  test("Greets authenticated user by name", async () => {
    const resource = factories.learningResources.course()
    const user = factories.user.user()

    // Sanity
    expect(user.profile.name).toBeTruthy()

    setMockResponse.get(urls.userMe.get(), user)
    renderWithProviders(
      <AiChatSyllabus onClose={jest.fn()} resource={resource} />,
    )

    // byAll because there are two instances, one is SR-only in an aria-live area
    // check for username and resource title
    await screen.findAllByText(
      new RegExp(`Hello ${user.profile.name}.*${resource.title}.*`),
    )
  })

  test("Greets anonymous user generically", async () => {
    const resource = factories.learningResources.course()

    setMockResponse.get(urls.userMe.get(), {}, { code: 403 })
    renderWithProviders(
      <AiChatSyllabus onClose={jest.fn()} resource={resource} />,
    )

    // byAll because there are two instances, one is SR-only in an aria-live area
    // check for username and resource title
    await screen.findAllByText(new RegExp(`Hello and.*${resource.title}.*`))
  })
})
