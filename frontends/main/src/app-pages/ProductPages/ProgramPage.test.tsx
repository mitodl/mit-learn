import React from "react"
import { urls, factories } from "api/mitxonline-test-utils"
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

const RequirementTreeBuilder = factories.requirements.RequirementTreeBuilder

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeProgram = factories.programs.program
const makePage = factories.pages.programPageItem

const makeReqs = ({
  required = { count: 0, title: "Required Courses" },
  electives = { count: 0, outOf: 0, title: "Elective Courses" },
}: {
  required?: { count: number; title: string }
  electives?: { count: number; outOf: number; title: string }
} = {}): Pick<V2Program, "requirements" | "req_tree"> => {
  invariant(
    electives.count <= electives.outOf,
    "Elective count must be greater than or equal to 'outOf' value (take 3 courses out of 5, etc)",
  )
  const reqTree = new RequirementTreeBuilder()

  const requirements: V2Program["requirements"] = {
    courses: {
      required: Array.from({ length: required.count }).map(() => ({
        id: faker.number.int(),
        readable_id: faker.lorem.slug(),
      })),
      electives: Array.from({ length: electives.outOf }).map(() => ({
        id: faker.number.int(),
        readable_id: faker.lorem.slug(),
      })),
    },
  }

  if (required.count) {
    const requiredNode = reqTree.addOperator({
      operator: "all_of",
      title: required.title,
    })
    requirements.courses?.required?.forEach((req) => {
      requiredNode.addCourse({ course: req.id })
    })
  }

  if (electives.count) {
    const electivesNode = reqTree.addOperator({
      operator: "min_number_of",
      operator_value: String(electives?.count ?? 0),
      title: electives.title,
    })
    requirements.courses?.electives?.forEach((req) => {
      electivesNode.addCourse({ course: req.id })
    })
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

  const courses: CourseWithCourseRunsSerializerV2[] = [
    ...(program.requirements.courses?.required ?? []),
    ...(program.requirements.courses?.electives ?? []),
  ].map((c) =>
    factories.courses.course({
      id: c.id,
      readable_id: c.readable_id,
    }),
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
            { level: 2, name: "Prerequisites" },
            { level: 2, name: "Meet your instructors" },
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
    expect(links[1]).toHaveTextContent("Courses")
    expect(links[1]).toHaveAttribute("href", `#${HeadingIds.Requirements}`)
    expect(document.getElementById(HeadingIds.What)).toBeVisible()
    expect(links[2]).toHaveTextContent("What you'll learn")
    expect(links[2]).toHaveAttribute("href", `#${HeadingIds.What}`)
    expect(document.getElementById(HeadingIds.What)).toBeVisible()
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
      min: numElective,
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

    within(reqList)
      .getAllByRole("listitem")
      .forEach((item, index) => {
        const readableId =
          program.requirements.courses?.required?.[index].readable_id
        invariant(readableId)
        const course = courses.find((c) => c.readable_id === readableId)
        invariant(course)
        const links = within(item).getAllByRole("link", {
          name: course.title,
        })
        expect(links.length).toBeGreaterThanOrEqual(1)
        expect(links[0]).toHaveAttribute(
          "href",
          `/courses/${encodeURIComponent(readableId)}`,
        )
      })

    within(electiveList)
      .getAllByRole("listitem")
      .forEach((item, index) => {
        const readableId =
          program.requirements.courses?.electives?.[index].readable_id
        invariant(readableId)
        const course = courses.find((c) => c.readable_id === readableId)
        invariant(course)
        const links = within(item).getAllByRole("link", {
          name: course.title,
        })
        expect(links.length).toBeGreaterThanOrEqual(1)
        expect(links[0]).toHaveAttribute(
          "href",
          `/courses/${encodeURIComponent(readableId)}`,
        )
      })
  })

  // Dialog tested in InstructorsSection.test.tsx
  test("Instructors section has expected content", async () => {
    const program = makeProgram({ ...makeReqs() })
    const page = makePage({ program_details: program })
    invariant(page.faculty.length > 0)
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Meet your instructors",
    })
    const items = within(section).getAllByRole("listitem")
    expect(items.length).toBe(page.faculty.length)
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
