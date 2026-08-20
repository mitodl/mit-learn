import React from "react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  user,
  waitFor,
  within,
} from "@/test-utils"
import { HomeEnrollmentsDisplay } from "./HomeEnrollmentsDisplay"
import { CoursewareCard } from "./CoursewareCard"
import { setupEnrollments, setupOrderHistory } from "./test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { makeRequest } from "api/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import {
  trackCourseUnenrolled,
  trackProgramUnenrolled,
} from "@/common/analytics/gtm"

// Verified cards look up their order; default to none, tests override.
beforeEach(() => {
  setupOrderHistory()
})

jest.mock("posthog-js/react")
jest.mock("@/common/analytics/gtm", () => ({
  trackCourseUnenrolled: jest.fn(),
  trackProgramUnenrolled: jest.fn(),
}))

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
      mitxonline.urls.enrollment.enrollmentsListV3(),
      enrollments,
    )
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    return { enrollments, completed, expired, started, notStarted }
  }

  test("Opening the email settings dialog and submitting it fires the proper API call", async () => {
    const { enrollments } = setupApis()
    const enrollment = faker.helpers.arrayElement(enrollments)

    setMockResponse.patch(
      mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      null,
    )
    renderWithProviders(<HomeEnrollmentsDisplay />)

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

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "patch",
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
    renderWithProviders(<HomeEnrollmentsDisplay />)

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

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "delete",
        url: mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      }),
    )
  })

  test("Unenrolling removes the card immediately, before the enrollments list refetches", async () => {
    const { enrollments } = setupApis()
    const enrollment = faker.helpers.arrayElement(enrollments)

    setMockResponse.delete(
      mitxonline.urls.enrollment.courseEnrollment(enrollment.id),
      null,
    )
    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards.length).toBe(enrollments.length)

    const card = cards.find(
      (c) => !!within(c).queryByText(enrollment.run.title),
    )
    invariant(card)

    // Hold the post-unenroll invalidation refetch open. If the card only
    // disappears once the list refetches, this test fails — proving the card is
    // removed by the mutation's immediate cache update, not by the refetch.
    const refetch = Promise.withResolvers<typeof enrollments>()
    setMockResponse.get(
      mitxonline.urls.enrollment.enrollmentsListV3(),
      refetch.promise,
    )

    const contextMenuButton = await within(card).findByLabelText("More options")
    await user.click(contextMenuButton)

    const unenrollButton = await screen.findByRole("menuitem", {
      name: "Unenroll",
    })
    await user.click(unenrollButton)

    const confirmButton = await screen.findByRole("button", {
      name: "Unenroll",
    })
    await user.click(confirmButton)

    // Card is gone even though the refetch is still pending.
    await waitFor(() => expect(card).not.toBeInTheDocument())
    expect(screen.getAllByTestId("enrollment-card-desktop")).toHaveLength(
      enrollments.length - 1,
    )

    // Let the held refetch settle so nothing dangles after the test.
    refetch.resolve(enrollments.filter((e) => e.id !== enrollment.id))
  })
})

describe("UnenrollProgramDialog", () => {
  const setupProgramCard = (
    enrollmentMode: string | null = "audit",
    displayMode: string | null = null,
  ) => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        enrollment_mode: enrollmentMode ? enrollmentMode : undefined,
        program: { display_mode: displayMode } as never,
      })

    return { programEnrollment }
  }

  test("Shows unenroll option for free (audit) program enrollments", async () => {
    const { programEnrollment } = setupProgramCard("audit", null)

    renderWithProviders(
      <CoursewareCard
        kind="program-enrollment"
        programEnrollment={programEnrollment}
      />,
    )

    const desktopCard = await screen.findByTestId("enrollment-card-desktop")
    const contextMenuButton = within(desktopCard).getByLabelText("More options")
    await user.click(contextMenuButton)

    expect(
      await screen.findByRole("menuitem", { name: "Unenroll" }),
    ).toBeInTheDocument()
  })

  test("Does not show unenroll option for paid (verified) program enrollments", async () => {
    const { programEnrollment } = setupProgramCard("verified", null)

    renderWithProviders(
      <CoursewareCard
        kind="program-enrollment"
        programEnrollment={programEnrollment}
      />,
    )

    const desktopCard = await screen.findByTestId("enrollment-card-desktop")
    const contextMenuButton = within(desktopCard).getByLabelText("More options")
    await user.click(contextMenuButton)

    expect(
      screen.queryByRole("menuitem", { name: "Unenroll" }),
    ).not.toBeInTheDocument()
  })

  test("Does not show unenroll option for program-as-course display_mode programs", async () => {
    const { programEnrollment } = setupProgramCard("audit", "course")

    renderWithProviders(
      <CoursewareCard
        kind="program-enrollment"
        programEnrollment={programEnrollment}
      />,
    )

    const desktopCard = await screen.findByTestId("enrollment-card-desktop")
    const contextMenuButton = within(desktopCard).getByLabelText("More options")
    await user.click(contextMenuButton)

    expect(
      screen.queryByRole("menuitem", { name: "Unenroll" }),
    ).not.toBeInTheDocument()
  })

  test("Confirming unenroll from a program fires the proper API call", async () => {
    const { programEnrollment } = setupProgramCard("audit", null)

    setMockResponse.delete(
      mitxonline.urls.programEnrollments.programEnrollment(
        programEnrollment.program.id,
      ),
      null,
    )

    renderWithProviders(
      <CoursewareCard
        kind="program-enrollment"
        programEnrollment={programEnrollment}
      />,
    )

    const desktopCard = await screen.findByTestId("enrollment-card-desktop")
    const contextMenuButton = within(desktopCard).getByLabelText("More options")
    await user.click(contextMenuButton)

    const unenrollMenuItem = await screen.findByRole("menuitem", {
      name: "Unenroll",
    })
    await user.click(unenrollMenuItem)

    const dialog = await screen.findByRole("dialog", {
      name: `Unenroll from ${programEnrollment.program.title}`,
    })
    expect(dialog).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        `Are you sure you want to unenroll from ${programEnrollment.program.title}?`,
      ),
    ).toBeInTheDocument()

    const confirmButton = within(dialog).getByRole("button", {
      name: "Unenroll",
    })
    await user.click(confirmButton)

    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "delete",
        url: mitxonline.urls.programEnrollments.programEnrollment(
          programEnrollment.program.id,
        ),
      }),
    )
    expect(trackProgramUnenrolled).toHaveBeenCalledWith(
      programEnrollment.program.title,
    )
    expect(trackCourseUnenrolled).not.toHaveBeenCalled()
  })

  test("Cancelling the dialog does not fire the API call", async () => {
    const { programEnrollment } = setupProgramCard("audit", null)

    renderWithProviders(
      <CoursewareCard
        kind="program-enrollment"
        programEnrollment={programEnrollment}
      />,
    )

    const desktopCard = await screen.findByTestId("enrollment-card-desktop")
    const contextMenuButton = within(desktopCard).getByLabelText("More options")
    await user.click(contextMenuButton)

    await user.click(await screen.findByRole("menuitem", { name: "Unenroll" }))
    await screen.findByRole("dialog", {
      name: `Unenroll from ${programEnrollment.program.title}`,
    })

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "delete" }),
    )
  })

  test.each(["enrollment-card-desktop", "enrollment-card-mobile"] as const)(
    "Unenroll option is accessible from the %s overflow menu",
    async (cardTestId) => {
      const { programEnrollment } = setupProgramCard("audit", null)

      renderWithProviders(
        <CoursewareCard
          kind="program-enrollment"
          programEnrollment={programEnrollment}
        />,
      )

      const card = await screen.findByTestId(cardTestId)
      await user.click(within(card).getByLabelText("More options"))

      expect(
        await screen.findByRole("menuitem", { name: "Unenroll" }),
      ).toBeInTheDocument()
    },
  )
})
