import React from "react"
import { waitFor } from "@testing-library/react"
import {
  renderWithProviders,
  screen,
  setMockResponse,
  setupLocationMock,
  user,
  within,
} from "@/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { mockAxiosInstance } from "api/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { faker } from "@faker-js/faker/locale/en"
import { ProgramEnrollmentDisplay } from "./ProgramEnrollmentDisplay"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

describe("ProgramEnrollmentDisplay", () => {
  setupLocationMock()

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
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )
    // Also mock the undefined id case (when program data isn't loaded yet)
    setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
      results: [],
    })

    renderWithProviders(<ProgramEnrollmentDisplay programId={123} />)

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
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )
    setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
      results: [],
    })

    renderWithProviders(<ProgramEnrollmentDisplay programId={456} />)

    await screen.findByText(/for this program/)

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
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )
    setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
      results: [],
    })

    renderWithProviders(<ProgramEnrollmentDisplay programId={789} />)

    await screen.findByText("Requirements")
    await screen.findByText(/Completed 0 of 1/)

    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId("skeleton")
        expect(skeletons).toHaveLength(0)
      },
      { timeout: 3000 },
    )

    const titles = screen.getAllByText("Test Course")
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  test("Shows 'Continue' button for enrolled courses and 'Start' for unenrolled", async () => {
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
      start_date: "2024-01-01T00:00:00Z",
      end_date: "2099-12-31T23:59:59Z",
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
      certificate: null,
      grades: [],
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
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )

    renderWithProviders(<ProgramEnrollmentDisplay programId={777} />)

    await screen.findByText("Requirements")

    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId("skeleton")
        expect(skeletons).toHaveLength(0)
      },
      { timeout: 3000 },
    )

    const cards = screen.getAllByTestId("enrollment-card-desktop")
    const enrolledCard = cards.find((card) =>
      within(card).queryByText("Enrolled Course"),
    )
    const unenrolledCard = cards.find((card) =>
      within(card).queryByText("Unenrolled Course"),
    )

    expect(enrolledCard).toBeDefined()
    expect(unenrolledCard).toBeDefined()

    const continueButton = within(enrolledCard!).getByTestId(
      "courseware-button",
    )
    expect(continueButton).toHaveTextContent("Continue")
    expect(continueButton.tagName).toBe("A")

    const startButton = within(unenrolledCard!).getByTestId("courseware-button")
    expect(startButton).toHaveTextContent("Start")
    expect(startButton.tagName).toBe("BUTTON")
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
      b2b_contract: null,
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
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
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

    renderWithProviders(<ProgramEnrollmentDisplay programId={666} />)

    await screen.findByText("Requirements")

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
    setMockResponse.get(mitxonline.urls.programs.programDetail(999), program)
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )

    renderWithProviders(<ProgramEnrollmentDisplay programId={999} />)

    await screen.findByText(/Completed 0 of 1/)
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
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    setMockResponse.get(mitxonline.urls.programs.programDetail(888), program)

    renderWithProviders(<ProgramEnrollmentDisplay programId={888} />)

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
        enrollment_mode: "verified",
        program: {
          id: program.id,
          title: program.title,
          live: program.live,
          program_type: program.program_type,
          readable_id: program.readable_id,
        },
      })

    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programEnrollment],
    )
    setMockResponse.get(mitxonline.urls.programs.programDetail(888), program)
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )

    const programEnrollmentEndpoint =
      mitxonline.urls.verifiedProgramEnrollments.create(
        programEnrollment.program.readable_id,
        run.courseware_id,
      )
    setMockResponse.post(programEnrollmentEndpoint, {})

    renderWithProviders(<ProgramEnrollmentDisplay programId={888} />)

    await screen.findByText("Program Requirements")

    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId("skeleton")
        expect(skeletons).toHaveLength(0)
      },
      { timeout: 3000 },
    )

    const cards = screen.getAllByTestId("enrollment-card-desktop")
    const card = cards.find((c) => within(c).queryByText("Test Course"))
    expect(card).toBeDefined()

    const startButton = within(card!).getByTestId("courseware-button")
    await user.click(startButton)

    await waitFor(() => {
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: programEnrollmentEndpoint,
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
      mitxonline.urls.courses.coursesList({ id: program.courses }),
      courses,
    )

    renderWithProviders(<ProgramEnrollmentDisplay programId={program.id} />)

    await screen.findByText("Core Courses")

    // Cards should appear in req_tree order: C, A, B
    const cards = await screen.findAllByTestId("enrollment-card-desktop")
    expect(cards[0]).toHaveTextContent(courseC.title)
    expect(cards[1]).toHaveTextContent(courseA.title)
    expect(cards[2]).toHaveTextContent(courseB.title)
  })

  test("Displays required programs with display_mode=course and excludes true programs", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const parentCourse = mitxonline.factories.courses.course({
      id: 5001,
      title: "Parent Section Course",
      courseruns: [mitxonline.factories.courses.courseRun()],
    })

    const programAsCourse = mitxonline.factories.programs.program({
      id: 6001,
      title: "Embedded Program As Course",
      display_mode: "course",
      courses: [],
      req_tree: [],
    })
    const trueProgram = mitxonline.factories.programs.program({
      id: 6002,
      title: "True Program",
      display_mode: null,
      courses: [],
      req_tree: [],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Mixed Requirements",
    })
    section.addCourse({ course: parentCourse.id })
    section.addProgram({ program: programAsCourse.id })
    section.addProgram({ program: trueProgram.id })

    const parentProgram = mitxonline.factories.programs.program({
      id: 7001,
      title: "Parent Program",
      courses: [parentCourse.id],
      req_tree: reqTree.serialize(),
    })

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
            id: programAsCourse.id,
            title: programAsCourse.title,
            live: programAsCourse.live,
            program_type: programAsCourse.program_type,
            readable_id: programAsCourse.readable_id,
            display_mode: "course",
          },
        }),
        mitxonline.factories.enrollment.programEnrollmentV3({
          program: {
            id: trueProgram.id,
            title: trueProgram.title,
            live: trueProgram.live,
            program_type: trueProgram.program_type,
            readable_id: trueProgram.readable_id,
            display_mode: null,
          },
        }),
      ],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programDetail(parentProgram.id),
      parentProgram,
    )
    setMockResponse.get(
      mitxonline.urls.programs.programDetail(programAsCourse.id),
      programAsCourse,
    )
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({ id: parentProgram.courses }),
      {
        count: 1,
        next: null,
        previous: null,
        results: [parentCourse],
      },
    )
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({ id: programAsCourse.courses }),
      {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    )
    setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
      count: 0,
      next: null,
      previous: null,
      results: [],
    })

    renderWithProviders(
      <ProgramEnrollmentDisplay programId={parentProgram.id} />,
    )

    await screen.findByText("Mixed Requirements")
    expect(screen.getAllByText("Parent Section Course").length).toBeGreaterThan(
      0,
    )
    await waitFor(
      () => {
        expect(
          screen.getByText("Embedded Program As Course"),
        ).toBeInTheDocument()
      },
      { timeout: 4000 },
    )
    expect(screen.queryByText("True Program")).not.toBeInTheDocument()
  })

  test("Displays mixed course/program items in requirement-tree order", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const courseOne = mitxonline.factories.courses.course({
      id: 8001,
      title: "Ordered Course One",
      courseruns: [mitxonline.factories.courses.courseRun()],
    })
    const courseTwo = mitxonline.factories.courses.course({
      id: 8002,
      title: "Ordered Course Two",
      courseruns: [mitxonline.factories.courses.courseRun()],
    })
    const programAsCourse = mitxonline.factories.programs.program({
      id: 8003,
      title: "Ordered Program As Course",
      display_mode: "course",
      courses: [],
      req_tree: [],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Order Test",
    })
    section.addProgram({ program: programAsCourse.id })
    section.addCourse({ course: courseOne.id })
    section.addCourse({ course: courseTwo.id })

    const parentProgram = mitxonline.factories.programs.program({
      id: 8004,
      title: "Order Parent Program",
      courses: [courseOne.id, courseTwo.id],
      req_tree: reqTree.serialize(),
    })

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
            id: programAsCourse.id,
            title: programAsCourse.title,
            live: programAsCourse.live,
            program_type: programAsCourse.program_type,
            readable_id: programAsCourse.readable_id,
            display_mode: "course",
          },
        }),
      ],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programDetail(parentProgram.id),
      parentProgram,
    )
    setMockResponse.get(
      mitxonline.urls.programs.programDetail(programAsCourse.id),
      programAsCourse,
    )
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({ id: parentProgram.courses }),
      {
        count: 2,
        next: null,
        previous: null,
        results: [courseOne, courseTwo],
      },
    )
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({ id: programAsCourse.courses }),
      {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    )
    setMockResponse.get(mitxonline.urls.courses.coursesList({}), {
      count: 0,
      next: null,
      previous: null,
      results: [],
    })

    renderWithProviders(
      <ProgramEnrollmentDisplay programId={parentProgram.id} />,
    )

    await screen.findByText("Order Test")
    await waitFor(
      () => {
        expect(
          screen.getByText("Ordered Program As Course"),
        ).toBeInTheDocument()
      },
      { timeout: 4000 },
    )

    const programTitle = screen.getByText("Ordered Program As Course")
    const courseOneTitle = screen.getAllByText("Ordered Course One")[0]
    const courseTwoTitle = screen.getAllByText("Ordered Course Two")[0]

    expect(
      programTitle.compareDocumentPosition(courseOneTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      courseOneTitle.compareDocumentPosition(courseTwoTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
