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
} from "@mitodl/mitxonline-api-axios/v2"
import { renderWithProviders, waitFor, screen, within } from "@/test-utils"
import ProgramPage from "./ProgramPage"
import { HeadingIds } from "./util"
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"

import { useFeatureFlagEnabled } from "posthog-js/react"
import invariant from "tiny-invariant"
import { ResourceTypeEnum } from "api"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeProgram = factories.programs.program
const makePage = factories.pages.programPageItem
const makeResource = learnFactories.learningResources.program
const programResourcesUrl = (readable: string) =>
  learnUrls.learningResources.list({
    readable_id: [readable],
    resource_type: [ResourceTypeEnum.Program],
  })

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
}) => {
  setMockResponse.get(
    urls.programs.programsList({ readable_id: program.readable_id }),
    { results: [program] },
  )

  setMockResponse.get(urls.pages.programPages(program.readable_id), {
    items: [page],
  })

  const resource = makeResource({
    id: program.id,
    readable_id: program.readable_id,
  })
  setMockResponse.get(programResourcesUrl(program.readable_id), {
    results: [resource],
  })
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

      const program = makeProgram()
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
    const program = makeProgram()
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    await waitFor(
      () => {
        assertHeadings([
          { level: 1, name: page.title },
          { level: 2, name: "Program summary" },
          { level: 2, name: "About this Program" },
          { level: 2, name: "What you'll learn" },
          { level: 2, name: "Prerequisites" },
          { level: 2, name: "Meet your instructors" },
          { level: 2, name: "Who can take this Program?" },
        ])
      },
      { timeout: 3000 },
    )
  })

  test("Page Navigation", async () => {
    const program = makeProgram()
    const page = makePage({ program_details: program })
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)

    const nav = await screen.findByRole("navigation", {
      name: "Program Details",
    })
    const links = within(nav).getAllByRole("link")

    expect(links[0]).toHaveTextContent("About")
    expect(links[0]).toHaveAttribute("href", `#${HeadingIds.About}`)
    expect(links[1]).toHaveTextContent("What you'll learn")
    expect(links[1]).toHaveAttribute("href", `#${HeadingIds.What}`)
    expect(links[2]).toHaveTextContent("Prerequisites")
    expect(links[2]).toHaveAttribute("href", `#${HeadingIds.Prereqs}`)
    expect(links[3]).toHaveTextContent("Instructors")
    expect(links[3]).toHaveAttribute("href", `#${HeadingIds.Instructors}`)

    const headings = screen.getAllByRole("heading")
    Object.values(HeadingIds).forEach((id) => {
      expect(headings.find((h) => h.id === id)).toBeVisible()
    })
  })

  // Collasping sections tested in AboutSection.test.tsx
  test("About section has expected content", async () => {
    const program = makeProgram()
    const page = makePage({ program_details: program })
    invariant(page.about)
    setupApis({ program, page })
    renderWithProviders(<ProgramPage readableId={program.readable_id} />)
    const section = await screen.findByRole("region", {
      name: "About this Program",
    })
    expectRawContent(section, page.about)
  })

  // Dialog tested in InstructorsSection.test.tsx
  test("Instructors section has expected content", async () => {
    const program = makeProgram()
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
    { courses: [], pages: [makePage()], resources: [makeResource()] },
    { courses: [makeProgram()], pages: [], resources: [makeResource()] },
    { courses: [makeProgram()], pages: [makePage()], resources: [] },
  ])(
    "Returns 404 if no program found",
    async ({ courses, pages, resources }) => {
      setMockResponse.get(
        urls.programs.programsList({ readable_id: "readable_id" }),
        { results: courses },
      )
      setMockResponse.get(urls.pages.programPages("readable_id"), {
        items: pages,
      })

      //
      setMockResponse.get(programResourcesUrl("readable_id"), {
        results: resources,
      })

      renderWithProviders(<ProgramPage readableId="readable_id" />)
      await waitFor(() => {
        expect(notFound).toHaveBeenCalled()
      })
    },
  )
})
