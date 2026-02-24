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
      mitxonline.urls.enrollment.enrollmentsListV2(),
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
    // Need at least one course enrollment to render the wrapper
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          ...mitxonline.factories.enrollment.courseEnrollment().run,
          title: "Dummy Course",
        },
      }),
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<EnrollmentDisplay />)

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
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [
      courseEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

    renderWithProviders(<EnrollmentDisplay />)

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
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

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
    // Need at least one course enrollment to render the wrapper
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [
      mitxonline.factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          ...mitxonline.factories.enrollment.courseEnrollment().run,
          title: "Dummy Course",
        },
      }),
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [b2bProgramEnrollment, nonB2BProgramEnrollment],
    )
    // Mock contracts to filter out the B2B program
    const contract = mitxonline.factories.contracts.contract({
      programs: [b2bProgramEnrollment.program.id],
    })
    setMockResponse.get(mitxonline.urls.contracts.contractsList(), [contract])

    renderWithProviders(<EnrollmentDisplay />)

    await screen.findByRole("heading", { name: "My Learning" })

    // Should only show the non-B2B program (appears in desktop + mobile cards)
    const personalProgramCards = await screen.findAllByText("Personal Program")
    expect(personalProgramCards.length).toBeGreaterThan(0)
    expect(screen.queryByText("B2B Program")).not.toBeInTheDocument()
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [])
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
        mitxonline.urls.courses.coursesList({ id: program.courses }),
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [])
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
        mitxonline.urls.courses.coursesList({ id: program.courses }),
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [])
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
        mitxonline.urls.courses.coursesList({ id: program.courses }),
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [
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
        mitxonline.urls.courses.coursesList({ id: program.courses }),
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), []) // No enrollments
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
        mitxonline.urls.courses.coursesList({ id: program.courses }),
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
      expect(card).toBeDefined()

      const startButton = within(card!).getByTestId("courseware-button")
      await user.click(startButton)

      // Should open CourseEnrollmentDialog
      await screen.findByRole("dialog", { name: "Clickable Course" })
    })

    test("Displays correct completion count for sections with min_number_of operator", async () => {
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [])
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
      setMockResponse.get(mitxonline.urls.programs.programDetail(999), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({ id: program.courses }),
        courses,
      )

      renderWithProviders(<EnrollmentDisplay programId={999} />)

      // Should show "0 of 1" not "0 of 2" since operator_value is "1"
      await screen.findByText(/Completed 0 of 1/)

      // Total for program should also be 1
      await screen.findByText(/0 of 1 courses/)
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
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), [])
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

    test("Clicking 'Start Course' in verified program does one-click enrollment", async () => {
      const mitxOnlineUser = mitxonline.factories.user.user()
      setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

      const reqTree =
        new mitxonline.factories.requirements.RequirementTreeBuilder()
      const requirements = reqTree.addOperator({
        operator: "all_of",
        title: "Program Requirements",
      })
      requirements.addCourse({ course: 1 })

      const program = mitxonline.factories.programs.program({
        id: 888,
        courses: [1],
        req_tree: reqTree.serialize(),
      })

      const run = mitxonline.factories.courses.courseRun({
        b2b_contract: null,
        is_enrollable: true,
        courseware_url: faker.internet.url(),
      })

      const courses = {
        count: 1,
        next: null,
        previous: null,
        results: [
          mitxonline.factories.courses.course({
            id: 1,
            title: "Test Course",
            courseruns: [run],
            next_run_id: run.id,
          }),
        ],
      }

      const programEnrollment =
        mitxonline.factories.enrollment.programEnrollmentV3({
          enrollment_mode: "verified", // Verified program enrollment
          program: {
            id: program.id,
            title: program.title,
            live: program.live,
            program_type: program.program_type,
            readable_id: program.readable_id,
          },
        })

      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV2(), []) // No course enrollments yet
      setMockResponse.get(
        mitxonline.urls.programEnrollments.enrollmentsListV3(),
        [programEnrollment],
      )
      setMockResponse.get(mitxonline.urls.programs.programDetail(888), program)
      setMockResponse.get(
        mitxonline.urls.courses.coursesList({ id: program.courses }),
        courses,
      )

      // Mock the enrollment endpoint
      setMockResponse.post(mitxonline.urls.enrollment.enrollmentsListV1(), {})

      renderWithProviders(<EnrollmentDisplay programId={888} />)

      await screen.findByText("Program Requirements")

      // Wait for the card to load
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId("skeleton")
          expect(skeletons).toHaveLength(0)
        },
        { timeout: 3000 },
      )

      // Find the card and click the button
      const cards = screen.getAllByTestId("enrollment-card-desktop")
      const card = cards.find((c) => within(c).queryByText("Test Course"))
      expect(card).toBeDefined()

      const startButton = within(card!).getByTestId("courseware-button")
      await user.click(startButton)

      // Should call enrollment endpoint (not open dialog)
      await waitFor(() => {
        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "POST",
            url: mitxonline.urls.enrollment.enrollmentsListV1(),
          }),
        )
      })

      // Dialog should NOT appear
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
