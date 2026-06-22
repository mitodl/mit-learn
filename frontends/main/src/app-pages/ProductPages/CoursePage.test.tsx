import React from "react"
import {
  urls as mitxUrls,
  factories as mitxFactories,
} from "api/mitxonline-test-utils"
import type {
  CoursePageItem,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  setMockResponse,
  urls as learnUrls,
  factories as learnFactories,
} from "api/test-utils"
import {
  renderWithProviders,
  waitFor,
  screen,
  within,
  act,
  user,
  setupLocationMock,
} from "@/test-utils"
import CoursePage from "./CoursePage"
import { assertHeadings } from "ol-test-utilities"
import { notFound } from "next/navigation"
import { useStayUpdatedEnv } from "./test-utils/stayUpdated"

import { useFeatureFlagEnabled } from "posthog-js/react"
import invariant from "tiny-invariant"
import { getOutlineCoursewareId } from "./util"
import { FeatureFlags } from "@/common/feature_flags"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
  usePostHog: jest.fn(() => ({ capture: jest.fn() })),
}))
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("@/common/analytics/gtm", () => ({
  trackCourseEnrolled: jest.fn(),
}))

const makeCourse = mitxFactories.courses.course
const makePage = mitxFactories.pages.coursePageItem

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
    mitxUrls.courses.coursesList({
      readable_id: course.readable_id,
      live: true,
    }),
    { results: [course] },
  )

  setMockResponse.get(mitxUrls.pages.coursePages(course.readable_id), {
    items: [page],
  })
  const outlineCoursewareId = getOutlineCoursewareId(course)
  if (outlineCoursewareId) {
    setMockResponse.get(mitxUrls.courses.courseOutline(outlineCoursewareId), {
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
  })

  test("Page has expected headings", async () => {
    // A non-enrollable run keeps the outline section (needs a courseware_id)
    // while making the InfoBox render no enroll-card (h3) headings, so the
    // page heading outline is deterministic. (makeCourse() otherwise
    // randomizes run enrollability, injecting card h3s and flaking this test.)
    const run = mitxFactories.courses.courseRun({ is_enrollable: false })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
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

  test("Hides course content section when course outline flag is disabled", async () => {
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) => flag !== FeatureFlags.CourseOutlineSection,
    )
    const course = makeCourse()
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    await screen.findByRole("heading", { name: page.title })
    expect(
      screen.queryByRole("region", {
        name: "Course content",
      }),
    ).not.toBeInTheDocument()
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
        /Less than 1 hour to complete\s*•\s*30 Videos\s*•\s*2 Readings\s*•\s*1 Assignment/,
      ),
    ).toBeInTheDocument()
    const coreConceptsCard = within(section)
      .getByText("Core concepts")
      .closest("article")
    expect(coreConceptsCard).toBeInTheDocument()
    expect(
      within(coreConceptsCard as HTMLElement).getByText(
        "Less than 1 hour to complete",
      ),
    ).toBeInTheDocument()
    expect(
      within(section).queryByRole("button", { name: /Introduction/i }),
    ).not.toBeInTheDocument()
  })

  test("Renders program bundle upsell when course belongs to a program (content tested in ProgramBundleUpsell.test)", async () => {
    const baseProgram = mitxFactories.programs.baseProgram()
    const programDetail = mitxFactories.programs.program({
      id: baseProgram.id,
      readable_id: baseProgram.readable_id,
      products: [mitxFactories.courses.product({ price: "500" })],
    })
    const course = makeCourse({ programs: [baseProgram] })
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    setMockResponse.get(
      mitxUrls.programs.programsList({ id: [baseProgram.id] }),
      {
        results: [programDetail],
      },
    )
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    expect(
      await screen.findByTestId("program-bundle-upsell"),
    ).toBeInTheDocument()
  })

  describe("Header enrollment button", () => {
    const freeMode = mitxFactories.courses.enrollmentMode({
      requires_payment: false,
    })
    const paidMode = mitxFactories.courses.enrollmentMode({
      requires_payment: true,
    })
    const product = mitxFactories.courses.product()

    test("both scenario: header shows Earn Certificate", async () => {
      const run = mitxFactories.courses.courseRun({
        is_enrollable: true,
        is_upgradable: true,
        is_archived: false,
        enrollment_modes: [freeMode, paidMode],
        products: [product],
      })
      const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      expect(
        (await screen.findAllByRole("button", { name: "Earn Certificate" }))
          .length,
      ).toBeGreaterThan(0)
    })

    test("freeOnly scenario: header shows Start Learning", async () => {
      const run = mitxFactories.courses.courseRun({
        is_enrollable: true,
        is_upgradable: false,
        is_archived: false,
        enrollment_modes: [freeMode],
        products: [],
      })
      const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      expect(
        (await screen.findAllByRole("button", { name: "Start Learning" }))
          .length,
      ).toBeGreaterThan(0)
    })

    test("paidOnly scenario: header shows Enroll", async () => {
      const run = mitxFactories.courses.courseRun({
        is_enrollable: true,
        is_upgradable: true,
        is_archived: false,
        enrollment_modes: [paidMode],
        products: [product],
      })
      const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      expect(
        (await screen.findAllByRole("button", { name: "Enroll" })).length,
      ).toBeGreaterThan(0)
    })

    test("none scenario: header shows disabled Enroll placeholder", async () => {
      const course = makeCourse({ courseruns: [] })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      const btn = await screen.findByRole("button", { name: "Enroll" })
      expect(btn).toBeDisabled()
    })

    test("enrolled scenario: header shows Enrolled link", async () => {
      const run = mitxFactories.courses.courseRun({
        is_enrollable: true,
        is_archived: false,
        enrollment_modes: [freeMode],
      })
      const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
      const page = makePage({ course_details: course })
      setupApis({ course, page })

      const enrollment = mitxFactories.enrollment.courseEnrollment({
        run: { id: run.id },
      })
      setMockResponse.get(
        learnUrls.userMe.get(),
        learnFactories.user.user({ is_authenticated: true }),
      )
      setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [enrollment])

      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      expect(
        (await screen.findAllByRole("link", { name: /Enrolled/ })).length,
      ).toBeGreaterThan(0)
    })

    test("header CTA tracks the run selected in the InfoBox", async () => {
      const paidRun = mitxFactories.courses.courseRun({
        is_enrollable: true,
        is_upgradable: true,
        is_archived: false,
        enrollment_modes: [paidMode],
        products: [product],
        start_date: "2026-07-15",
        end_date: "2026-10-15",
      })
      const freeRun = mitxFactories.courses.courseRun({
        is_enrollable: true,
        is_upgradable: false,
        is_archived: false,
        enrollment_modes: [freeMode],
        products: [],
        start_date: "2027-03-10",
        end_date: "2027-06-10",
      })
      const course = makeCourse({
        next_run_id: paidRun.id,
        courseruns: [paidRun, freeRun],
      })
      const page = makePage({ course_details: course })
      setupApis({ course, page })
      renderWithProviders(<CoursePage readableId={course.readable_id} />)

      const select = await screen.findByRole("combobox", { name: /Session/i })

      // Select the paid run: header + InfoBox show "Enroll", none show "Start Learning"
      await user.click(select)
      await user.click(screen.getByRole("option", { name: /Jul 15/i }))
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Start Learning" }),
        ).toBeNull()
      })
      expect(
        (await screen.findAllByRole("button", { name: "Enroll" })).length,
      ).toBeGreaterThan(0)

      // Switch to the free run: the header CTA follows — no "Enroll" remains
      await user.click(select)
      await user.click(screen.getByRole("option", { name: /Mar 10/i }))
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Enroll" })).toBeNull()
      })
      expect(
        (await screen.findAllByRole("button", { name: "Start Learning" }))
          .length,
      ).toBeGreaterThan(0)
    })

    describe("click smoke tests", () => {
      setupLocationMock()

      test("header paid button click triggers basket replace", async () => {
        const run = mitxFactories.courses.courseRun({
          is_enrollable: true,
          is_upgradable: true,
          is_archived: false,
          enrollment_modes: [paidMode],
          products: [product],
        })
        const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
        const page = makePage({ course_details: course })
        setupApis({ course, page })

        setMockResponse.get(
          learnUrls.userMe.get(),
          learnFactories.user.user({ is_authenticated: true }),
        )
        setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
        setMockResponse.delete(mitxUrls.baskets.clear(), undefined)
        setMockResponse.post(mitxUrls.baskets.createFromProduct(product.id), {
          id: 1,
          items: [],
        })

        renderWithProviders(<CoursePage readableId={course.readable_id} />)

        const enrollBtns = await screen.findAllByRole("button", {
          name: "Enroll",
        })
        await act(async () => {
          enrollBtns[0].click()
        })

        await waitFor(() => {
          expect(window.location.assign).toHaveBeenCalledWith(
            mitxonlineLegacyUrl("/cart/"),
          )
        })
      })

      test("unauthenticated header click shows signup popover", async () => {
        const run = mitxFactories.courses.courseRun({
          is_enrollable: true,
          is_upgradable: false,
          is_archived: false,
          enrollment_modes: [freeMode],
          products: [],
        })
        const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
        const page = makePage({ course_details: course })
        setupApis({ course, page })

        renderWithProviders(<CoursePage readableId={course.readable_id} />)

        const startBtns = await screen.findAllByRole("button", {
          name: "Start Learning",
        })
        await act(async () => {
          startBtns[0].click()
        })

        expect(screen.getByTestId("signup-popover")).toBeInTheDocument()
      })
    })
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
      mitxUrls.courses.coursesList({ readable_id: "readable_id", live: true }),
      { results: courses },
    )
    if (courses.length > 0) {
      const outlineCoursewareId = getOutlineCoursewareId(courses[0])
      if (outlineCoursewareId) {
        setMockResponse.get(
          mitxUrls.courses.courseOutline(outlineCoursewareId),
          {
            course_id: courses[0].readable_id,
            generated_at: new Date().toISOString(),
            modules: [],
          },
        )
      }
    }
    setMockResponse.get(mitxUrls.pages.coursePages("readable_id"), {
      items: pages,
    })

    renderWithProviders(<CoursePage readableId="readable_id" />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })

  test("Returns 404 if course has live=false", async () => {
    const course = makeCourse()
    const page = makePage({ course_details: course })
    // Simulate live=false: the API filters it out, returning empty results
    setMockResponse.get(
      mitxUrls.courses.coursesList({
        readable_id: course.readable_id,
        live: true,
      }),
      { results: [] },
    )
    setMockResponse.get(mitxUrls.pages.coursePages(course.readable_id), {
      items: [page],
    })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
  })

  describe("Stay Updated button", () => {
    useStayUpdatedEnv()

    test("Shows button when all course runs have only the verified enrollment mode", async () => {
      const verifiedMode = mitxFactories.courses.enrollmentMode({
        mode_slug: "verified",
      })
      const course = makeCourse({
        courseruns: [
          mitxFactories.courses.courseRun({ enrollment_modes: [verifiedMode] }),
          mitxFactories.courses.courseRun({ enrollment_modes: [verifiedMode] }),
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
          mitxFactories.courses.courseRun({
            enrollment_modes: [
              mitxFactories.courses.enrollmentMode({ mode_slug: "verified" }),
            ],
          }),
          mitxFactories.courses.courseRun({
            enrollment_modes: [
              mitxFactories.courses.enrollmentMode({ mode_slug: "audit" }),
            ],
          }),
        ],
      },
      {
        label: "a run has mixed verified and non-verified modes",
        buildRuns: () => [
          mitxFactories.courses.courseRun({
            enrollment_modes: [
              mitxFactories.courses.enrollmentMode({ mode_slug: "verified" }),
              mitxFactories.courses.enrollmentMode({ mode_slug: "audit" }),
            ],
          }),
        ],
      },
      {
        label: "a run has no enrollment modes",
        buildRuns: () => [
          mitxFactories.courses.courseRun({ enrollment_modes: [] }),
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
      const verifiedMode = mitxFactories.courses.enrollmentMode({
        mode_slug: "verified",
      })
      const course = makeCourse({
        courseruns: [
          mitxFactories.courses.courseRun({ enrollment_modes: [verifiedMode] }),
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

  test("Renders without crashing when course_details.page is null", async () => {
    const course = makeCourse({ page: null })
    const page = makePage({ course_details: course })
    setupApis({ course, page })
    renderWithProviders(<CoursePage readableId={course.readable_id} />)

    await screen.findByRole("heading", { name: page.title })
  })
})
