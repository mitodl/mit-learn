import React from "react"
import { screen, within } from "@testing-library/react"
import { LearningResourceListCard } from "./LearningResourceListCard"
import type { LearningResourceListCardProps } from "./LearningResourceListCard"
import { DEFAULT_RESOURCE_IMG, getReadableResourceType } from "ol-utilities"
import { ResourceTypeEnum, PlatformEnum, AvailabilityEnum } from "api"
import { factories } from "api/test-utils"
import { getByImageSrc } from "ol-test-utilities"
import { renderWithTheme } from "../../test-utils"

// Helper function to create a date N days from today
const daysFromToday = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

// Helper to format date as "Month DD, YYYY"
const formatTestDate = (isoDate: string): string => {
  const date = new Date(isoDate)
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }
  return date.toLocaleDateString("en-US", options)
}

const setup = (props: LearningResourceListCardProps) => {
  return renderWithTheme(<LearningResourceListCard {...props} />)
}

describe("Learning Resource List Card", () => {
  test.each([
    { resourceType: ResourceTypeEnum.Course, expectedLabel: "Course" },
    { resourceType: ResourceTypeEnum.Program, expectedLabel: "Program" },
  ])(
    "Renders resource type, title and start date as a labeled article",
    ({ resourceType, expectedLabel }) => {
      const startDate = daysFromToday(30)
      const run = factories.learningResources.run({
        id: 1,
        start_date: startDate,
        enrollment_start: null,
      })
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
        best_run_id: 1,
        runs: [run],
      })

      setup({ resource })

      const card = screen.getByRole("article", {
        name: `${expectedLabel}: ${resource.title}`,
      })

      within(card).getByText(expectedLabel)
      within(card).getByText(resource.title)
      within(card).getByText("Starts:")
      within(card).getByText(formatTestDate(startDate))
    },
  )

  test("Sets lang attribute on title and description", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      runs: [
        factories.learningResources.run({
          languages: ["pt-pt"],
        }),
      ],
    })

    setup({ resource })

    const title = screen.getByText(resource.title)
    expect(title).toHaveAttribute("lang", "pt-pt")
  })

  test("Displays run start date", () => {
    const startDate = daysFromToday(45)
    const run = factories.learningResources.run({
      id: 1,
      start_date: startDate,
    })
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      best_run_id: 1,
      runs: [run],
    })

    setup({ resource })

    screen.getByText("Starts:")
    screen.getByText(formatTestDate(startDate))
  })

  test("Shows today's date when best run start date is in the past", () => {
    const pastStartDate = daysFromToday(-30) // 30 days ago
    const todayDate = new Date().toISOString()
    const run = factories.learningResources.run({
      id: 1,
      start_date: pastStartDate,
      enrollment_start: null,
    })
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      best_run_id: 1,
      runs: [run],
    })

    setup({ resource })

    screen.getByText("Starts:")
    screen.getByText(formatTestDate(todayDate))
  })

  test("Shows no start date when best_run_id is null", () => {
    const run = factories.learningResources.run({
      id: 1,
      start_date: null,
      enrollment_start: null,
    })
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      best_run_id: null,
      runs: [run],
    })

    setup({ resource })

    expect(screen.queryByText("Starts:")).toBeNull()
  })

  test("Shows no start date when best run has null dates", () => {
    const run = factories.learningResources.run({
      id: 1,
      start_date: null,
      enrollment_start: null,
    })
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      best_run_id: 1,
      runs: [run],
    })

    setup({ resource })

    expect(screen.queryByText("Starts:")).toBeNull()
  })

  test.each([
    {
      resource: factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        availability: AvailabilityEnum.Anytime,
      }),
      showsAnytime: true,
    },
    {
      resource: factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Program,
        availability: AvailabilityEnum.Anytime,
      }),
      showsAnytime: true,
    },
    {
      resource: factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Video,
        availability: AvailabilityEnum.Anytime,
      }),
      showsAnytime: false,
    },
  ] as const)(
    "Displays 'Anytime' for availability 'Anytime' courses and programs",
    ({ resource, showsAnytime }) => {
      setup({ resource })

      const anytime = screen.queryByText("Anytime")
      const starts = screen.queryByText("Starts:")
      expect(!!anytime).toEqual(showsAnytime)
      expect(!!starts).toBe(showsAnytime)
    },
  )

  test("Click to navigate", async () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      platform: { code: PlatformEnum.Ocw },
    })

    setup({ resource, href: "/path/to/thing" })

    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: resource.title,
    })

    expect(link).toHaveAttribute("href", "/path/to/thing")
  })

  test("Click action buttons", async () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      platform: { code: PlatformEnum.Ocw },
    })

    const onAddToLearningPathClick = jest.fn()
    const onAddToUserListClick = jest.fn()

    renderWithTheme(
      <LearningResourceListCard
        resource={resource}
        onAddToLearningPathClick={onAddToLearningPathClick}
        onAddToUserListClick={onAddToUserListClick}
      />,
    )

    const addToLearningPathButton = screen.getByLabelText(
      "Add to Learning Path",
    )
    await addToLearningPathButton.click()

    const addToUserListButton = screen.getByLabelText(
      `Bookmark ${getReadableResourceType(resource.resource_type)}`,
    )
    await addToUserListButton.click()

    expect(onAddToLearningPathClick).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(HTMLElement),
      }),
      resource.id,
    )
    expect(onAddToUserListClick).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(HTMLElement),
      }),
      resource.id,
    )
  })

  test("Displays certificate badge", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      certification: true,
      certification_type: {
        name: "MicroMasters Credential",
      },
    })

    setup({ resource })

    screen.getByText(resource.certification_type.name)
  })

  test("Displays certificate type", () => {
    const resource = factories.learningResources.resource({
      certification: true,
      certification_type: {
        name: "Test Certificate",
      },
    })

    setup({ resource })

    screen.getByText("Test Certificate")
  })

  test("Does not display certificate badge", () => {
    const resource = factories.learningResources.resource({
      certification: false,
    })

    setup({ resource })

    const badge = screen.queryByText("Certificate")

    expect(badge).not.toBeInTheDocument()
  })

  test.each([
    {
      image: null,
      expected: { src: DEFAULT_RESOURCE_IMG, alt: "", role: "presentation" },
    },
    {
      image: { url: "https://example.com/image.jpg", alt: "An image" },
      expected: {
        src: "https://example.com/image.jpg",
        alt: "An image",
        role: "img",
      },
    },
    {
      image: { url: "https://example.com/image.jpg", alt: null },
      expected: {
        src: "https://example.com/image.jpg",
        alt: "",
        role: "presentation",
      },
    },
  ])("Image is displayed if present", ({ expected, image }) => {
    const resource = factories.learningResources.resource({ image })

    const view = setup({ resource })

    const imageEl = getByImageSrc(view.container, expected.src)

    expect(imageEl).toHaveAttribute("alt", expected.alt)
  })

  describe("Price display", () => {
    test('Free course without certificate option displays "Free"', () => {
      const resource = factories.learningResources.resource({
        certification: false,
        free: true,
        resource_prices: [{ amount: "0", currency: "USD" }],
      })
      setup({ resource })
      screen.getByText("Free")
    })

    test('Free course with paid certificate option displays the certificate price and "Free"', () => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        certification: true,
        free: true,
        resource_prices: [
          { amount: "0", currency: "USD" },
          { amount: "49", currency: "USD" },
        ],
        certification_type: {
          name: "Certificate of Completion",
        },
      })
      setup({ resource })
      screen.getByText("Certificate of Completion", { exact: false })
      screen.getByText(/\$49/)
      screen.getByText("Free")
    })

    test('Free course with paid certificate option range displays the certificate price range and "Free". Prices are sorted correctly', () => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Program,
        certification: true,
        free: true,
        resource_prices: [
          { amount: "0", currency: "USD" },
          { amount: "99", currency: "USD" },
          { amount: "49", currency: "USD" },
        ],
        certification_type: {
          name: "Certificate of Completion",
        },
      })
      setup({ resource })

      screen.getByText("Certificate of Completion", { exact: false })
      screen.getByText(/\$49 – \$99/)
      screen.getByText("Free")
    })

    test("Paid course without certificate option displays the course price", () => {
      const resource = factories.learningResources.resource({
        certification: false,
        free: false,
        resource_prices: [{ amount: "49", currency: "USD" }],
      })
      setup({ resource })
      screen.getByText("$49")
    })

    test("Amount with currency subunits are displayed to 2 decimal places", () => {
      const resource = factories.learningResources.resource({
        certification: false,
        free: false,
        resource_prices: [{ amount: "49.50", currency: "USD" }],
      })
      setup({ resource })
      screen.getByText("$49.50")
    })

    test('Free course with empty prices array displays "Free"', () => {
      const resource = factories.learningResources.resource({
        certification: false,
        free: true,
        resource_prices: [],
      })
      setup({ resource })
      screen.getByText("Free")
    })

    test('Paid course that has zero price (prices not ingested) displays "Paid"', () => {
      const resource = factories.learningResources.resource({
        certification: false,
        free: false,
        resource_prices: [{ amount: "0", currency: "USD" }],
      })
      setup({ resource })
      screen.getByText("Paid")
    })
  })
})
