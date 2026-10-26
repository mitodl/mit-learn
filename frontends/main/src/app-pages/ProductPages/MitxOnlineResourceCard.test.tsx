import React from "react"
import { screen, fireEvent } from "@testing-library/react"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import MitxOnlineResourceCard, {
  mitxOnlineCardContent,
} from "./MitxOnlineResourceCard"
import { factories } from "api/mitxonline-test-utils"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  expectProps,
  expectWindowNavigation,
  renderWithProviders,
  user,
} from "@/test-utils"
import { FeatureFlags } from "@/common/feature_flags"
import { PostHogEvents } from "@/common/constants"
import {
  ResourceCardSkeleton,
  ResourceCardView,
} from "@/page-components/ResourceCardView/ResourceCardView"
import { DEFAULT_RESOURCE_IMG, LocalDate } from "ol-utilities"
import { getByImageSrc, queryByImageSrc } from "ol-test-utilities"
import type { MitxOnlineResourceCardProps } from "./MitxOnlineResourceCard"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
  usePostHog: jest.fn(),
}))
const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

jest.mock("@/page-components/ResourceCardView/ResourceCardView", () => {
  const actual = jest.requireActual(
    "@/page-components/ResourceCardView/ResourceCardView",
  )
  return {
    __esModule: true,
    ...actual,
    ResourceCardView: jest.fn(actual.ResourceCardView),
    ResourceCardSkeleton: jest.fn(actual.ResourceCardSkeleton),
  }
})

const renderCard = (props: MitxOnlineResourceCardProps) =>
  renderWithProviders(<MitxOnlineResourceCard {...props} />)

const freeMode = factories.courses.enrollmentMode({ requires_payment: false })
const paidMode = factories.courses.enrollmentMode({ requires_payment: true })

/**
 * Off is the unresolved `undefined` PostHog returns before flags load, which
 * must render the legacy card just as an explicit `false` does.
 */
const setRedesignFlag = (enabled: boolean) => {
  jest
    .mocked(useFeatureFlagEnabled)
    .mockImplementation((flag) =>
      enabled && flag === FeatureFlags.ResourceCardRedesign ? true : undefined,
    )
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe.each([
  { card: "legacy", flag: false },
  { card: "redesigned", flag: true },
])("MitxOnlineResourceCard ($card)", ({ flag }) => {
  beforeEach(() => {
    setRedesignFlag(flag)
  })

  describe("loading and empty states", () => {
    test("renders loading state when isLoading", () => {
      renderCard({
        href: "/test",
        isLoading: true,
        resourceType: "course",
      })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    test("returns null when no resource and not loading (course)", () => {
      renderCard({ href: "/test", resourceType: "course" })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    test("returns null when no resource and not loading (program)", () => {
      renderCard({ href: "/test", resourceType: "program" })
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })
  })

  describe("course cards", () => {
    test("renders course title and link", () => {
      const course = factories.courses.course()
      renderCard({
        resource: course,
        resourceType: "course",
        href: `/courses/${course.readable_id}`,
      })
      const link = screen.getByRole("link", {
        name: new RegExp(course.title),
      })
      expect(link).toHaveAttribute("href", `/courses/${course.readable_id}`)
    })
  })

  describe("program cards", () => {
    test("renders program title and link", () => {
      const program = factories.programs.program()
      renderCard({
        resource: program,
        resourceType: "program",
        href: `/programs/${program.readable_id}`,
      })
      const link = screen.getByRole("link", {
        name: new RegExp(program.title),
      })
      expect(link).toHaveAttribute("href", `/programs/${program.readable_id}`)
    })
  })

  describe("image error fallback", () => {
    test.each([
      { resourceType: "course", makeResource: factories.courses.course },
      { resourceType: "program", makeResource: factories.programs.program },
    ] as const)(
      "falls back to the original, then DEFAULT_RESOURCE_IMG, when a $resourceType image fails",
      ({ resourceType, makeResource }) => {
        const src = "https://example.com/image.jpg"
        const resource = makeResource({
          page: { feature_image_src: src, page_url: "" },
        })
        const { view } = renderCard({
          resource,
          resourceType,
          href: "/test",
        } as MitxOnlineResourceCardProps)
        const raw = { nextJsOriginalSrc: false }
        expect(queryByImageSrc(view.container, src, raw)).toBeNull()
        // Optimized image fails: retry the original, loaded directly
        fireEvent.error(getByImageSrc(view.container, src))
        const original = getByImageSrc(view.container, src, raw)
        // Original fails too: use the default
        fireEvent.error(original)
        getByImageSrc(view.container, DEFAULT_RESOURCE_IMG)
      },
    )
  })

  describe("analytics", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    })
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    })

    test("clicking the card link captures CourseCardClicked", async () => {
      const course = factories.courses.course()
      renderCard({
        resource: course,
        resourceType: "course",
        href: "/test",
        label: "Required Courses",
      })

      await expectWindowNavigation(() =>
        user.click(
          screen.getByRole("link", { name: new RegExp(course.title) }),
        ),
      )

      expect(mockCapture).toHaveBeenCalledWith(
        PostHogEvents.CourseCardClicked,
        {
          label: "Required Courses",
          resourceId: course.id,
          readableId: course.readable_id,
          resourceType: "course",
        },
      )
    })
  })
})

describe("MitxOnlineResourceCard (legacy only)", () => {
  beforeEach(() => {
    setRedesignFlag(false)
  })

  describe("course cards", () => {
    test("shows 'Course' resource type", () => {
      const course = factories.courses.course()
      renderCard({ resource: course, resourceType: "course", href: "/test" })
      expect(screen.getByText("Course")).toBeInTheDocument()
    })
  })

  describe("program cards", () => {
    test("shows 'Course' resource type for display_mode=course", () => {
      const program = factories.programs.program({
        display_mode: DisplayModeEnum.Course,
      })
      renderCard({ resource: program, resourceType: "program", href: "/test" })
      expect(screen.getByText("Course")).toBeInTheDocument()
    })

    test("shows 'Program' resource type for default display_mode", () => {
      const program = factories.programs.program()
      renderCard({ resource: program, resourceType: "program", href: "/test" })
      expect(screen.getByText("Program")).toBeInTheDocument()
    })

    test("shows 'Anytime' for anytime availability", () => {
      const program = factories.programs.program({ availability: "anytime" })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
      })
      expect(container.textContent).toContain("Anytime")
    })

    test("shows 'Starts:' label on medium cards but not small cards", () => {
      const program = factories.programs.program({
        availability: "dated",
        start_date: "2025-09-01T00:00:00Z",
      })
      const {
        view: { container: mediumContainer },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        size: "medium",
      })
      expect(mediumContainer.textContent).toContain("Starts:")
      expect(mediumContainer.textContent).toContain("Sep 01, 2025")

      const {
        view: { container: smallContainer },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        size: "small",
      })
      expect(smallContainer.textContent).not.toContain("Starts:")
    })
  })

  describe("certificate display", () => {
    test.each<{
      resourceType: "course" | "program"
      certAvailable: boolean
    }>([
      { resourceType: "course", certAvailable: true },
      { resourceType: "course", certAvailable: false },
      { resourceType: "program", certAvailable: true },
      { resourceType: "program", certAvailable: false },
    ])(
      "$resourceType with certificate_available=$certAvailable",
      ({ resourceType, certAvailable }) => {
        const resource =
          resourceType === "course"
            ? factories.courses.course({
                certificate_available: certAvailable,
              })
            : factories.programs.program({
                certificate_available: certAvailable,
              })
        renderCard({
          resource,
          resourceType,
          href: "/test",
          size: "medium",
          list: true,
        } as MitxOnlineResourceCardProps)
        const cert = screen.queryByText(/^Certificate/)
        if (certAvailable) {
          expect(cert).toBeInTheDocument()
        } else {
          expect(cert).not.toBeInTheDocument()
        }
      },
    )
  })

  describe("enrollment-based pricing", () => {
    test("shows product price when paid-only (course)", () => {
      const course = factories.courses.course({
        min_price: 200,
        max_price: 200,
        courseruns: [
          factories.courses.courseRun({
            enrollment_modes: [paidMode],
            products: [factories.courses.product({ price: "200.00" })],
          }),
        ],
      })
      const {
        view: { container },
      } = renderCard({
        resource: course,
        resourceType: "course",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("$200")
      expect(container.textContent).not.toContain("$200.00")
    })

    test("shows 'Free' when enrollment is free-only", () => {
      const program = factories.programs.program({
        enrollment_modes: [freeMode],
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("Free")
      expect(container.textContent).not.toContain("$")
    })

    test("shows product price when paid-only (program)", () => {
      const program = factories.programs.program({
        enrollment_modes: [paidMode],
        min_price: 500,
        max_price: 500,
        products: [factories.courses.product({ price: "500.00" })],
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("$500")
      expect(container.textContent).not.toContain("$500.00")
    })

    test("shows price range when min and max differ", () => {
      const program = factories.programs.program({
        enrollment_modes: [paidMode],
        min_price: 100,
        max_price: 500,
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("$100 – $500")
    })

    test("shows 'Free' and certificate price when both free and paid", () => {
      const program = factories.programs.program({
        enrollment_modes: [freeMode, paidMode],
        min_price: 500,
        max_price: 500,
        certificate_available: true,
        products: [factories.courses.product({ price: "500.00" })],
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).toContain("Free")
      expect(container.textContent).toContain("$500")
    })

    test("shows no price when no enrollment modes", () => {
      const program = factories.programs.program({
        enrollment_modes: [],
        min_price: 500,
        max_price: 500,
      })
      const {
        view: { container },
      } = renderCard({
        resource: program,
        resourceType: "program",
        href: "/test",
        list: true,
      })
      expect(container.textContent).not.toContain("$")
      expect(container.textContent).not.toContain("Free")
    })
  })
})

describe("MitxOnlineResourceCard (redesigned only)", () => {
  beforeEach(() => {
    setRedesignFlag(true)
  })

  test("Renders the responsive layout", () => {
    renderCard({
      resource: factories.programs.program(),
      resourceType: "program",
      href: "/test",
    })

    expectProps(ResourceCardView, { layout: "responsive" })
  })

  test("A loading card renders the responsive skeleton", () => {
    renderCard({ href: "/test", resourceType: "course", isLoading: true })

    expectProps(ResourceCardSkeleton, { layout: "responsive" })
    expect(ResourceCardView).not.toHaveBeenCalled()
  })
})

describe("mitxOnlineCardContent", () => {
  const { course, courseRun, product } = factories.courses
  const { program } = factories.programs

  test("Maps a course's title, type label, and image", () => {
    const resource = course()

    expect(
      mitxOnlineCardContent({ resource, resourceType: "course" }),
    ).toMatchObject({
      title: resource.title,
      typeLabel: "Course",
      imageSrc: resource.page?.feature_image_src,
    })
  })

  test("Maps a program's title, type label, and image", () => {
    const resource = program()

    expect(
      mitxOnlineCardContent({ resource, resourceType: "program" }),
    ).toMatchObject({
      title: resource.title,
      typeLabel: "Program",
      imageSrc: resource.page?.feature_image_src,
    })
  })

  test("A program with display_mode=course is labeled 'Course'", () => {
    const resource = program({ display_mode: DisplayModeEnum.Course })

    expect(
      mitxOnlineCardContent({ resource, resourceType: "program" })?.typeLabel,
    ).toBe("Course")
  })

  describe("metadata", () => {
    test("Anytime availability starts 'Anytime'", () => {
      const resource = program({ availability: "anytime" })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.metadata,
      ).toEqual([{ label: "Starts", value: "Anytime" }])
    })

    test("A dated course starts on its run's start date", () => {
      const run = courseRun()
      const resource = course({ availability: "dated", courseruns: [run] })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "course" })?.metadata,
      ).toEqual([
        {
          label: "Starts",
          value: <LocalDate date={run.start_date} format="MMM D, YYYY" />,
        },
      ])
    })

    test("A dated program starts on its own start date", () => {
      const resource = program({ availability: "dated" })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.metadata,
      ).toEqual([
        {
          label: "Starts",
          value: <LocalDate date={resource.start_date} format="MMM D, YYYY" />,
        },
      ])
    })

    test("A dated course with no runs has no metadata", () => {
      const resource = course({ availability: "dated", courseruns: [] })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "course" })?.metadata,
      ).toEqual([])
    })
  })

  describe("price", () => {
    test("Free enrollment reads 'Free' on a light panel", () => {
      const resource = program({
        enrollment_modes: [freeMode],
        certificate_available: false,
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toEqual({ tone: "light", primary: "Free" })
    })

    test("Paid enrollment shows the price on a dark panel", () => {
      const resource = program({
        enrollment_modes: [paidMode],
        certificate_available: false,
        min_price: 100,
        max_price: 500,
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toEqual({ tone: "dark", primary: "$100 – $500" })
    })

    test("Paid enrollment with no known price reads 'Paid'", () => {
      const resource = program({
        enrollment_modes: [paidMode],
        min_price: null,
        max_price: null,
        products: [],
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toMatchObject({ tone: "dark", primary: "Paid" })
    })

    test("Free and paid enrollment is free to audit, with the certificate price", () => {
      const resource = program({
        enrollment_modes: [freeMode, paidMode],
        min_price: 100,
        max_price: 500,
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toEqual({
        tone: "light",
        primary: "Free to audit",
        certificate: "Certificate: $100 – $500",
      })
    })

    test("Free to audit with no known price reads just 'Certificate'", () => {
      const resource = program({
        enrollment_modes: [freeMode, paidMode],
        min_price: null,
        max_price: null,
        products: [],
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price
          .certificate,
      ).toBe("Certificate")
    })

    test("No enrollment modes give a neutral panel with no price", () => {
      const resource = program({
        enrollment_modes: [],
        certificate_available: false,
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toEqual({ tone: "neutral" })
    })

    test("A course's price comes from its best run", () => {
      const resource = course({
        certificate_available: false,
        courseruns: [
          courseRun({
            enrollment_modes: [paidMode],
            products: [product({ price: "200.00" })],
          }),
        ],
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "course" })?.price,
      ).toEqual({ tone: "dark", primary: "$200" })
    })

    test.each([
      { enrollment: "free enrollment", modes: [freeMode] },
      { enrollment: "paid enrollment", modes: [paidMode] },
      { enrollment: "no enrollment modes", modes: [] },
    ])(
      "With $enrollment, an available certificate shows its type",
      ({ modes }) => {
        const resource = program({
          enrollment_modes: modes,
          certificate_available: true,
        })

        expect(
          mitxOnlineCardContent({ resource, resourceType: "program" })?.price
            .certificate,
        ).toBe(resource.certificate_type)
      },
    )

    test("An available certificate with no type reads 'Certificate'", () => {
      const resource = program({
        enrollment_modes: [paidMode],
        certificate_available: true,
        certificate_type: "",
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price
          .certificate,
      ).toBe("Certificate")
    })
  })
})
