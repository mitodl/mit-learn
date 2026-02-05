import React from "react"
import { screen, within } from "@testing-library/react"
import { LearningResourceCard } from "./LearningResourceCard"
import type { LearningResourceCardProps } from "./LearningResourceCard"
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

const setup = (props: LearningResourceCardProps) => {
  // TODO Browser Router will need to be replaced with a Next.js router mock or alternative strategy
  return renderWithTheme(<LearningResourceCard {...props} />)
}

describe("Learning Resource Card", () => {
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
          languages: ["en-us"],
        }),
      ],
    })

    setup({ resource })

    const title = screen.getByText(resource.title)
    expect(title.parentElement).toHaveAttribute("lang", "en-us")
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
        resource_type: ResourceTypeEnum.Course,
        availability: AvailabilityEnum.Anytime,
      }),
      size: "small",
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
    ({ resource, size, showsAnytime }) => {
      setup({ resource, size })

      const anytime = screen.queryByText("Anytime")
      const starts = screen.queryByText("Starts:")
      expect(!!anytime).toEqual(showsAnytime)
      expect(!!starts).toBe(showsAnytime)
    },
  )

  test("Links to specified href", async () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      platform: { code: PlatformEnum.Ocw },
    })

    setup({ resource, href: "/path/to/thing" })

    const titleHeading = screen.getByRole("heading", {
      name: resource.title,
    })
    expect(
      new URL((titleHeading.parentElement as HTMLAnchorElement).href).pathname,
    ).toBe("/path/to/thing")
  })

  test("Click action buttons", async () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      platform: { code: PlatformEnum.Ocw },
    })

    const onAddToLearningPathClick = jest.fn()
    const onAddToUserListClick = jest.fn()

    renderWithTheme(
      <LearningResourceCard
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
      certification: true,
    })

    setup({ resource })

    screen.getByText("Certificate")
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
      expected: { src: DEFAULT_RESOURCE_IMG, alt: "" },
    },
    {
      image: { url: "https://example.com/image.jpg", alt: "An image" },
      expected: { src: "https://example.com/image.jpg", alt: "An image" },
    },
    {
      image: { url: "https://example.com/image.jpg", alt: null },
      expected: { src: "https://example.com/image.jpg", alt: "" },
    },
  ])("Image is displayed if present", ({ expected, image }) => {
    const resource = factories.learningResources.resource({ image })

    const view = setup({ resource })

    const imageEl = getByImageSrc(view.container, expected.src)

    expect(imageEl).toHaveAttribute("alt", expected.alt)
  })

  test("Resource cards have headingLevel set for screen reader navigation", async () => {
    const resource = factories.learningResources.resource({})

    setup({ resource, headingLevel: 2 })

    const titleHeading = screen.getByRole("heading", {
      name: resource.title,
    })
    expect(titleHeading.getAttribute("aria-level")).toBe("2")
  })
})
