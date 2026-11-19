import React from "react"
import { screen, fireEvent } from "@testing-library/react"
import { capturePostHog } from "@/common/analytics/posthog"
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
import { PostHogEvents } from "@/common/constants"
import {
  ResourceCardSkeleton,
  ResourceCardView,
} from "@/page-components/ResourceCardView/ResourceCardView"
import { DEFAULT_RESOURCE_IMG, LocalDate } from "ol-utilities"
import { getByImageSrc, queryByImageSrc } from "ol-test-utilities"
import type { MitxOnlineResourceCardProps } from "./MitxOnlineResourceCard"

jest.mock("@/common/analytics/posthog", () => ({
  capturePostHog: jest.fn(),
  initPostHog: jest.fn(),
}))
const mockCapture = jest.mocked(capturePostHog)

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

beforeEach(() => {
  jest.clearAllMocks()
})

describe("MitxOnlineResourceCard", () => {
  describe("loading and empty states", () => {
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

    test("Free and paid enrollment reads 'Free' over the certificate type and price", () => {
      const resource = program({
        enrollment_modes: [freeMode, paidMode],
        min_price: 100,
        max_price: 500,
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toEqual({
        tone: "light",
        primary: "Free",
        certificate: resource.certificate_type,
        certificatePrice: "$100 – $500",
      })
    })

    test("Free and paid enrollment with no known price shows just the certificate type", () => {
      const resource = program({
        enrollment_modes: [freeMode, paidMode],
        min_price: null,
        max_price: null,
        products: [],
      })

      expect(
        mitxOnlineCardContent({ resource, resourceType: "program" })?.price,
      ).toEqual({
        tone: "light",
        primary: "Free",
        certificate: resource.certificate_type,
      })
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

    test.each([
      { type: "no type", certificateType: "" },
      {
        type: "a certificate of completion",
        certificateType: "Certificate of Completion",
      },
    ])(
      "An available certificate with $type reads 'Certificate'",
      ({ certificateType }) => {
        const resource = program({
          enrollment_modes: [paidMode],
          certificate_available: true,
          certificate_type: certificateType,
        })

        expect(
          mitxOnlineCardContent({ resource, resourceType: "program" })?.price
            .certificate,
        ).toBe("Certificate")
      },
    )
  })
})
