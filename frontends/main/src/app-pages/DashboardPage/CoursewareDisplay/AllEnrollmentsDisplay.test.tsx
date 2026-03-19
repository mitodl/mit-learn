import React from "react"
import { act } from "@testing-library/react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  within,
} from "@/test-utils"
import { AllEnrollmentsDisplay } from "./AllEnrollmentsDisplay"
import * as mitxonline from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { setupEnrollments } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("MyLearning", () => {
  setupLocationMock()

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

  test("Renders the expected cards", async () => {
    const { completed, started, notStarted } = setupApis()
    renderWithProviders(<AllEnrollmentsDisplay />)

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
    renderWithProviders(<AllEnrollmentsDisplay />)

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
    renderWithProviders(<AllEnrollmentsDisplay />)

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
    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    expect(screen.queryByText("Show all")).not.toBeInTheDocument()
  })

  test("Renders program cards when program enrollments exist", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          title: "My Test Program",
        },
      })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Program title appears twice (desktop + mobile)
    const programCards = await screen.findAllByText("My Test Program")
    expect(programCards.length).toBeGreaterThan(0)
  })

  test("Renders both course and program enrollments together", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        ...mitxonline.factories.enrollment.courseEnrollment().run,
        course: {
          ...mitxonline.factories.enrollment.courseEnrollment().run.course,
          title: "My Test Course",
        },
      },
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          title: "My Test Program",
        },
      })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      courseEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Course title appears in desktop + mobile cards
    expect(
      (await screen.findAllByText("My Test Course")).length,
    ).toBeGreaterThan(0)
    // Program title appears in desktop + mobile cards
    expect(
      (await screen.findAllByText("My Test Program")).length,
    ).toBeGreaterThan(0)
  })

  test("Shows empty state when no enrollments exist", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    // Wait a moment for queries to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // Should not render the "My Learning" section when there are no enrollments
    expect(
      screen.queryByRole("heading", { name: "My Learning" }),
    ).not.toBeInTheDocument()
    const cards = screen.queryAllByTestId("enrollment-card-desktop")
    expect(cards).toHaveLength(0)
  })

  test("Shows My Learning when only program enrollments exist", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          title: "Solo Program",
        },
      })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })
    expect((await screen.findAllByText("Solo Program")).length).toBeGreaterThan(
      0,
    )
  })

  test("Shows My Learning when only expired enrollments exist", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const expiredEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        title: "Expired Course",
        end_date: faker.date.past().toISOString(),
        start_date: faker.date.past().toISOString(),
      },
    })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      expiredEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })
    expect(
      (await screen.findAllByText("Expired Course")).length,
    ).toBeGreaterThan(0)
  })

  test("Shows expired courses without Show all when total cards <= MIN_VISIBLE", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    // 2 expired courses only — total = 2, under MIN_VISIBLE of 3 → all promoted, no toggle
    const expiredEnrollments = [
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "Expired Alpha",
          end_date: faker.date.past().toISOString(),
          start_date: faker.date.past().toISOString(),
        },
      }),
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "Expired Beta",
          end_date: faker.date.past().toISOString(),
          start_date: faker.date.past().toISOString(),
        },
      }),
    ]

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(
      mitxonline.urls.enrollment.enrollmentsListV3(),
      expiredEnrollments,
    )
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })
    expect(
      (await screen.findAllByText("Expired Alpha")).length,
    ).toBeGreaterThan(0)
    expect((await screen.findAllByText("Expired Beta")).length).toBeGreaterThan(
      0,
    )
    expect(screen.queryByText("Show all")).not.toBeInTheDocument()
  })

  test("Hides all expired behind Show all when normally-shown enrollments exist", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    // 1 started + 3 expired → started is present so all expired go behind "Show all"
    const startedEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        title: "Active Course",
        start_date: faker.date.past().toISOString(),
        end_date: null,
      },
    })
    const expiredEnrollments = [
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "A Expired Course",
          end_date: faker.date.past().toISOString(),
          start_date: faker.date.past().toISOString(),
        },
      }),
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "B Expired Course",
          end_date: faker.date.past().toISOString(),
          start_date: faker.date.past().toISOString(),
        },
      }),
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "C Expired Course",
          end_date: faker.date.past().toISOString(),
          start_date: faker.date.past().toISOString(),
        },
      }),
    ]

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      startedEnrollment,
      ...expiredEnrollments,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // "Show all" toggle must exist (all 3 expired are hidden)
    await screen.findByText("Show all")

    // Only the active course is visible before expanding
    expect(
      (await screen.findAllByText("Active Course")).length,
    ).toBeGreaterThan(0)

    // After expanding, all expired courses appear
    await user.click(screen.getByText("Show all"))
    expect(
      (await screen.findAllByText("A Expired Course")).length,
    ).toBeGreaterThan(0)
    expect(
      (await screen.findAllByText("B Expired Course")).length,
    ).toBeGreaterThan(0)
    expect(
      (await screen.findAllByText("C Expired Course")).length,
    ).toBeGreaterThan(0)
  })

  test("Filters B2B program enrollments from display", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const b2bProgramEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          title: "B2B Program",
        },
      })

    const nonB2BProgramEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          title: "Personal Program",
        },
      })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [b2bProgramEnrollment, nonB2BProgramEnrollment],
    )
    // Mock contracts to filter out the B2B program
    const contract = mitxonline.factories.contracts.contract({
      programs: [b2bProgramEnrollment.program.id],
    })
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [contract])

    renderWithProviders(<AllEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Should only show the non-B2B program (appears in desktop + mobile cards)
    const personalProgramCards = await screen.findAllByText("Personal Program")
    expect(personalProgramCards.length).toBeGreaterThan(0)
    expect(screen.queryByText("B2B Program")).not.toBeInTheDocument()
  })
})
