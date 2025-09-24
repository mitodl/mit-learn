import React from "react"
import { urls, factories } from "api/mitxonline-test-utils"
import type {
  CoursePageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { setMockResponse } from "api/test-utils"
import {
  renderWithProviders,
  waitFor,
  screen,
  within,
  user,
} from "@/test-utils"
import CoursePage, { HeadingIds } from "./CoursePage"
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"

import { useFeatureFlagEnabled } from "posthog-js/react"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

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
  setMockResponse.get(urls.pages.courseDetail(course.readable_id), {
    items: [page],
  })
}

describe("CoursePage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
  })

  test.each([true, false])(
    "Calls noFound if and only the feature flag is disabled",
    async (isEnabled) => {
      mockedUseFeatureFlagEnabled.mockReturnValue(isEnabled)

      const course = makeCourse()
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />, {
        url: `/courses/${course.readable_id}/`,
      })

      if (isEnabled) {
        expect(notFound).not.toHaveBeenCalled()
      } else {
        expect(notFound).toHaveBeenCalled()
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
        { level: 2, name: "About this course" },
        { level: 2, name: "What you'll learn" },
        { level: 2, name: "Prerequisites" },
        { level: 2, name: "Meet your instructors" },
        { level: 2, name: "Who can take this course?" },
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
    expect(links[1]).toHaveTextContent("What you'll learn")
    expect(links[1]).toHaveAttribute("href", `#${HeadingIds.What}`)
    expect(links[2]).toHaveTextContent("Prerequisites")
    expect(links[2]).toHaveAttribute("href", `#${HeadingIds.Prerequisites}`)
    expect(links[3]).toHaveTextContent("Instructors")
    expect(links[3]).toHaveAttribute("href", `#${HeadingIds.Instructors}`)

    const headings = screen.getAllByRole("heading")
    Object.values(HeadingIds).forEach((id) => {
      expect(headings.find((h) => h.id === id)).toBeVisible()
    })
  })

  test("About section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "About this course",
    })
    expectRawContent(section, page.about)
  })

  test("About section expands and collapses", async () => {
    const course = makeCourse()
    const firstParagraph = "This paragraph should be initially shown."
    const secondParagraph = "This should be hidden 1."
    const thirdParagraph = "This should be hidden 2."
    const aboutContent = [firstParagraph, secondParagraph, thirdParagraph]
      .map((p) => `<p>${p}</p>`)
      .join("\n")
    const page = makePage({ course_details: course, about: aboutContent })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const about = await screen.findByRole("region", {
      name: "About this course",
    })

    const p1 = within(about).getByText(firstParagraph)
    const p2 = within(about).queryByText(secondParagraph)
    const p3 = within(about).queryByText(thirdParagraph)

    expect(p1).toBeVisible()
    expect(p2).not.toBeVisible()
    expect(p3).not.toBeVisible()

    const toggle = within(about).getByRole("button", { name: "Show more" })
    await user.click(toggle)

    expect(p1).toBeVisible()
    expect(p2).toBeVisible()
    expect(p3).toBeVisible()

    expect(toggle).toHaveTextContent("Show less")
  })

  test.each([
    { aboutParagraphs: 1, expectToggler: false },
    { aboutParagraphs: 2, expectToggler: true },
  ])(
    "Show more/less link is not shown if there is only one paragraph in the About section",
    async ({ aboutParagraphs, expectToggler }) => {
      const course = makeCourse()
      const aboutContent = Array.from(
        { length: aboutParagraphs },
        (_, i) => `<p>This is paragraph ${i + 1} in the about section.</p>`,
      ).join("\n")
      const page = makePage({ course_details: course, about: aboutContent })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />, {
        url: `/courses/${course.readable_id}/`,
      })

      const about = await screen.findByRole("region", {
        name: "About this course",
      })

      const toggler = within(about).getByRole("button", {
        hidden: true,
      })
      // Can't reliably use name matcher because accessible name isn't computed when hidden.
      expect(toggler).toHaveTextContent(/show more|show less/i)

      if (expectToggler) {
        expect(toggler).toBeVisible()
      } else {
        expect(toggler).not.toBeVisible()
      }
    },
  )

  test("What You'll Learn section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "What you'll learn",
    })
    expectRawContent(section, page.what_you_learn)
  })

  test("Prerequisites section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", { name: "Prerequisites" })
    expectRawContent(section, page.prerequisites)
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
    setMockResponse.get(urls.pages.courseDetail("readable_id"), {
      items: pages,
    })

    renderWithProviders(<CoursePage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })

  test("Instructors section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    const instructors = page.faculty
    expect(instructors.length).toBeGreaterThan(0)

    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Meet your instructors",
    })
    const instructorEls = within(section).getAllByRole("listitem")
    instructorEls.forEach((el, i) => {
      const instructor = instructors[i]
      within(el).getByRole("button", { name: instructor.instructor_name })
      within(el).getByText(instructor.instructor_title)
    })

    const instructor = faker.helpers.arrayElement(instructors)
    const button = within(section).getByRole("button", {
      name: instructor.instructor_name,
    })
    await user.click(button)

    const dialog = await screen.findByRole("dialog", {
      name: `${instructor.instructor_name}`,
    })
    within(dialog).getByRole("heading", {
      level: 2,
      name: instructor.instructor_name,
    })
    expectRawContent(dialog, instructor.instructor_bio_long)

    const closeButton = within(dialog).getByRole("button", { name: "Close" })
    await user.click(closeButton)
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument()
    })
  })
})
