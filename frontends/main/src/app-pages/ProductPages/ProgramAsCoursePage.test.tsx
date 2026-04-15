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
import { assertHeadings } from "ol-test-utilities"
import ProgramAsCoursePage from "./ProgramAsCoursePage"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import {
  useStayUpdatedEnv,
  PROGRAM_HIDE_STAY_UPDATED_CASES,
} from "./test-utils/stayUpdated"
import invariant from "tiny-invariant"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { getIdsFromReqTree } from "@/common/mitxonline"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeProgramAsCourse: typeof factories.programs.program = (
  overrides = {},
) =>
  factories.programs.program({
    display_mode: DisplayModeEnum.Course,
    ...overrides,
  })
const makePage = factories.pages.programPageItem

const setupApis = ({
  program,
  page,
}: {
  program: V2ProgramDetail
  page: ProgramPageItem
}): {
  courses: CourseWithCourseRunsSerializerV2[]
  childPrograms: V2ProgramDetail[]
} => {
  setMockResponse.get(
    urls.programs.programsList({ readable_id: program.readable_id }),
    { results: [program] },
  )
  setMockResponse.get(urls.pages.programPages(program.readable_id), {
    items: [page],
  })

  const { courseIds, programIds } = getIdsFromReqTree(program.req_tree)
  const courses: CourseWithCourseRunsSerializerV2[] = courseIds.map((id) =>
    factories.courses.course({ id }),
  )

  if (courseIds.length > 0) {
    setMockResponse.get(
      urls.courses.coursesList({
        id: courses.map((c) => c.id),
        page_size: courses.length,
      }),
      { results: courses },
    )
  }

  const childPrograms: V2ProgramDetail[] = programIds.map((id) =>
    factories.programs.program({ id }),
  )

  if (programIds.length > 0) {
    setMockResponse.get(
      urls.programs.programsList({
        id: programIds,
        page_size: programIds.length,
      }),
      { results: childPrograms },
    )
  }

  setMockResponse.get(
    learnUrls.userMe.get(),
    learnFactories.user.user({ is_authenticated: false }),
  )
  const stayUpdatedFormId =
    process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID?.trim()
  if (stayUpdatedFormId) {
    setMockResponse.get(
      learnUrls.hubspot.details({ form_id: stayUpdatedFormId }),
      learnFactories.hubspot.form({
        id: stayUpdatedFormId,
        name: "Stay Updated",
      }),
    )
  }
  setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])

  return { courses, childPrograms }
}

describe("ProgramAsCoursePage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  test("Page has expected headings", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({ operator: "all_of" })
    op.addCourse()
    op.addCourse()

    const program = makeProgramAsCourse({
      req_tree: reqTree.serialize(),
    })
    const page = makePage({ program_details: program })
    invariant(page.faculty.length > 0)
    setupApis({ program, page })
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )

    await waitFor(() => {
      assertHeadings([
        { level: 1, name: page.title },
        { level: 2, name: "Course Information" },
        { level: 2, name: "About this Course" },
        { level: 2, name: "What you'll learn" },
        { level: 2, name: "Modules" },
        { level: 2, name: "How you'll learn" },
        { level: 2, name: "Prerequisites" },
        { level: 2, name: "Meet your instructors" },
        { level: 3, name: page.faculty[0].instructor_name },
      ])
    })
  })

  test("Renders an enrollment button", async () => {
    const program = makeProgramAsCourse({
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
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({ operator: "all_of", title: "All Modules" })
    op.addCourse()
    op.addCourse()

    const program = makeProgramAsCourse({
      req_tree: reqTree.serialize(),
    })
    const page = makePage({ program_details: program })
    const { courses } = setupApis({ program, page })

    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )

    await screen.findByRole("heading", { name: "Modules" })
    expect(screen.getByText("This course has 2 modules")).toBeInTheDocument()

    // Course titles should be shown (findBy first, then getBy for the rest since
    // all items render together when dataLoading transitions to false)
    await screen.findByText(courses[0].title)
    courses.slice(1).forEach((course) => {
      expect(screen.getByText(course.title)).toBeInTheDocument()
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
    op1.addCourse()
    const op2 = reqTree.addOperator({
      operator: "all_of",
      title: "Advanced Modules",
    })
    op2.addCourse()

    const program = makeProgramAsCourse({
      req_tree: reqTree.serialize(),
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
    await screen.findByText(courses[0].title)
    courses.slice(1).forEach((course) => {
      expect(screen.getByText(course.title)).toBeInTheDocument()
    })
  })

  test("Renders program bundle upsell when program belongs to a parent program (content tested in ProgramBundleUpsell.test)", async () => {
    const parentProgram = factories.programs.baseProgram()
    const parentProgramDetail = factories.programs.program({
      id: parentProgram.id,
      readable_id: parentProgram.readable_id,
      products: [factories.courses.product({ price: "500" })],
    })
    const program = makeProgramAsCourse({ programs: [parentProgram] })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    setMockResponse.get(
      urls.programs.programsList({ id: [parentProgram.id] }),
      { results: [parentProgramDetail] },
    )
    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )

    expect(
      await screen.findByTestId("program-bundle-upsell"),
    ).toBeInTheDocument()
  })

  test("Renders Modules section with mixed courses and programs (single root)", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({ operator: "all_of" })
    op.addCourse()
    op.addProgram()
    op.addCourse()

    const program = makeProgramAsCourse({ req_tree: reqTree.serialize() })
    const page = makePage({ program_details: program })
    const { courses, childPrograms } = setupApis({ program, page })

    renderWithProviders(
      <ProgramAsCoursePage readableId={program.readable_id} />,
    )

    const modulesSection = await screen.findByRole("region", {
      name: "Modules",
    })
    expect(
      within(modulesSection).getByText("This course has 3 modules"),
    ).toBeInTheDocument()

    // Verify interleaved order: c1, p1, c2 (matches tree insertion order)
    await within(modulesSection).findByText(courses[0].title)
    const listItems = within(modulesSection).getAllByRole("listitem")
    expect(listItems).toHaveLength(3)
    expect(listItems[0]).toHaveTextContent(courses[0].title)
    expect(listItems[1]).toHaveTextContent(childPrograms[0].title)
    expect(listItems[2]).toHaveTextContent(courses[1].title)
  })

  describe("Stay Updated button", () => {
    useStayUpdatedEnv()

    test("Shows button when program has only the verified enrollment mode", async () => {
      const program = makeProgramAsCourse({
        enrollment_modes: [
          factories.courses.enrollmentMode({ mode_slug: "verified" }),
        ],
      })
      const page = makePage({ program_details: program })
      setupApis({ program, page })
      renderWithProviders(
        <ProgramAsCoursePage readableId={program.readable_id} />,
      )

      expect(
        await screen.findByRole("button", { name: "Stay Updated" }),
      ).toBeInTheDocument()
    })

    test.each(PROGRAM_HIDE_STAY_UPDATED_CASES)(
      "Hides button when $label",
      async ({ enrollment_modes: enrollmentModes }) => {
        const program = makeProgramAsCourse({
          enrollment_modes: enrollmentModes,
        })
        const page = makePage({ program_details: program })
        setupApis({ program, page })
        renderWithProviders(
          <ProgramAsCoursePage readableId={program.readable_id} />,
        )

        await screen.findByRole("heading", { name: page.title })
        expect(
          screen.queryByRole("button", { name: "Stay Updated" }),
        ).not.toBeInTheDocument()
      },
    )

    test("Hides button when Stay Updated form ID is not configured", async () => {
      delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
      const program = makeProgramAsCourse({
        enrollment_modes: [
          factories.courses.enrollmentMode({ mode_slug: "verified" }),
        ],
      })
      const page = makePage({ program_details: program })
      setupApis({ program, page })
      renderWithProviders(
        <ProgramAsCoursePage readableId={program.readable_id} />,
      )

      await screen.findByRole("heading", { name: page.title })
      expect(
        screen.queryByRole("button", { name: "Stay Updated" }),
      ).not.toBeInTheDocument()
    })
  })
})
