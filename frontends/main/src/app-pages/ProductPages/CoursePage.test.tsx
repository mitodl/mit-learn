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
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"
import { useStayUpdatedEnv } from "./test-utils/stayUpdated"

import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import invariant from "tiny-invariant"
import { getOutlineCoursewareId } from "./util"

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
  const outlineCoursewareId = getOutlineCoursewareId(course)
  if (outlineCoursewareId) {
    setMockResponse.get(urls.courses.courseOutline(outlineCoursewareId), {
      course_id: course.readable_id,
      generated_at: new Date().toISOString(),
      modules: [
        {
          id: "m1",
          title: "Introduction",
          effort_time: 540,
          effort_activities: 0,
          counts: {
            videos: 30,
            readings: 2,
            problems: 0,
            assignments: 1,
            app_items: 0,
          },
        },
        {
          id: "m2",
          title: "Core concepts",
          effort_time: 60,
          effort_activities: 0,
          counts: {
            videos: 0,
            readings: 0,
            problems: 0,
            assignments: 0,
            app_items: 0,
          },
        },
      ],
    })
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
    invariant(page.faculty.length > 0)
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    await waitFor(() => {
      assertHeadings([
        { level: 1, name: page.title },
        { level: 2, name: "Course Information" },
        { level: 2, name: "About this Course" },
        { level: 2, name: "What you'll learn" },
        { level: 2, name: "Course content" },
        { level: 2, name: "How you'll learn" },
        { level: 2, name: "Prerequisites" },
        { level: 2, name: "Meet your instructors" },
        { level: 3, name: page.faculty[0].instructor_name },
      ])
    })
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

  // Interaction and active content are tested in InstructorsSection.test.tsx
  test("Instructors section has expected content", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    invariant(page.faculty.length > 0)
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Meet your instructors",
    })
    const buttons = page.faculty.map((faculty) =>
      within(section).getByRole("button", { name: faculty.instructor_name }),
    )
    expect(buttons.length).toBe(page.faculty.length)
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

  test("Course content section renders lecture titles", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Course content",
    })
    expect(within(section).getByText("Introduction")).toBeInTheDocument()
    expect(within(section).getByText("Core concepts")).toBeInTheDocument()
  })

  test("Course content section shows metadata inline", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const section = await screen.findByRole("region", {
      name: "Course content",
    })
    expect(
      within(section).getByText(
        "Less than 1 hour to complete . 30 Videos . 2 Readings . 1 Assignment",
      ),
    ).toBeInTheDocument()
    expect(
      within(section).getByText((content) =>
        /^(Less than 1 hour to complete \. )?0 Videos \. 0 Readings \. 0 Assignments$/.test(
          content,
        ),
      ),
    ).toBeInTheDocument()
    expect(
      within(section).queryByRole("button", { name: /Introduction/i }),
    ).not.toBeInTheDocument()
  })

  test("Renders program bundle upsell when course belongs to a program (content tested in ProgramBundleUpsell.test)", async () => {
    const baseProgram = factories.programs.baseProgram()
    const programDetail = factories.programs.program({
      id: baseProgram.id,
      readable_id: baseProgram.readable_id,
      products: [factories.courses.product({ price: "500" })],
    })
    const course = makeCourse({ programs: [baseProgram] })
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    setMockResponse.get(urls.programs.programsList({ id: [baseProgram.id] }), {
      results: [programDetail],
    })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    expect(
      await screen.findByTestId("program-bundle-upsell"),
    ).toBeInTheDocument()
  })

  test("Renders an enrollment button", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    const buttons = await screen.findAllByTestId("course-enrollment-button")
    expect(buttons.length).toBeGreaterThan(0)
  })

  test("Shows a YouTube video in the sidebar when video_url is a YouTube URL", async () => {
    const course = makeCourse()
    const videoId = "abc123"
    const page = makePage({
      course_details: course,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
    })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    await screen.findByRole("heading", { name: page.title })
    const iframe = document.querySelector(
      `iframe[src="https://www.youtube.com/embed/${videoId}"]`,
    )
    expect(iframe).toBeInTheDocument()
  })

  test("Shows an image in the sidebar when video_url is null", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course, video_url: null })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    await screen.findByRole("heading", { name: page.title })
    expect(
      document.querySelector("iframe[src*='youtube.com/embed']"),
    ).not.toBeInTheDocument()
    expect(document.querySelector("img")).toBeInTheDocument()
  })

  test("Uses DEFAULT_RESOURCE_IMG when feature_image_src is falsy", async () => {
    const course = makeCourse({
      page: { feature_image_src: "" },
    })
    const page = makePage({ course_details: course, video_url: null })
    setupApis({ course, page })
    const { view } = renderWithProviders(
      <CoursePage readableId={course.readable_id} />,
    )

    await screen.findByRole("heading", { name: page.title })
    const imgs = Array.from(view.container.querySelectorAll("img"))
    expect(imgs.some((img) => img.src.includes("default_resource"))).toBe(true)
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
    if (courses.length > 0) {
      const outlineCoursewareId = getOutlineCoursewareId(courses[0])
      if (outlineCoursewareId) {
        setMockResponse.get(urls.courses.courseOutline(outlineCoursewareId), {
          course_id: courses[0].readable_id,
          generated_at: new Date().toISOString(),
          modules: [],
        })
      }
    }
    setMockResponse.get(urls.pages.coursePages("readable_id"), {
      items: pages,
    })

    renderWithProviders(<CoursePage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })

  describe("Stay Updated button", () => {
    useStayUpdatedEnv()

    test("Shows button when all course runs have only the verified enrollment mode", async () => {
      const verifiedMode = factories.courses.enrollmentMode({
        mode_slug: "verified",
      })
      const course = makeCourse({
        courseruns: [
          factories.courses.courseRun({ enrollment_modes: [verifiedMode] }),
          factories.courses.courseRun({ enrollment_modes: [verifiedMode] }),
        ],
      })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      expect(
        await screen.findByRole("button", { name: "Stay Updated" }),
      ).toBeInTheDocument()
    })

    test.each([
      {
        label: "one run has a non-verified mode",
        buildRuns: () => [
          factories.courses.courseRun({
            enrollment_modes: [
              factories.courses.enrollmentMode({ mode_slug: "verified" }),
            ],
          }),
          factories.courses.courseRun({
            enrollment_modes: [
              factories.courses.enrollmentMode({ mode_slug: "audit" }),
            ],
          }),
        ],
      },
      {
        label: "a run has mixed verified and non-verified modes",
        buildRuns: () => [
          factories.courses.courseRun({
            enrollment_modes: [
              factories.courses.enrollmentMode({ mode_slug: "verified" }),
              factories.courses.enrollmentMode({ mode_slug: "audit" }),
            ],
          }),
        ],
      },
      {
        label: "a run has no enrollment modes",
        buildRuns: () => [
          factories.courses.courseRun({ enrollment_modes: [] }),
        ],
      },
      {
        label: "the course has no runs",
        buildRuns: () => [],
      },
    ])("Hides button when $label", async ({ buildRuns }) => {
      const course = makeCourse({ courseruns: buildRuns() })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      await screen.findByRole("heading", { name: page.title })
      expect(
        screen.queryByRole("button", { name: "Stay Updated" }),
      ).not.toBeInTheDocument()
    })

    test("Hides button when Stay Updated form ID is not configured", async () => {
      delete process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID
      const verifiedMode = factories.courses.enrollmentMode({
        mode_slug: "verified",
      })
      const course = makeCourse({
        courseruns: [
          factories.courses.courseRun({ enrollment_modes: [verifiedMode] }),
        ],
      })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      await screen.findByRole("heading", { name: page.title })
      expect(
        screen.queryByRole("button", { name: "Stay Updated" }),
      ).not.toBeInTheDocument()
    })
  })
})
