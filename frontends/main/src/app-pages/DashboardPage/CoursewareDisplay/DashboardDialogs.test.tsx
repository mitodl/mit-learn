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
import { faker } from "@faker-js/faker/locale/en"
import { mockAxiosInstance } from "api/test-utils"
import invariant from "tiny-invariant"

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

  test("Opening the email settings dialog and submitting it fires the proper API call", async () => {
    const { enrollments } = setupApis()
    const enrollment = faker.helpers.arrayElement(enrollments)

    setMockResponse.patch(
      mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      null,
    )
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)

    const card = cards.find(
      (c) => !!within(c).queryByText(enrollment.run.title),
    )
    invariant(card)

    const contextMenuButton = await within(card).findByLabelText("More options")
    await user.click(contextMenuButton)

    const emailSettingsButton = await screen.findByRole("menuitem", {
      name: "Email Settings",
    })
    await user.click(emailSettingsButton)

    const dialog = await screen.findByRole("dialog", {
      name: "Email Settings",
    })
    expect(dialog).toBeInTheDocument()

    const checkbox = within(dialog).getByRole("checkbox", {
      name: "Receive course emails",
    })
    expect(checkbox).toBeInTheDocument()
    await user.click(checkbox)

    const confirmButton = within(dialog).getByRole("button", {
      name: "Save Settings",
    })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })

  test("Opening the unenroll dialog and confirming the unenroll fires the proper API call", async () => {
    const { enrollments } = setupApis()
    const enrollment = faker.helpers.arrayElement(enrollments)

    setMockResponse.delete(
      mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      null,
    )
    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)

    const card = cards.find(
      (c) => !!within(c).queryByText(enrollment.run.title),
    )
    invariant(card)

    const contextMenuButton = await within(card).findByLabelText("More options")
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

    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })
})
