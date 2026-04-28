import React from "react"
import { act, waitFor } from "@testing-library/react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  within,
} from "@/test-utils"
import { EnrollmentDisplay } from "./EnrollmentDisplay"
import * as mitxonline from "api/mitxonline-test-utils"
import { mockAxiosInstance } from "api/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { setupEnrollments } from "./test-utils"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("EnrollmentDisplay", () => {
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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    expect((await screen.findAllByText("My Program")).length).toBeGreaterThan(0)
    expect(screen.queryByText("Covered Course")).not.toBeInTheDocument()
    expect(
      (await screen.findAllByText("Standalone Course")).length,
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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

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

    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    const parentCards = await screen.findAllByText(parentSimpleProgram.title)
    expect(parentCards.length).toBeGreaterThan(0)
    expect(screen.queryByText(childSimpleProgram.title)).not.toBeInTheDocument()
  })

  describe("ProgramId Filtering", () => {
    test("Filters to single program when programId is provided", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const program = mitxonline.factories.programs.program({
        id: 123,
        title: "Target Program",
        courses: [1, 2, 3],
      })
      const courses = mitxonline.factories.courses.courses({ count: 3 })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(123), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )
      // Also mock the undefined id case (when program data isn't loaded yet)
      setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
        results: [],
      })

      renderWithProviders(<EnrollmentDisplay programId={123} />)

      await screen.findByText("Target Program")
      expect(screen.getByText("Target Program")).toBeInTheDocument()
    })

    test("Displays course requirements when programId is provided", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const coreCourses = reqTree.addOperator({
        operator: "all_of",
        title: "Core Courses",
      })
      coreCourses.addCourse({ course: 1 })

      const program = mitxonline.factories.programs.program({
        id: 456,
        courses: [1], // Only course 1 is in the requirements
        req_tree: reqTree.serialize(),
      })
      const courses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Required Course 1",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(456), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )
      // Also mock the undefined id case (when program data isn't loaded yet)
      setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
        results: [],
      })

      renderWithProviders(<EnrollmentDisplay programId={456} />)

      // Wait for program data to load
      await screen.findByText(/for this program/)

      // Wait for requirement sections to appear
      await waitFor(
        () => {
          const coreCourses = screen.queryByText("Core Courses")
          expect(coreCourses).toBeInTheDocument()
        },
        { timeout: 2000 },
      )
    })

    test("Shows required ProgramAsCourse cards even when user is not enrolled in that ProgramAsCourse", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const parentReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const parentRequirements = parentReqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      parentRequirements.addCourse({ course: 1 })
      parentRequirements.addProgram({ program: 900 })

      const parentProgram = mitxonline.factories.programs.program({
        id: 1234,
        title: "Parent Program",
        courses: [1],
        req_tree: parentReqTree.serialize(),
      })

      const parentCourses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Core Course",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      const programAsCourseReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const programAsCourseRequirements = programAsCourseReqTree.addOperator({
        operator: "all_of",
        title: "Modules",
      })
      programAsCourseRequirements.addCourse({ course: 11 })
      programAsCourseRequirements.addCourse({ course: 12 })

      const programAsCourseProgram = mitxonline.factories.programs.program({
        id: 900,
        title: "Program As Course",
        display_mode: "course",
        courses: [11, 12],
        req_tree: programAsCourseReqTree.serialize(),
      })

      const programAsCourseCourses = {
        count: 2,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 11,
            title: "Module A",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
          mitxonline.factories.courses.course({
            id: 12,
            title: "Module B",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: parentProgram.id,
              title: parentProgram.title,
              live: parentProgram.live,
              program_type: parentProgram.program_type,
              readable_id: parentProgram.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(
        mitxonline.urls.programs.programDetail(parentProgram.id),
        parentProgram,
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: parentProgram.courses,
          page_size: parentProgram.courses.length,
        }),
        parentCourses,
      )
      setMockResponse.get(
        mitxonline.urls.programs.programsList({
          id: [900],
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
        mitxonline.urls.programs.programDetail(900),
        programAsCourseProgram,
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: [11, 12],
          page_size: 2,
        }),
        programAsCourseCourses,
      )

      renderWithProviders(<EnrollmentDisplay programId={parentProgram.id} />)

      await screen.findByText("Requirements")
      expect(await screen.findByText("Program As Course")).toBeInTheDocument()
      expect((await screen.findAllByText("Module A")).length).toBeGreaterThan(0)
      expect((await screen.findAllByText("Module B")).length).toBeGreaterThan(0)
    })

    test("Completion counts include program-as-course items in required totals", async () => {
      /**
       * A section contains 1 course + 1 program-as-course.
       * Neither item is completed, so the counter should show "Completed 0 of 2".
       * The total includes program-as-course items.
       */
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const parentReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const parentRequirements = parentReqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      parentRequirements.addCourse({ course: 1 })
      parentRequirements.addProgram({ program: 900 })

      const parentProgram = mitxonline.factories.programs.program({
        id: 4321,
        title: "Parent Program",
        courses: [1],
        req_tree: parentReqTree.serialize(),
      })

      const parentCourses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Core Course",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      const programAsCourseReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const programAsCourseRequirements = programAsCourseReqTree.addOperator({
        operator: "all_of",
        title: "Modules",
      })
      programAsCourseRequirements.addCourse({ course: 11 })

      const programAsCourseProgram = mitxonline.factories.programs.program({
        id: 900,
        title: "Program As Course",
        display_mode: "course",
        courses: [11],
        req_tree: programAsCourseReqTree.serialize(),
      })

      const programAsCourseCourses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 11,
            title: "Module A",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: parentProgram.id,
              title: parentProgram.title,
              live: parentProgram.live,
              program_type: parentProgram.program_type,
              readable_id: parentProgram.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(
        mitxonline.urls.programs.programDetail(parentProgram.id),
        parentProgram,
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: parentProgram.courses,
          page_size: parentProgram.courses.length,
        }),
        parentCourses,
      )
      setMockResponse.get(
        mitxonline.urls.programs.programsList({
          id: [900],
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
          id: [11],
          page_size: 1,
        }),
        programAsCourseCourses,
      )

      renderWithProviders(<EnrollmentDisplay programId={parentProgram.id} />)

      // Section header includes both the course and program-as-course item
      await screen.findByText(/Completed 0 of 2/)
      // Overall summary uses the same counting behavior
      await screen.findByText(/0 of 2 courses/)
    })

    test("Completed program-as-course items count toward completion total", async () => {
      /**
       * A section contains 1 course (not completed) + 1 program-as-course (completed,
       * has certificate). The counter should show "Completed 1 of 2".
       */
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const parentReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const parentRequirements = parentReqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      parentRequirements.addCourse({ course: 1 })
      parentRequirements.addProgram({ program: 900 })

      const parentProgram = mitxonline.factories.programs.program({
        id: 4321,
        title: "Parent Program",
        courses: [1],
        req_tree: parentReqTree.serialize(),
      })

      const parentCourses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Core Course",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      const programAsCourseReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const programAsCourseRequirements = programAsCourseReqTree.addOperator({
        operator: "all_of",
        title: "Modules",
      })
      programAsCourseRequirements.addCourse({ course: 11 })

      const programAsCourseProgram = mitxonline.factories.programs.program({
        id: 900,
        title: "Program As Course",
        display_mode: "course",
        courses: [11],
        req_tree: programAsCourseReqTree.serialize(),
      })

      const programAsCourseCourses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 11,
            title: "Module A",
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: parentProgram.id,
              title: parentProgram.title,
              live: parentProgram.live,
              program_type: parentProgram.program_type,
              readable_id: parentProgram.readable_id,
            },
          }),
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: programAsCourseProgram.id,
              title: programAsCourseProgram.title,
              live: programAsCourseProgram.live,
              program_type: programAsCourseProgram.program_type,
              readable_id: programAsCourseProgram.readable_id,
            },
            certificate: {
              uuid: "test-uuid-900",
              link: "/certificate/program/test-uuid-900/",
            },
          }),
        ],
      )
      setMockResponse.get(
        mitxonline.urls.programs.programDetail(parentProgram.id),
        parentProgram,
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: parentProgram.courses,
          page_size: parentProgram.courses.length,
        }),
        parentCourses,
      )
      setMockResponse.get(
        mitxonline.urls.programs.programsList({
          id: [900],
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
          id: [11],
          page_size: 1,
        }),
        programAsCourseCourses,
      )

      renderWithProviders(<EnrollmentDisplay programId={parentProgram.id} />)

      // program-as-course has certificate → counts as completed
      await screen.findByText(/Completed 1 of 2/)
      await screen.findByText(/1 of 2 courses/)
    })

    test("Shows enrollment status for program courses", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const requirements = reqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      requirements.addCourse({ course: 1 })

      const program = mitxonline.factories.programs.program({
        id: 789,
        courses: [1],
        req_tree: reqTree.serialize(),
      })

      const courses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Test Course",
            page: {
              page_url: "/courses/test-course/",
            },
            courseruns: [mitxonline.factories.courses.courseRun()],
          }),
        ],
      }

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(789), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )
      // Also mock the undefined id case
      setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
        results: [],
      })

      renderWithProviders(<EnrollmentDisplay programId={789} />)

      // Wait for the section header to load
      await screen.findByText("Requirements")

      // Wait for the completion count to appear (this means courses have loaded)
      await screen.findByText(/Completed 0 of 1/)

      // Wait for loading to complete - check that skeleton is gone
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId("skeleton")
          expect(skeletons).toHaveLength(0)
        },
        { timeout: 3000 },
      )

      // Now check for the title - there will be 2 (desktop and mobile)
      const titles = screen.getAllByText("Test Course")
      expect(titles.length).toBeGreaterThanOrEqual(1)
    })

    test("Shows 'Continue' button for enrolled courses and 'Start Course' for unenrolled", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const requirements = reqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      requirements.addCourse({ course: 1 })
      requirements.addCourse({ course: 2 })

      const program = mitxonline.factories.programs.program({
        id: 777,
        courses: [1, 2],
        req_tree: reqTree.serialize(),
      })

      const enrolledRun = mitxonline.factories.courses.courseRun({
        id: 100,
        start_date: "2024-01-01T00:00:00Z", // Past date
        end_date: "2099-12-31T23:59:59Z", // Far future date
        courseware_url: faker.internet.url(),
      })
      const unenrolledRun = mitxonline.factories.courses.courseRun({
        id: 200,
      })

      const courses = {
        count: 2,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Enrolled Course",
            courseruns: [enrolledRun],
          }),
          mitxonline.factories.courses.course({
            id: 2,
            title: "Unenrolled Course",
            courseruns: [unenrolledRun],
          }),
        ],
      }

      const enrollment = mitxonline.factories.enrollment.courseEnrollment({
        run: {
          ...enrolledRun,
          course: courses.results[0],
        },
        certificate: null, // No certificate - course is not completed
        grades: [], // Enrolled but not completed
      })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
        enrollment,
      ])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(777), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={777} />)

      await screen.findByText("Requirements")

      // Wait for cards to load
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId("skeleton")
          expect(skeletons).toHaveLength(0)
        },
        { timeout: 3000 },
      )

      // Find desktop cards (we'll focus on those for this test)
      const cards = screen.getAllByTestId("enrollment-card-desktop")
      const enrolledCard = cards.find((card) =>
        within(card).queryByText("Enrolled Course"),
      )
      const unenrolledCard = cards.find((card) =>
        within(card).queryByText("Unenrolled Course"),
      )

      expect(enrolledCard).toBeDefined()
      expect(unenrolledCard).toBeDefined()

      // Enrolled course should show "Continue" button and be a link
      const continueButton = within(enrolledCard!).getByTestId(
        "courseware-button",
      )
      expect(continueButton).toHaveTextContent("Continue")
      expect(continueButton.tagName).toBe("A") // Should be a link

      // Unenrolled course should show "Start Course" button
      const startButton = within(unenrolledCard!).getByTestId(
        "courseware-button",
      )
      expect(startButton).toHaveTextContent("Start Course")
      expect(startButton.tagName).toBe("BUTTON") // Should be a button
    })

    test("Clicking unenrolled course in program opens CourseEnrollmentDialog", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const requirements = reqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      requirements.addCourse({ course: 1 })

      const program = mitxonline.factories.programs.program({
        id: 666,
        courses: [1],
        req_tree: reqTree.serialize(),
      })

      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: null, // Non-B2B
        is_enrollable: true,
        enrollment_modes: [
          mitxonline.factories.courses.enrollmentMode({
            requires_payment: false,
          }),
          mitxonline.factories.courses.enrollmentMode({
            requires_payment: true,
          }),
        ],
      })

      const courses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Clickable Course",
            courseruns: [run],
          }),
        ],
      }

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), []) // No enrollments
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            enrollment_mode: "audit",
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(666), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={666} />)

      await screen.findByText("Requirements")

      // Wait for cards to load
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId("skeleton")
          expect(skeletons).toHaveLength(0)
        },
        { timeout: 3000 },
      )

      const cards = screen.getAllByTestId("enrollment-card-desktop")
      const card = cards.find((c) => within(c).queryByText("Clickable Course"))
      invariant(card, "Expected to find a card containing 'Clickable Course'")

      const startButton = within(card).getByTestId("courseware-button")
      await user.click(startButton)

      // Should open CourseEnrollmentDialog
      await screen.findByRole("dialog", { name: "Clickable Course" })
    })

    test.each([
      { minNumberOf: "1", expectCompletionCount: true },
      { minNumberOf: "0", expectCompletionCount: false },
    ])(
      "Displays correct completion count for sections with min_number_of operator",
      async ({ minNumberOf, expectCompletionCount }) => {
        const mitxOnlineUser = mitxonline.factories.user.user()
        setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

        const reqTree =
          new mitxonline.factories.requirements.RequirementTreeBuilder()
        const electives = reqTree.addOperator({
          operator: "min_number_of",
          operator_value: minNumberOf,
          title: "Electives",
        })
        electives.addCourse({ course: 1 })
        electives.addCourse({ course: 2 })

        const program = mitxonline.factories.programs.program({
          id: 999,
          courses: [1, 2],
          req_tree: reqTree.serialize(),
        })

        const courses = {
          count: 2,
          next: null,
          previous: null,
          results: [
            mitxonline.factories.courses.course({
              id: 1,
              title: "Elective Course 1",
              page: {
                page_url: "/courses/elective-1/",
              },
              courseruns: [mitxonline.factories.courses.courseRun()],
            }),
            mitxonline.factories.courses.course({
              id: 2,
              title: "Elective Course 2",
              page: {
                page_url: "/courses/elective-2/",
              },
              courseruns: [mitxonline.factories.courses.courseRun()],
            }),
          ],
        }

        mockedUseFeatureFlagEnabled.mockReturnValue(true)
        setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
        setMockResponse.get(
          mitxonline.urls.programEnrollments.enrollmentsListV3(),
          [
            mitxonline.factories.enrollment.programEnrollmentV3({
              program: {
                id: program.id,
                title: program.title,
                live: program.live,
                program_type: program.program_type,
                readable_id: program.readable_id,
              },
            }),
          ],
        )
        setMockResponse.get(
          mitxonline.urls.programs.programDetail(999),
          program,
        )
        setMockResponse.get(
          mitxonline.urls.courses.coursesList({
            id: program.courses,
            page_size: program.courses.length,
          }),
          courses,
        )

        renderWithProviders(<EnrollmentDisplay programId={999} />)

        await screen.findByText("Electives")

        if (expectCompletionCount) {
          const completionCount = screen.getByTestId("section-completion-count")
          expect(completionCount).toHaveTextContent("Completed 0 of 1")
          expect(screen.getByText(/0 of 1 courses/)).toBeInTheDocument()
        } else {
          expect(
            screen.queryByTestId("section-completion-count"),
          ).not.toBeInTheDocument()
        }
      },
    )

    test("Overall completion count caps elective completions at min_number_of value", async () => {
      /**
       * Program has 2 required courses (all_of) and 3 electives (min_number_of=1).
       * User completes 1 required course + 2 electives.
       * Bug: counts all 3 completions → "3 of 3 courses" (wrong).
       * Fix: caps elective contribution at 1 → "2 of 3 courses" (correct).
       */
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const required = reqTree.addOperator({
        operator: "all_of",
        title: "Required Courses",
      })
      required.addCourse({ course: 1 })
      required.addCourse({ course: 2 })

      const electives = reqTree.addOperator({
        operator: "min_number_of",
        operator_value: "1",
        title: "Electives",
      })
      electives.addCourse({ course: 3 })
      electives.addCourse({ course: 4 })
      electives.addCourse({ course: 5 })

      const program = mitxonline.factories.programs.program({
        id: 5555,
        courses: [1, 2, 3, 4, 5],
        req_tree: reqTree.serialize(),
      })

      const run1 = mitxonline.factories.courses.courseRun({ id: 101 })
      const run3 = mitxonline.factories.courses.courseRun({ id: 103 })
      const run4 = mitxonline.factories.courses.courseRun({ id: 104 })

      const courses = {
        count: 5,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            courseruns: [run1],
          }),
          mitxonline.factories.courses.course({
            id: 2,
            courseruns: [mitxonline.factories.courses.courseRun({ id: 102 })],
          }),
          mitxonline.factories.courses.course({
            id: 3,
            courseruns: [run3],
          }),
          mitxonline.factories.courses.course({
            id: 4,
            courseruns: [run4],
          }),
          mitxonline.factories.courses.course({
            id: 5,
            courseruns: [mitxonline.factories.courses.courseRun({ id: 105 })],
          }),
        ],
      }

      // Course 1 (required) completed, courses 3 and 4 (electives) completed
      const completedGrade = mitxonline.factories.enrollment.grade({
        passed: true,
      })
      const enrollments = [
        mitxonline.factories.enrollment.courseEnrollment({
          run: { ...run1, course: courses.results[0] },
          grades: [completedGrade],
        }),
        mitxonline.factories.enrollment.courseEnrollment({
          run: { ...run3, course: courses.results[2] },
          grades: [completedGrade],
        }),
        mitxonline.factories.enrollment.courseEnrollment({
          run: { ...run4, course: courses.results[3] },
          grades: [completedGrade],
        }),
      ]

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(
        mitxonline.urls.enrollment.enrollmentsListV3(),
        enrollments,
      )
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(5555), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={5555} />)

      // 1 required completed + min(2 electives completed, 1 required) = 2 total completed
      // total = 2 required + 1 elective min = 3
      await screen.findByText(/2 of 3 courses/)
    })

    test("Section header caps displayed count at operator_value for min_number_of sections", async () => {
      /**
       * Electives section with min_number_of=1 and 3 completed courses.
       * The section header should show "Completed 1 of 1", not "Completed 3 of 1".
       */
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const electives = reqTree.addOperator({
        operator: "min_number_of",
        operator_value: "1",
        title: "Electives",
      })
      electives.addCourse({ course: 1 })
      electives.addCourse({ course: 2 })
      electives.addCourse({ course: 3 })

      const program = mitxonline.factories.programs.program({
        id: 6666,
        courses: [1, 2, 3],
        req_tree: reqTree.serialize(),
      })

      const run1 = mitxonline.factories.courses.courseRun({ id: 201 })
      const run2 = mitxonline.factories.courses.courseRun({ id: 202 })
      const run3 = mitxonline.factories.courses.courseRun({ id: 203 })

      const courses = {
        count: 3,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            courseruns: [run1],
          }),
          mitxonline.factories.courses.course({
            id: 2,
            courseruns: [run2],
          }),
          mitxonline.factories.courses.course({
            id: 3,
            courseruns: [run3],
          }),
        ],
      }

      // All 3 electives completed
      const completedGrade = mitxonline.factories.enrollment.grade({
        passed: true,
      })
      const enrollments = [
        mitxonline.factories.enrollment.courseEnrollment({
          run: { ...run1, course: courses.results[0] },
          grades: [completedGrade],
        }),
        mitxonline.factories.enrollment.courseEnrollment({
          run: { ...run2, course: courses.results[1] },
          grades: [completedGrade],
        }),
        mitxonline.factories.enrollment.courseEnrollment({
          run: { ...run3, course: courses.results[2] },
          grades: [completedGrade],
        }),
      ]

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(
        mitxonline.urls.enrollment.enrollmentsListV3(),
        enrollments,
      )
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(6666), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={6666} />)

      await screen.findByText("Electives")

      // Section header should show "Completed 1 of 1", capped at operator_value
      const sectionCount = screen.getByTestId("section-completion-count")
      expect(sectionCount).toHaveTextContent("Completed 1 of 1")
      // Overall header should also show 1 of 1 (only electives section)
      expect(screen.getByText(/1 of 1 courses/)).toBeInTheDocument()
    })

    test("Returns 404 page when user is not enrolled in the program", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const requirements = reqTree.addOperator({
        operator: "all_of",
        title: "Requirements",
      })
      requirements.addCourse({ course: 1 })

      const program = mitxonline.factories.programs.program({
        id: 888,
        courses: [1],
        req_tree: reqTree.serialize(),
      })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      // User is not enrolled in any programs
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(888), program)

      renderWithProviders(<EnrollmentDisplay programId={888} />)

      // Should show 404 page instead of program content
      await screen.findByText(
        "Looks like we couldn't find what you were looking for!",
      )
      expect(screen.queryByText("Requirements")).not.toBeInTheDocument()
    })

    /**
     * Sets up a verified program dashboard scenario with:
     * - A parent program with a verified enrollment
     * - A direct child course (regular requirement)
     * - A child program-as-course with its own module course
     *
     * Mocks all API responses. Does not render — callers handle rendering
     * and assertions.
     */
    const setupProgramDashboardVerifiedEnrollmentScenario = () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      // Child course (direct requirement of the parent program)
      const childCourseRun = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        courseware_url: faker.internet.url(),
      })
      const childCourse = mitxonline.factories.courses.course({
        courseruns: [childCourseRun],
        next_run_id: childCourseRun.id,
      })

      // Module course (child of the program-as-course)
      const moduleRun = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        courseware_url: faker.internet.url(),
      })
      const moduleCourse = mitxonline.factories.courses.course({
        courseruns: [moduleRun],
        next_run_id: moduleRun.id,
      })

      // Program-as-course (child requirement of the parent program)
      const programAsCourseReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const moduleSection = programAsCourseReqTree.addOperator({
        operator: "all_of",
        title: "Modules",
      })
      moduleSection.addCourse({ course: moduleCourse.id })

      const programAsCourse = mitxonline.factories.programs.program({
        display_mode: "course",
        courses: [moduleCourse.id],
        req_tree: programAsCourseReqTree.serialize(),
      })

      // Parent program with both a course and a program-as-course
      const parentReqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const parentRequirements = parentReqTree.addOperator({
        operator: "all_of",
        title: "Program Requirements",
      })
      parentRequirements.addCourse({ course: childCourse.id })
      parentRequirements.addProgram({ program: programAsCourse.id })

      const parentProgram = mitxonline.factories.programs.program({
        courses: [childCourse.id],
        req_tree: parentReqTree.serialize(),
      })

      const parentProgramEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          enrollment_mode: "verified",
          program: {
            id: parentProgram.id,
            title: parentProgram.title,
            live: parentProgram.live,
            program_type: parentProgram.program_type,
            readable_id: parentProgram.readable_id,
          },
        })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [parentProgramEnrollment],
      )
      setMockResponse.get(
        mitxonline.urls.programs.programDetail(parentProgram.id),
        parentProgram,
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: parentProgram.courses,
          page_size: parentProgram.courses.length,
        }),
        { count: 1, next: null, previous: null, results: [childCourse] },
      )
      setMockResponse.get(
        mitxonline.urls.programs.programsList({
          id: [programAsCourse.id],
          page_size: 1,
        }),
        {
          count: 1,
          next: null,
          previous: null,
          results: [programAsCourse],
        },
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: [moduleCourse.id],
          page_size: 1,
        }),
        { count: 1, next: null, previous: null, results: [moduleCourse] },
      )

      // Mock verified enrollment endpoints for both course runs
      const childCourseEnrollmentEndpoint =
        mitxonline.urls.verifiedProgramEnrollments.create(
          childCourseRun.courseware_id,
        )
      setMockResponse.post(childCourseEnrollmentEndpoint, {})

      const moduleCourseEnrollmentEndpoint =
        mitxonline.urls.verifiedProgramEnrollments.create(
          moduleRun.courseware_id,
        )
      setMockResponse.post(moduleCourseEnrollmentEndpoint, {})

      return {
        parentProgram,
        parentProgramEnrollment,
        childCourse,
        childCourseRun,
        childCourseEnrollmentEndpoint,
        programAsCourse,
        moduleCourse,
        moduleRun,
        moduleCourseEnrollmentEndpoint,
      }
    }

    test("Clicking 'Start Course' on a regular course in a verified program does one-click enrollment", async () => {
      const {
        parentProgram,
        parentProgramEnrollment,
        childCourse,
        childCourseEnrollmentEndpoint,
      } = setupProgramDashboardVerifiedEnrollmentScenario()

      renderWithProviders(<EnrollmentDisplay programId={parentProgram.id} />)

      await screen.findByText("Program Requirements")
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId("skeleton")
          expect(skeletons).toHaveLength(0)
        },
        { timeout: 3000 },
      )

      const cards = screen.getAllByTestId("enrollment-card-desktop")
      const card = cards.find((c) => within(c).queryByText(childCourse.title))
      invariant(
        card,
        `Expected to find a card containing "${childCourse.title}"`,
      )

      const startButton = within(card).getByTestId("courseware-button")
      await user.click(startButton)

      await waitFor(() => {
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "POST",
            url: childCourseEnrollmentEndpoint,
            data: JSON.stringify([parentProgramEnrollment.program.readable_id]),
          }),
        )
      })

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("Clicking 'Start Course' on a module in a program-as-course sends both parent and grandparent program IDs", async () => {
      const {
        parentProgram,
        parentProgramEnrollment,
        programAsCourse,
        moduleCourse,
        moduleCourseEnrollmentEndpoint,
      } = setupProgramDashboardVerifiedEnrollmentScenario()

      renderWithProviders(<EnrollmentDisplay programId={parentProgram.id} />)

      await screen.findByText("Program Requirements")
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId("skeleton")
          expect(skeletons).toHaveLength(0)
        },
        { timeout: 3000 },
      )

      const cards = screen.getAllByTestId("enrollment-card-desktop")
      const card = cards.find((c) => within(c).queryByText(moduleCourse.title))
      invariant(
        card,
        `Expected to find a card containing "${moduleCourse.title}"`,
      )

      const startButton = within(card).getByTestId("courseware-button")
      await user.click(startButton)

      await waitFor(() => {
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "POST",
            url: moduleCourseEnrollmentEndpoint,
            data: JSON.stringify([
              programAsCourse.readable_id,
              parentProgramEnrollment.program.readable_id,
            ]),
          }),
        )
      })

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("Displays courses in the order defined by the requirement tree, not API order", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const courses = mitxonline.factories.courses.courses({ count: 3 })
      const [courseA, courseB, courseC] = courses.results

      // Requirement tree defines courses in order: C, A, B
      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const core = reqTree.addOperator({
        operator: "all_of",
        title: "Core Courses",
      })
      core.addCourse({ course: courseC.id })
      core.addCourse({ course: courseA.id })
      core.addCourse({ course: courseB.id })

      const program = mitxonline.factories.programs.program({
        courses: [courseA.id, courseB.id, courseC.id],
        req_tree: reqTree.serialize(),
      })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [
          mitxonline.factories.enrollment.programEnrollmentV3({
            program: {
              id: program.id,
              title: program.title,
              live: program.live,
              program_type: program.program_type,
              readable_id: program.readable_id,
            },
          }),
        ],
      )
      setMockResponse.get(
        mitxonline.urls.programs.programDetail(program.id),
        program,
      )
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={program.id} />)

      await screen.findByText("Core Courses")

      // Cards should appear in req_tree order: C, A, B
      const cards = await screen.findAllByTestId("enrollment-card-desktop")
      expect(cards[0]).toHaveTextContent(courseC.title)
      expect(cards[1]).toHaveTextContent(courseA.title)
      expect(cards[2]).toHaveTextContent(courseB.title)
    })

    test("displays certificate button when program enrollment has a certificate", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const certUuid = "test-program-cert-uuid"
      const program = mitxonline.factories.programs.program({
        id: 456,
        title: "Program With Certificate",
        courses: [10, 11],
      })
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program: {
            id: program.id,
            title: program.title,
            live: program.live,
            program_type: program.program_type,
            readable_id: program.readable_id,
          },
          certificate: {
            uuid: certUuid,
            link: `/certificate/program/${certUuid}/`,
          },
        })
      const courses = mitxonline.factories.courses.courses({ count: 2 })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [programEnrollment],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(456), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={456} />)

      await screen.findByText("Program With Certificate")
      const certButton = screen.getByRole("link", { name: "Certificate" })
      const expectedCertHref = programEnrollment.certificate?.link?.replace(
        /\/$/,
        "",
      )
      expect(certButton).toBeInTheDocument()
      expect(certButton).toHaveAttribute("href", expectedCertHref)
      expect(certButton).not.toHaveAttribute("target")
    })

    test("does not display certificate button when program enrollment has no certificate", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const program = mitxonline.factories.programs.program({
        id: 457,
        title: "Program Without Certificate",
        courses: [12, 13],
      })
      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          program: {
            id: program.id,
            title: program.title,
            live: program.live,
            program_type: program.program_type,
            readable_id: program.readable_id,
          },
          certificate: null,
        })
      const courses = mitxonline.factories.courses.courses({ count: 2 })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [programEnrollment],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(457), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({
          id: program.courses,
          page_size: program.courses.length,
        }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={457} />)

      await screen.findByText("Program Without Certificate")
      const certButton = screen.queryByRole("link", { name: "Certificate" })
      expect(certButton).not.toBeInTheDocument()
    })
  })
})
