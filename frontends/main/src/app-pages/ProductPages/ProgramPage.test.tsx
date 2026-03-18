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
  V2Program,
  V2ProgramDetail,
  ProgramPageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { renderWithProviders, waitFor, screen, within } from "@/test-utils"
import ProgramPage from "./ProgramPage"
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"

import { useFeatureFlagEnabled } from "posthog-js/react"
import invariant from "tiny-invariant"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { getIdsFromReqTree } from "@/common/mitxonline"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeProgram = factories.programs.program
const makePage = factories.pages.programPageItem

type ReqSection = {
  title: string
} & (
  | { operator: "all_of"; courseCount: number; programCount?: number }
  | {
      operator: "min_number_of"
      required: number
      outOf: number
      programCount?: number
    }
)

const makeReqs = ({
  required = { count: 0, title: "Required Courses" },
  electives = { count: 0, outOf: 0, title: "Elective Courses" },
}: {
  required?: { count: number; title: string }
  electives?: { count: number; outOf: number; title: string }
} = {}): Pick<V2Program, "requirements" | "req_tree"> => {
  const sections: ReqSection[] = []
  if (required.count) {
    sections.push({
      operator: "all_of",
      courseCount: required.count,
      title: required.title,
    })
  }
  if (electives.count) {
    sections.push({
      operator: "min_number_of",
      required: electives.count,
      outOf: electives.outOf,
      title: electives.title,
    })
  }
  return makeReqsFromSections(sections)
}

const makeReqsFromSections = (
  sections: ReqSection[],
): Pick<V2Program, "requirements" | "req_tree"> => {
  const reqTree = new RequirementTreeBuilder()
  const allCourses: { id: number; readableId: string }[] = []

  const addCourses = (node: RequirementTreeBuilder, count: number) => {
    Array.from({ length: count }).forEach(() => {
      const id = faker.number.int()
      allCourses.push({ id, readableId: faker.lorem.slug() })
      node.addCourse({ course: id })
    })
  }

  sections.forEach((section) => {
    if (section.operator === "all_of") {
      const op = reqTree.addOperator({
        operator: "all_of",
        title: section.title,
      })
      addCourses(op, section.courseCount)
      if (section.programCount) {
        Array.from({ length: section.programCount }).forEach(() => {
          op.addProgram()
        })
      }
    } else {
      const op = reqTree.addOperator({
        operator: "min_number_of",
        operator_value: String(section.required),
        title: section.title,
      })
      addCourses(op, section.outOf)
      if (section.programCount) {
        Array.from({ length: section.programCount }).forEach(() => {
          op.addProgram()
        })
      }
    }
  })

  const requirements: V2Program["requirements"] = {
    courses: {
      required: allCourses.map((c) => ({
        id: c.id,
        readable_id: c.readableId,
      })),
      electives: [],
    },
  }

  return { requirements, req_tree: reqTree.serialize() }
}

const expectRawContent = (el: HTMLElement, htmlString: string) => {
  const raw = within(el).getByTestId("raw")
  expect(htmlString.length).toBeGreaterThan(0)
  expect(raw.innerHTML).toBe(htmlString)
}

const setupApis = ({
  program,
  page,
  childProgramOverrides,
}: {
  program: V2Program
  page: ProgramPageItem
  childProgramOverrides?: Partial<V2ProgramDetail>
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
        id: courses.map((course) => course.id),
        page_size: courses.length,
      }),
      { results: courses },
    )
  }

  const childPrograms: V2ProgramDetail[] = programIds.map((id) =>
    factories.programs.program({ id, ...childProgramOverrides }),
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

  setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])

  return { courses, childPrograms }
}

describe("ProgramPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
  })

  test.each([
    { flagsLoaded: true, isEnabled: true, shouldNotFound: false },
    { flagsLoaded: true, isEnabled: false, shouldNotFound: true },
    { flagsLoaded: false, isEnabled: true, shouldNotFound: false },
    { flagsLoaded: false, isEnabled: false, shouldNotFound: false },
  ])(
    "Calls notFound if and only if the feature flag is disabled",
    async ({ flagsLoaded, isEnabled, shouldNotFound }) => {
      mockedUseFeatureFlagEnabled.mockReturnValue(isEnabled)
      mockedUseFeatureFlagsLoaded.mockReturnValue(flagsLoaded)

      const program = makeProgram({ ...makeReqs() })
      const page = makePage({ program_details: program })
      setupApis({ program, page })
      renderWithProviders(<ProgramPage readableId={program.readable_id} />, {
        url: `/programs/${program.readable_id}/`,
      })

      if (shouldNotFound) {
        expect(notFound).toHaveBeenCalled()
      } else {
        expect(notFound).not.toHaveBeenCalled()
      }
    },
  )

  test("Page has expected headings", async () => {
    const program = makeProgram({
      ...makeReqs({
        required: { count: 3, title: "Core Dog Courses" },
        electives: { count: 2, outOf: 4, title: "Elective Cat Courses" },
      }),
    })
    const page = makePage({ program_details: program })
    invariant(page.faculty.length > 0)
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    await waitFor(
      () => {
        assertHeadings(
          [
            { level: 1, name: page.title },
            { level: 2, name: "Program Information" },
            { level: 2, name: "About this Program" },
            { level: 2, name: "Courses" },
            { level: 3, name: "Core Dog Courses" },
            { level: 3, name: "Elective Cat Courses: Complete 2 out of 4" },
            { level: 2, name: "What you'll learn" },
            { level: 2, name: "How you'll learn" },
            { level: 2, name: "Prerequisites" },
            { level: 2, name: "Meet your instructors" },
            { level: 3, name: page.faculty[0].instructor_name },
            { level: 2, name: "Who can take this Program?" },
          ],
          { maxLevel: 3 },
        )
      },
      { timeout: 3000 },
    )
  })

  // Collapsing sections tested in AboutSection.test.tsx
  test("About section has expected content", async () => {
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({ program_details: program })
    invariant(page.about)
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)
    const section = await screen.findByRole("region", {
      name: "About this Program",
    })
    expectRawContent(section, page.about)
  })

  test.each([
    { required: 3, electives: 2, showRequired: true, showElectives: true },
    { required: 3, electives: 0, showRequired: true, showElectives: false },
    // the next cases don't really make sense... All programs should have required courses
    { required: 0, electives: 2, showRequired: false, showElectives: true },
    { required: 0, electives: 0, showRequired: false, showElectives: false },
  ])(
    "Renders required course and elective subsections appropriately (Required: $required, Electives: $electives)",
    async ({ required, electives, showRequired, showElectives }) => {
      const titles = {
        required: faker.lorem.words(3),
        elective: faker.lorem.words(3),
      }
      const program = makeProgram({
        ...makeReqs({
          required: { count: required, title: titles.required },
          electives: {
            count: electives,
            outOf: 2 * electives,
            title: titles.elective,
          },
        }),
      })
      const page = makePage({ program_details: program })
      setupApis({ program, page })
      renderWithProviders(<ProgramPage readableId={program.readable_id} />)
      const section = await screen.findByRole("region", { name: "Courses" })
      const requiredHeading = within(section).queryByRole("heading", {
        name: `${titles.required}`,
      })
      const electiveHeading = within(section).queryByRole("heading", {
        name: `${titles.elective}: Complete ${electives} out of ${2 * electives}`,
      })

      expect(!!requiredHeading).toBe(showRequired)
      expect(!!electiveHeading).toBe(showElectives)
    },
  )

  test("Renders requirements section correctly", async () => {
    const numReq = faker.number.int({ min: 2, max: 5 })
    const numElective = faker.number.int({ min: 2, max: 3 })
    const numOutOf = faker.number.int({
      min: numElective + 1,
      max: numElective + 3,
    })
    const titles = {
      required: faker.lorem.words(3),
      elective: faker.lorem.words(3),
    }
    const program = makeProgram({
      ...makeReqs({
        required: { count: numReq, title: titles.required },
        electives: {
          count: numElective,
          outOf: numOutOf,
          title: titles.elective,
        },
      }),
    })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const section = await screen.findByRole("region", { name: "Courses" })
    within(section).getByText(
      `To complete this program, you must take ${numReq} required courses and ${numElective} elective courses.`,
    )
    within(section).getByRole("heading", { name: `${titles.required}` })
    within(section).getByRole("heading", {
      name: `${titles.elective}: Complete ${numElective} out of ${numOutOf}`,
    })
    const [reqList, electiveList] = within(section).getAllByRole("list")

    await waitFor(() => {
      expect(within(reqList).getAllByRole("listitem").length).toBe(numReq)
    })
    await waitFor(() => {
      expect(within(electiveList).getAllByRole("listitem").length).toBe(
        numOutOf,
      )
    })

    const allLists = within(section).getAllByRole("list")
    allLists.forEach((list) => {
      within(list)
        .getAllByRole("listitem")
        .forEach((item) => {
          const links = within(item).getAllByRole("link")
          expect(links.length).toBeGreaterThanOrEqual(1)
        })
    })
  })

  test("Renders multiple elective sections", async () => {
    const sections: ReqSection[] = [
      { operator: "all_of", courseCount: 2, title: "Core Courses" },
      {
        operator: "min_number_of",
        required: 1,
        outOf: 3,
        title: "Biophysics Electives",
      },
      {
        operator: "min_number_of",
        required: 2,
        outOf: 4,
        title: "Philosophy Electives",
      },
    ]
    const program = makeProgram({ ...makeReqsFromSections(sections) })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const section = await screen.findByRole("region", { name: "Courses" })

    within(section).getByRole("heading", { name: "Core Courses" })
    within(section).getByRole("heading", {
      name: "Biophysics Electives: Complete 1 out of 3",
    })
    within(section).getByRole("heading", {
      name: "Philosophy Electives: Complete 2 out of 4",
    })

    const lists = within(section).getAllByRole("list")
    expect(lists).toHaveLength(3)

    await waitFor(() => {
      expect(within(lists[0]).getAllByRole("listitem").length).toBe(2)
    })
    await waitFor(() => {
      expect(within(lists[1]).getAllByRole("listitem").length).toBe(3)
    })
    await waitFor(() => {
      expect(within(lists[2]).getAllByRole("listitem").length).toBe(4)
    })
  })

  test("Renders a mixed requirement section with courses and programs", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    op.addCourse()
    op.addProgram()
    op.addCourse()

    const program = makeProgram({ req_tree: reqTree.serialize() })
    const page = makePage({ program_details: program })
    const { courses, childPrograms } = setupApis({ program, page })

    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const section = await screen.findByRole("region", { name: "Courses" })
    const list = within(section).getByRole("list")

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    })

    courses.forEach((course) => {
      const link = within(list).getByRole("link", {
        name: new RegExp(course.title),
      })
      expect(link).toHaveAttribute("href", `/courses/${course.readable_id}`)
    })

    childPrograms.forEach((prog) => {
      within(list).getByRole("link", { name: new RegExp(prog.title) })
    })
  })

  test("Links child program to /courses/p/ when display_mode is course", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    op.addProgram()

    const program = makeProgram({ req_tree: reqTree.serialize() })
    const page = makePage({ program_details: program })
    const { childPrograms } = setupApis({
      program,
      page,
      childProgramOverrides: { display_mode: DisplayModeEnum.Course },
    })

    renderWithProviders(<ProgramPage readableId={program.readable_id} />)
    const section = await screen.findByRole("region", { name: "Courses" })

    await waitFor(() => {
      const link = within(section).getByRole("link", {
        name: new RegExp(childPrograms[0].title),
      })
      expect(link).toHaveAttribute(
        "href",
        `/courses/p/${childPrograms[0].readable_id}`,
      )
    })
  })

  test("Links child program to /programs/ when display_mode is null", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    op.addProgram()

    const program = makeProgram({ req_tree: reqTree.serialize() })
    const page = makePage({ program_details: program })
    const { childPrograms } = setupApis({ program, page })

    renderWithProviders(<ProgramPage readableId={program.readable_id} />)
    const section = await screen.findByRole("region", { name: "Courses" })

    await waitFor(() => {
      const link = within(section).getByRole("link", {
        name: new RegExp(childPrograms[0].title),
      })
      expect(link).toHaveAttribute(
        "href",
        `/programs/${childPrograms[0].readable_id}`,
      )
    })
  })

  test("Completion text uses 'programs' when only program children exist", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    op.addProgram()
    op.addProgram()

    const program = makeProgram({ req_tree: reqTree.serialize() })
    const page = makePage({ program_details: program })
    setupApis({ program, page })

    renderWithProviders(<ProgramPage readableId={program.readable_id} />)
    const section = await screen.findByRole("region", { name: "Courses" })
    await waitFor(() => {
      within(section).getByText(/2 required programs/)
    })
  })

  test("Completion text uses 'courses/programs' when mixed", async () => {
    const reqTree = new RequirementTreeBuilder()
    const op = reqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    op.addCourse()
    op.addProgram()

    const program = makeProgram({ req_tree: reqTree.serialize() })
    const page = makePage({ program_details: program })
    setupApis({ program, page })

    renderWithProviders(<ProgramPage readableId={program.readable_id} />)
    const section = await screen.findByRole("region", { name: "Courses" })
    await waitFor(() => {
      within(section).getByText(/2 required courses\/programs/)
    })
  })

  // Interaction and active content are tested in InstructorsSection.test.tsx
  test("Instructors section has expected content", async () => {
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({ program_details: program })
    invariant(page.faculty.length > 0)
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Meet your instructors",
    })
    const buttons = page.faculty.map((faculty) =>
      within(section).getByRole("button", { name: faculty.instructor_name }),
    )
    expect(buttons.length).toBe(page.faculty.length)
  })

  test("Renders an enrollment button", async () => {
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const buttons = await screen.findAllByRole("button", {
      name: /enroll/i,
    })
    expect(buttons.length).toBeGreaterThan(0)
  })

  test("Shows a YouTube video in the sidebar when video_url is a YouTube URL", async () => {
    const videoId = "abc123"
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({
      program_details: program,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
    })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    await screen.findByRole("heading", { name: page.title })
    const iframe = document.querySelector(
      `iframe[src="https://www.youtube.com/embed/${videoId}"]`,
    )
    expect(iframe).toBeInTheDocument()
  })

  test("Shows an image in the sidebar when video_url is null", async () => {
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({ program_details: program, video_url: null })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    await screen.findByRole("heading", { name: page.title })
    expect(
      document.querySelector("iframe[src*='youtube.com/embed']"),
    ).not.toBeInTheDocument()
    expect(document.querySelector("img")).toBeInTheDocument()
  })

  test("Uses DEFAULT_RESOURCE_IMG when feature_image_src is falsy", async () => {
    const program = makeProgram({
      ...makeReqs(),
      page: { feature_image_src: "" },
    })
    const page = makePage({ program_details: program, video_url: null })
    setupApis({ program, page })
    const { view } = renderWithProviders(
      <ProgramPage readableId={program.readable_id} />,
    )

    await screen.findByRole("heading", { name: page.title })
    const imgs = Array.from(view.container.querySelectorAll("img"))
    expect(imgs.some((img) => img.src.includes("default_resource"))).toBe(true)
  })

  test.each([
    { programs: [], pages: [makePage()] },
    {
      programs: [makeProgram({ ...makeReqs() })],
      pages: [],
    },
  ])("Returns 404 if no program found", async ({ programs, pages }) => {
    setMockResponse.get(
      urls.programs.programsList({ readable_id: "readable_id" }),
      { results: programs },
    )
    setMockResponse.get(urls.pages.programPages("readable_id"), {
      items: pages,
    })

    renderWithProviders(<ProgramPage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })
})
