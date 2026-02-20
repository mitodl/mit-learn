import React from "react"
import { urls, factories } from "api/mitxonline-test-utils"
import type {
  CoursePageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  setMockResponse,
  urls as learnUrls,
  factories as learnFactories,
} from "api/test-utils"
import { renderWithProviders, waitFor, screen, within } from "@/test-utils"
import CoursePage from "./CoursePage"
import { HeadingIds } from "./util"
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"

import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import invariant from "tiny-invariant"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const makeCourse = factories.courses.course
const makePage = factories.pages.coursePageItem

const expectRawContent = (el: HTMLElement, htmlString: string) => {
  const raw = within(el).getByTestId("raw")
  expect(htmlString.length).toBeGreaterThan(0)
  expect(raw.innerHTML).toBe(htmlString)
}

const setupApis = ({
  course,
  page,
}: {
  course: CourseWithCourseRunsSerializerV2
  page: CoursePageItem
}) => {
  setMockResponse.get(
    urls.courses.coursesList({ readable_id: course.readable_id }),
    { results: [course] },
  )

  setMockResponse.get(urls.pages.coursePages(course.readable_id), {
    items: [page],
  })

  setMockResponse.get(
    learnUrls.userMe.get(),
    learnFactories.user.user({ is_authenticated: false }),
  )
}

describe("CoursePage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
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

      const course = makeCourse()
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />, {
        url: `/courses/${course.readable_id}/`,
      })

      if (shouldNotFound) {
        expect(notFound).toHaveBeenCalled()
      } else {
        expect(notFound).not.toHaveBeenCalled()
      }
    },
  )

  test("Page has expected headings", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    await waitFor(() => {
      assertHeadings([
        { level: 1, name: page.title },
        { level: 2, name: "Course summary" },
        { level: 2, name: "About this Course" },
        { level: 2, name: "What you'll learn" },
        { level: 2, name: "How you'll learn" },
        { level: 2, name: "Prerequisites" },
        { level: 2, name: "Meet your instructors" },
        { level: 2, name: "Who can take this Course?" },
      ])
    })
  })

  test("Page Navigation", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const nav = await screen.findByRole("navigation", {
      name: "Course Details",
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
    const course = makeCourse()
    const page = makePage({ course_details: course })
    invariant(page.about)
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "About this Course",
    })
    expectRawContent(section, page.about)
  })

  test("What You'll Learn section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    invariant(page.what_you_learn)
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "What you'll learn",
    })
    expectRawContent(section, page.what_you_learn)
  })

  // Dialog tested in InstructorsSection.test.tsx
  test("Instructors section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    invariant(page.faculty.length > 0)
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Meet your instructors",
    })
    const items = within(section).getAllByRole("listitem")
    expect(items.length).toBe(page.faculty.length)
  })

  test("Prerequisites section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    invariant(page.prerequisites)
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", { name: "Prerequisites" })
    expectRawContent(section, page.prerequisites)
  })

  test("Renders an enrollment button", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const buttons = await screen.findAllByTestId("course-enrollment-button")
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  test.each([
    { courses: [], pages: [makePage()] },
    { courses: [makeCourse()], pages: [] },
    { courses: [], pages: [] },
  ])("Returns 404 if no course found", async ({ courses, pages }) => {
    setMockResponse.get(
      urls.courses.coursesList({ readable_id: "readable_id" }),
      { results: courses },
    )
    setMockResponse.get(urls.pages.coursePages("readable_id"), {
      items: pages,
    })

    renderWithProviders(<CoursePage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })
})
