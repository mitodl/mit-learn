import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  user,
  within,
} from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import * as mitxonline from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { setupEnrollments } from "./test-utils"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("EnrollmentDisplay", () => {
  const setupApis = (includeExpired: boolean = true) => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)
    const { enrollments, completed, expired, started, notStarted } =
      setupEnrollments(includeExpired)

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(
      mitxonline.urls.enrollment.courseEnrollment(),
      enrollments,
    )

    return { enrollments, completed, expired, started, notStarted }
  }

  test("Renders the expected cards", async () => {
    const { completed, started, notStarted } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const expectedTitles = [...started, ...notStarted, ...completed].map(
      (e) => e.run.title,
    )

    expectedTitles.forEach((title, i) => {
      expect(cards[i]).toHaveTextContent(title)
    })
  })

  test("Renders the proper amount of unenroll and email settings buttons in the context menus", async () => {
    const { enrollments } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)
    for (const card of cards) {
      const contextMenuButton =
        await within(card).findByLabelText("More options")
      await user.click(contextMenuButton)
      const emailSettingsButton = await screen.findAllByRole("menuitem", {
        name: "Email Settings",
      })
      const unenrollButton = await screen.findAllByRole("menuitem", {
        name: "Unenroll",
      })
      expect(emailSettingsButton.length).toBe(1)
      expect(unenrollButton.length).toBe(1)
      await user.click(contextMenuButton)
    }
  })

  test("Clicking show all reveals ended courses", async () => {
    const { completed, expired, started, notStarted } = setupApis()
    renderWithProviders(<EnrollmentDisplay />)

    const showAllButton = await screen.findByText("Show all")
    await user.click(showAllButton)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    const expectedTitles = [
      ...started,
      ...notStarted,
      ...completed,
      ...expired,
    ].map((e) => e.run.title)

    expectedTitles.forEach((title, i) => {
      expect(cards[i]).toHaveTextContent(title)
    })
  })

  test("If there are no extra enrollments to display, there should be no show all", async () => {
    setupApis(false)
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    expect(screen.queryByText("Show all")).not.toBeInTheDocument()
  })
})
