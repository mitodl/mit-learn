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
  ProgramPageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { renderWithProviders, waitFor, screen, within } from "@/test-utils"
import ProgramPage from "./ProgramPage"
import { HeadingIds } from "./util"
import { assertHeadings } from "ol-test-utilities"
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

type ReqSection = {
  title: string
} & (
  | { operator: "all_of"; courseCount: number }
  | { operator: "min_number_of"; required: number; outOf: number }
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
      addCourses(
        reqTree.addOperator({
          operator: "all_of",
          title: section.title,
        }),
        section.courseCount,
      )
    } else {
      addCourses(
        reqTree.addOperator({
          operator: "min_number_of",
          operator_value: String(section.required),
          title: section.title,
        }),
        section.outOf,
      )
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

const getCourseIdsFromReqTree = (reqTree: V2Program["req_tree"]): number[] =>
  reqTree.flatMap((node) =>
    (node.children ?? [])
      .map((child) => child.data.course)
      .filter((course): course is number => typeof course === "number"),
  )

const setupApis = ({
  program,
  page,
}: {
  program: V2Program
  page: ProgramPageItem
}): { courses: CourseWithCourseRunsSerializerV2[] } => {
  setMockResponse.get(
    urls.programs.programsList({ readable_id: program.readable_id }),
    { results: [program] },
  )

  setMockResponse.get(urls.pages.programPages(program.readable_id), {
    items: [page],
  })

  const courseIds = getCourseIdsFromReqTree(program.req_tree)
  const courses: CourseWithCourseRunsSerializerV2[] = courseIds.map((id) =>
    factories.courses.course({ id }),
  )

  setMockResponse.get(
    urls.courses.coursesList({
      id: courses.map((course) => course.id),
      page_size: courses.length,
    }),
    { results: courses },
  )

  setMockResponse.get(
    learnUrls.userMe.get(),
    learnFactories.user.user({ is_authenticated: false }),
  )

  setMockResponse.get(urls.programEnrollments.enrollmentsListV3(), [])

  return { courses }
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
    "Calls noFound if and only the feature flag is disabled",
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

  test("Includes program type in banner area", async () => {
    const program = makeProgram({
      ...makeReqs(),
      program_type: "AwesomeProgramz",
    })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const banner = await screen.findByTestId("banner-container")
    expect(within(banner).getByText("MITx")).toBeVisible()
    expect(within(banner).getByText("AwesomeProgramz")).toBeVisible()
  })

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
            { level: 2, name: "Program summary" },
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

  test("Page Navigation", async () => {
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const nav = await screen.findByRole("navigation", {
      name: "Program Details",
    })
    const links = within(nav).getAllByRole("link")

    expect(links[0]).toHaveTextContent("About")
    expect(links[0]).toHaveAttribute("href", `#${HeadingIds.About}`)
    expect(document.getElementById(HeadingIds.About)).toBeVisible()
    expect(links[1]).toHaveTextContent("What you'll learn")
    expect(links[1]).toHaveAttribute("href", `#${HeadingIds.What}`)
    expect(document.getElementById(HeadingIds.What)).toBeVisible()
    expect(links[2]).toHaveTextContent("How you'll learn")
    expect(links[2]).toHaveAttribute("href", `#${HeadingIds.How}`)
    expect(document.getElementById(HeadingIds.How)).toBeVisible()
    expect(links[3]).toHaveTextContent("Prerequisites")
    expect(links[3]).toHaveAttribute("href", `#${HeadingIds.Prereqs}`)
    expect(document.getElementById(HeadingIds.Prereqs)).toBeVisible()
    expect(links[4]).toHaveTextContent("Instructors")
    expect(links[4]).toHaveAttribute("href", `#${HeadingIds.Instructors}`)
    expect(document.getElementById(HeadingIds.Instructors)).toBeVisible()
  })

  // Collasping sections tested in AboutSection.test.tsx
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
    const { courses } = setupApis({ program, page })
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

    const courseIds = getCourseIdsFromReqTree(program.req_tree)
    const allLists = within(section).getAllByRole("list")
    allLists.forEach((list) => {
      within(list)
        .getAllByRole("listitem")
        .forEach((item) => {
          const course = courses.find((c) => courseIds.includes(c.id))
          invariant(course)
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
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  test.each([
    { courses: [], pages: [makePage()] },
    {
      courses: [makeProgram({ ...makeReqs() })],
      pages: [],
    },
  ])("Returns 404 if no program found", async ({ courses, pages }) => {
    setMockResponse.get(
      urls.programs.programsList({ readable_id: "readable_id" }),
      { results: courses },
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
