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

describe("DashboardDialogs", () => {
  const setupApis = (includeExpired: boolean = true) => {
    const { enrollments, completed, expired, started, notStarted } =
      setupEnrollments(includeExpired)

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(
      mitxonline.urls.enrollment.courseEnrollment(),
      enrollments,
    )

    return { enrollments, completed, expired, started, notStarted }
  }

  test("Opening the unenroll dialog and confirming the unenroll fires the proper API call", async () => {
    const { enrollments } = setupApis()
    let deleteCalls = 0
    for (const enrollment of enrollments) {
      setMockResponse.delete(
        mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
        () => {
          deleteCalls++
        },
      )
    }
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)

    const contextMenuButton = await within(cards[0]).findByLabelText(
      "More options",
    )
    await user.click(contextMenuButton)

    const unenrollButton = await screen.findByRole("menuitem", {
      name: "Unenroll",
    })
    await user.click(unenrollButton)

    const confirmButton = await screen.findByRole("button", {
      name: "Unenroll",
    })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(deleteCalls).toBe(1)
  })
})
