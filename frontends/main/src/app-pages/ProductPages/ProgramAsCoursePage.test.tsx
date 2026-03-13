import React from "react"
import {
  urls,
  factories,
  RequirementTreeBuilder,
} from "api/mitxonline-test-utils"
import {
  setMockResponse,
  urls as learnUrls,
  factories as learnFactories,
} from "api/test-utils"
import type {
  V2ProgramDetail,
  ProgramPageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { renderWithProviders, waitFor, screen, within } from "@/test-utils"
import ProgramAsCoursePage from "./ProgramAsCoursePage"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import invariant from "tiny-invariant"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeProgram = factories.programs.program
const makePage = factories.pages.programPageItem

const getCourseIdsFromRequirements = (
  requirements: V2ProgramDetail["requirements"],
): number[] => {
  const required =
    requirements?.courses?.required
      ?.map((c) => c.id)
      .filter((id): id is number => id !== undefined) ?? []
  const electives =
    requirements?.courses?.electives
      ?.map((c) => c.id)
      .filter((id): id is number => id !== undefined) ?? []
  return [...required, ...electives]
}

const setupApis = ({
  program,
  page,
}: {
  program: V2ProgramDetail
  page: ProgramPageItem
}): { courses: CourseWithCourseRunsSerializerV2[] } => {
  setMockResponse.get(
    urls.programs.programsList({ readable_id: program.readable_id }),
    { results: [program] },
  )
  setMockResponse.get(urls.pages.programPages(program.readable_id), {
    items: [page],
  })

  const courseIds = getCourseIdsFromRequirements(program.requirements)
  const courses: CourseWithCourseRunsSerializerV2[] = courseIds.map((id) =>
    factories.courses.course({ id }),
  )

  if (courses.length > 0) {
    setMockResponse.get(
      urls.courses.coursesList({
        id: courses.map((c) => c.id),
        page_size: courses.length,
      }),
      { results: courses },
    )
  }

  setMockResponse.get(
    learnUrls.userMe.get(),
    learnFactories.user.user({ is_authenticated: false }),
  )
  setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])

  return { courses }
}

describe("ProgramAsCoursePage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  test("Uses 'Course' breadcrumb label, not 'Program'", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const banner = await screen.findByTestId("banner-container")
    expect(within(banner).getByText("Course")).toBeInTheDocument()
    expect(within(banner).queryByText("Program")).not.toBeInTheDocument()
  })

  test("Uses 'About this Course' heading, not 'About this Program'", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    invariant(page.about)
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const section = await screen.findByRole("region", {
      name: "About this Course",
    })
    expect(section).toBeInTheDocument()
  })

  test("Uses 'Who can take this Course?' heading", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    await screen.findByRole("heading", { name: "Who can take this Course?" })
  })

  test("Does not show program_type or platform tags", async () => {
    const program = makeProgram({
      display_mode: DisplayModeEnum.Course,
      program_type: "Series",
    })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const banner = await screen.findByTestId("banner-container")
    expect(within(banner).queryByText("MITx")).not.toBeInTheDocument()
    expect(within(banner).queryByText("Series")).not.toBeInTheDocument()
  })

  test("Renders an enrollment button", async () => {
    const program = makeProgram({
      display_mode: DisplayModeEnum.Course,
      enrollment_modes: [
        factories.courses.enrollmentMode({ requires_payment: false }),
      ],
    })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    const buttons = await screen.findAllByRole("button", { name: /enroll/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  test("Renders Course Information in info box, not Program Information", async () => {
    const program = makeProgram({ display_mode: DisplayModeEnum.Course })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )
    await waitFor(() => {
      expect(screen.getByText("Course Information")).toBeInTheDocument()
    })
    expect(screen.queryByText("Program Information")).not.toBeInTheDocument()
  })

  test("Returns 404 if no program found", async () => {
    setMockResponse.get(
      urls.programs.programsList({ readable_id: "readable_id" }),
      { results: [] },
    )
    setMockResponse.get(urls.pages.programPages("readable_id"), {
      items: [],
    })
    renderWithProviders(<ProgramAsCoursePage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })

  test("Renders Modules section with course titles (single root)", async () => {
    const course1Id = faker.number.int()
    const course2Id = faker.number.int()
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({ operator: "all_of", title: "All Modules" })
    op.addCourse({ course: course1Id })
    op.addCourse({ course: course2Id })

    const program = makeProgram({
      display_mode: DisplayModeEnum.Course,
      req_tree: reqTree.serialize(),
      requirements: {
        courses: {
          required: [
            { id: course1Id, readable_id: faker.lorem.slug() },
            { id: course2Id, readable_id: faker.lorem.slug() },
          ],
          electives: [],
        },
        programs: { required: [], electives: [] },
      },
    })
    const page = makePage({ program_details: program })
    const { courses } = setupApis({ program, page })

    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )

    await screen.findByRole("heading", { name: "Modules" })
    expect(screen.getByText("This course has 2 modules")).toBeInTheDocument()

    // Course titles should be shown
    await waitFor(() => {
      courses.forEach((course) => {
        expect(screen.getByText(course.title)).toBeInTheDocument()
      })
    })

    // No h3 subsection headings within Modules section (flat list, single root)
    const modulesSection = screen.getByRole("region", { name: "Modules" })
    expect(
      within(modulesSection).queryByRole("heading", { level: 3 }),
    ).not.toBeInTheDocument()
  })

  test("Renders Modules subsections as fallback when multiple roots", async () => {
    jest.spyOn(console, "warn").mockImplementation()
    const reqTree = new RequirementTreeBuilder()
    const op1 = reqTree.addOperator({
      operator: "all_of",
      title: "Core Modules",
    })
    op1.addCourse({ course: faker.number.int() })
    const op2 = reqTree.addOperator({
      operator: "all_of",
      title: "Advanced Modules",
    })
    op2.addCourse({ course: faker.number.int() })

    const serialized = reqTree.serialize()
    const allCourseIds = serialized.flatMap((node) =>
      (node.children ?? [])
        .map((c) => c.data.course)
        .filter((id): id is number => typeof id === "number"),
    )

    const program = makeProgram({
      display_mode: DisplayModeEnum.Course,
      req_tree: serialized,
      requirements: {
        courses: {
          required: allCourseIds.map((id) => ({
            id,
            readable_id: faker.lorem.slug(),
          })),
          electives: [],
        },
        programs: { required: [], electives: [] },
      },
    })
    const page = makePage({ program_details: program })
    const { courses } = setupApis({ program, page })

    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )

    await screen.findByRole("heading", { name: "Modules" })

    // Subsection h3 headings from req titles
    await screen.findByRole("heading", { name: "Core Modules" })
    await screen.findByRole("heading", { name: "Advanced Modules" })

    // Course titles should be shown within subsections
    await waitFor(() => {
      courses.forEach((course) => {
        expect(screen.getByText(course.title)).toBeInTheDocument()
      })
    })
  })
})
