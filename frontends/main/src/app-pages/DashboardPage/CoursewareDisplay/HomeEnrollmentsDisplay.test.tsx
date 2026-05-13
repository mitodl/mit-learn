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
import { HomeEnrollmentsDisplay } from "./HomeEnrollmentsDisplay"
import * as mitxonline from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { setupEnrollments } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("HomeEnrollmentsDisplay", () => {
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

    return { enrollments, completed, expired, started, notStarted }
  }

  test("Renders the expected cards", async () => {
    const { completed, started, notStarted } = setupApis()
    renderWithProviders(<HomeEnrollmentsDisplay />)

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
    renderWithProviders(<HomeEnrollmentsDisplay />)

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
    renderWithProviders(<HomeEnrollmentsDisplay />)

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
    renderWithProviders(<HomeEnrollmentsDisplay />)

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
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [programEnrollment.program.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.programs.program({
            id: programEnrollment.program.id,
            title: programEnrollment.program.title,
            readable_id: programEnrollment.program.readable_id,
            program_type: programEnrollment.program.program_type,
            display_mode: programEnrollment.program.display_mode,
          }),
        ],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Program title appears twice (desktop + mobile)
    const programCards = await screen.findAllByText("My Test Program")
    expect(programCards.length).toBeGreaterThan(0)
  })

  test("Renders ProgramAsCourse enrollments with ProgramAsCourseCard on dashboard home", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const moduleSection = reqTree.addOperator({
      operator: "all_of",
      title: "Modules",
    })
    moduleSection.addCourse({ course: 11 })
    moduleSection.addCourse({ course: 12 })

    const programAsCourseProgram = mitxonline.factories.programs.program({
      id: 555,
      title: "My Program As Course",
      display_mode: "course",
      courses: [11, 12],
      req_tree: reqTree.serialize(),
    })

    const programAsCourseEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          id: programAsCourseProgram.id,
          title: programAsCourseProgram.title,
          live: programAsCourseProgram.live,
          program_type: programAsCourseProgram.program_type,
          readable_id: programAsCourseProgram.readable_id,
          display_mode: "course",
        },
      })

    const programAsCourseCourses = {
      count: 2,
      next: null,
      previous: null,
      results: [
        mitxonline.factories.courses.course({
          id: 11,
          title: "ProgramAsCourse Module One",
          courseruns: [mitxonline.factories.courses.courseRun()],
        }),
        mitxonline.factories.courses.course({
          id: 12,
          title: "ProgramAsCourse Module Two",
          courseruns: [mitxonline.factories.courses.courseRun()],
        }),
      ],
    }

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programAsCourseEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [programAsCourseProgram.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [programAsCourseProgram],
      },
    )
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({
        id: programAsCourseProgram.courses,
        page_size: programAsCourseProgram.courses.length,
      }),
      programAsCourseCourses,
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })
    expect(
      await screen.findByTestId("program-as-course-card"),
    ).toBeInTheDocument()
    expect(
      (await screen.findAllByText("ProgramAsCourse Module One")).length,
    ).toBeGreaterThan(0)
    expect(
      (await screen.findAllByText("ProgramAsCourse Module Two")).length,
    ).toBeGreaterThan(0)
  })

  test("Hides top-level course cards already covered by enrolled programs", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const coveredEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        title: "Covered Course Run",
        course: {
          id: 101,
          title: "Covered Course",
          readable_id: "covered-course",
        },
        start_date: faker.date.past().toISOString(),
      },
    })

    const uncoveredEnrollment =
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "Standalone Course Run",
          course: {
            id: 202,
            title: "Standalone Course",
            readable_id: "standalone-course",
          },
          start_date: faker.date.past().toISOString(),
        },
      })

    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          id: 999,
          title: "My Program",
        },
      })

    const enrolledProgram = mitxonline.factories.programs.program({
      id: 999,
      title: "My Program",
      courses: [coveredEnrollment.run.course.id],
    })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      coveredEnrollment,
      uncoveredEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [enrolledProgram.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [enrolledProgram],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    expect((await screen.findAllByText("My Program")).length).toBeGreaterThan(0)
    expect(screen.queryByText("Covered Course")).not.toBeInTheDocument()
    expect(
      (await screen.findAllByText("Standalone Course Run")).length,
    ).toBeGreaterThan(0)
  })

  test("Still shows expired courses when deduping reduces the visible dashboard set", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const coveredEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        title: "Covered Active Course",
        course: {
          id: 301,
          title: "Covered Active Course",
          readable_id: "covered-active-course",
        },
        start_date: faker.date.past().toISOString(),
      },
    })
    const visibleEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        title: "Visible Active Course",
        course: {
          id: 302,
          title: "Visible Active Course",
          readable_id: "visible-active-course",
        },
        start_date: faker.date.past().toISOString(),
      },
    })
    const expiredEnrollments = [
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "Expired Course A",
          course: {
            id: 401,
            title: "Expired Course A",
            readable_id: "expired-course-a",
          },
          start_date: faker.date.past().toISOString(),
          end_date: faker.date.past().toISOString(),
        },
      }),
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          title: "Expired Course B",
          course: {
            id: 402,
            title: "Expired Course B",
            readable_id: "expired-course-b",
          },
          start_date: faker.date.past().toISOString(),
          end_date: faker.date.past().toISOString(),
        },
      }),
    ]

    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: {
          ...mitxonline.factories.programs.simpleProgram(),
          id: 1999,
          title: "Active Program",
        },
      })

    const enrolledProgram = mitxonline.factories.programs.program({
      id: 1999,
      title: "Active Program",
      courses: [coveredEnrollment.run.course.id],
    })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      coveredEnrollment,
      visibleEnrollment,
      ...expiredEnrollments,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [enrolledProgram.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [enrolledProgram],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    expect(screen.queryByText("Covered Active Course")).not.toBeInTheDocument()
    expect(
      (await screen.findAllByText("Visible Active Course")).length,
    ).toBeGreaterThan(0)
    expect(
      (await screen.findAllByText("Expired Course A")).length,
    ).toBeGreaterThan(0)
    expect(
      (await screen.findAllByText("Expired Course B")).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText("Show all")).toBeInTheDocument()
  })

  test("Renders both course and program enrollments together", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
    })
    const programEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3()

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      courseEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [programEnrollment.program.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.programs.program({
            id: programEnrollment.program.id,
            title: programEnrollment.program.title,
            readable_id: programEnrollment.program.readable_id,
            program_type: programEnrollment.program.program_type,
            display_mode: programEnrollment.program.display_mode,
          }),
        ],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Course title appears in desktop + mobile cards
    expect(
      (await screen.findAllByText(courseEnrollment.run.course.title)).length,
    ).toBeGreaterThan(0)
    // Program title appears in desktop + mobile cards
    expect(
      (await screen.findAllByText(programEnrollment.program.title)).length,
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

    renderWithProviders(<HomeEnrollmentsDisplay />)

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
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [programEnrollment.program.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.programs.program({
            id: programEnrollment.program.id,
            title: programEnrollment.program.title,
            readable_id: programEnrollment.program.readable_id,
            program_type: programEnrollment.program.program_type,
            display_mode: programEnrollment.program.display_mode,
          }),
        ],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

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

    renderWithProviders(<HomeEnrollmentsDisplay />)

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

    renderWithProviders(<HomeEnrollmentsDisplay />)

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

    renderWithProviders(<HomeEnrollmentsDisplay />)

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
    const b2bSimpleProgram = mitxonline.factories.programs.simpleProgram()
    const nonB2BSimpleProgram = mitxonline.factories.programs.simpleProgram()

    const b2bProgramEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: b2bSimpleProgram,
      })
    const nonB2BProgramEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: nonB2BSimpleProgram,
      })

    // Put the contract in the user's b2b_organizations so the code
    // (which reads contracts from userMe, not contractsList) can filter it
    const contract = mitxonline.factories.contracts.contract({
      programs: [b2bSimpleProgram.id],
    })
    const mitxOnlineUser = mitxonline.factories.user.user({
      b2b_organizations: [
        mitxonline.factories.organizations.organization({
          contracts: [contract],
        }),
      ],
    })
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [b2bProgramEnrollment, nonB2BProgramEnrollment],
    )
    // After B2B filtering, only the non-B2B program remains, so programsList
    // is called with just that one ID
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [nonB2BSimpleProgram.id],
        page_size: 1,
      }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.programs.program({ ...nonB2BSimpleProgram }),
        ],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Should only show the non-B2B program (appears in desktop + mobile cards)
    const personalProgramCards = await screen.findAllByText(
      nonB2BSimpleProgram.title,
    )
    expect(personalProgramCards.length).toBeGreaterThan(0)
    expect(screen.queryByText(b2bSimpleProgram.title)).not.toBeInTheDocument()
  })

  test("Hides child program enrollments that are part of an enrolled parent program", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const childSimpleProgram = mitxonline.factories.programs.simpleProgram({
      display_mode: "course",
    })
    const parentSimpleProgram = mitxonline.factories.programs.simpleProgram()

    // Parent program has child program in its req_tree
    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({ operator: "all_of" })
    section.addProgram({ program: childSimpleProgram.id })

    const parentProgramEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: parentSimpleProgram,
      })
    const childProgramEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: childSimpleProgram,
      })

    const parentProgramDetail = mitxonline.factories.programs.program({
      ...parentSimpleProgram,
      req_tree: reqTree.serialize(),
    })
    const childProgramDetail = mitxonline.factories.programs.program({
      ...childSimpleProgram,
    })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [parentProgramEnrollment, childProgramEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [parentSimpleProgram.id, childSimpleProgram.id],
        page_size: 2,
      }),
      {
        count: 2,
        next: null,
        previous: null,
        results: [parentProgramDetail, childProgramDetail],
      },
    )

    renderWithProviders(<HomeEnrollmentsDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const parentCards = await screen.findAllByText(parentSimpleProgram.title)
    expect(parentCards.length).toBeGreaterThan(0)
    expect(screen.queryByText(childSimpleProgram.title)).not.toBeInTheDocument()
  })
})
