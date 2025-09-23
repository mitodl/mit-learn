import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  user,
  within,
} from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import { DashboardCard } from "./DashboardCard"
import { dashboardCourse, setupEnrollments } from "./test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import {
  urls as testUrls,
  factories as testFactories,
  mockAxiosInstance,
} from "api/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { EnrollmentStatus } from "./types"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("DashboardDialogs", () => {
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

  describe("JustInTimeDialog", () => {
    const setupJustInTimeTest = () => {
      // Setup MIT Learn user
      const mitLearnUser = testFactories.user.user()
      setMockResponse.get(testUrls.userMe.get(), mitLearnUser)

      // Setup incomplete mitxonline user (missing country and year_of_birth)
      const incompleteMitxUser = mitxonline.factories.user.user({
        legal_address: null,
        user_profile: null,
      })
      setMockResponse.get(mitxonline.urls.userMe.get(), incompleteMitxUser)

      // Setup countries data
      const countries = [
        { code: "US", name: "United States" },
        { code: "CA", name: "Canada" },
        { code: "GB", name: "United Kingdom" },
      ]
      setMockResponse.get(mitxonline.urls.countries.list(), countries)

      // Setup course for enrollment
      const course = dashboardCourse({
        enrollment: { status: EnrollmentStatus.NotEnrolled },
        marketingUrl: "https://example.com/course",
      })

      // Setup enrollment API
      setMockResponse.post(
        mitxonline.urls.b2b.courseEnrollment(course.coursewareId || ""),
        null,
      )

      return { mitLearnUser, incompleteMitxUser, countries, course }
    }

    test("Opens just-in-time dialog when enrolling with incomplete mitxonline user data", async () => {
      const { course } = setupJustInTimeTest()

      renderWithProviders(<DashboardCard dashboardResource={course} />)

      const enrollButtons = await screen.findAllByTestId("courseware-button")
      await user.click(enrollButtons[0]) // Use the first (desktop) button

      const dialog = await screen.findByRole("dialog", {
        name: "Just a Few More Details",
      })
      expect(dialog).toBeInTheDocument()

      expect(
        within(dialog).getByText(
          "We need a bit more info before you can enroll.",
        ),
      ).toBeInTheDocument()
      expect(within(dialog).getByLabelText("Country")).toBeInTheDocument()
      expect(within(dialog).getByLabelText("Year of Birth")).toBeInTheDocument()
    })

    test("Validates required fields in just-in-time dialog", async () => {
      const { course } = setupJustInTimeTest()

      renderWithProviders(<DashboardCard dashboardResource={course} />)

      const enrollButtons = await screen.findAllByTestId("courseware-button")
      await user.click(enrollButtons[0]) // Use the first (desktop) button

      const dialog = await screen.findByRole("dialog", {
        name: "Just a Few More Details",
      })

      const submitButton = within(dialog).getByRole("button", {
        name: "Submit",
      })

      // Try submitting with empty fields - should show validation errors
      await user.click(submitButton)

      // Should show validation errors
      await screen.findByText("Country is required")
      await screen.findByText("Year of birth is required")
    })

    test("Generates correct year of birth options (minimum age 13)", async () => {
      const { course } = setupJustInTimeTest()

      renderWithProviders(<DashboardCard dashboardResource={course} />)

      const enrollButtons = await screen.findAllByTestId("courseware-button")
      await user.click(enrollButtons[0]) // Use the first (desktop) button

      const dialog = await screen.findByRole("dialog", {
        name: "Just a Few More Details",
      })

      const yearSelect = within(dialog).getByLabelText("Year of Birth")
      await user.click(yearSelect)

      const currentYear = new Date().getFullYear()
      const maxYear = currentYear - 13

      // Should include the max allowed year
      expect(screen.getByText(maxYear.toString())).toBeInTheDocument()

      // Should NOT include years that would make someone under 13
      expect(
        screen.queryByText((currentYear - 12).toString()),
      ).not.toBeInTheDocument()
    })

    test("Cancels just-in-time dialog without making API calls", async () => {
      const { course } = setupJustInTimeTest()

      renderWithProviders(<DashboardCard dashboardResource={course} />)

      const enrollButtons = await screen.findAllByTestId("courseware-button")
      await user.click(enrollButtons[0]) // Use the first (desktop) button

      const dialog = await screen.findByRole("dialog", {
        name: "Just a Few More Details",
      })

      const cancelButton = within(dialog).getByRole("button", {
        name: "Cancel",
      })
      await user.click(cancelButton)

      // No PATCH calls should have been made
      expect(mockAxiosInstance.request).not.toHaveBeenCalledWith(
        expect.objectContaining({
          method: "PATCH",
          url: mitxonline.urls.userMe.get(),
        }),
      )
    })
  })
})
