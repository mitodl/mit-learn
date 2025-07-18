import React from "react"
import { screen, within } from "@testing-library/react"
import { LearningResourceCard } from "./LearningResourceCard"
import type { LearningResourceCardProps } from "./LearningResourceCard"
import { DEFAULT_RESOURCE_IMG, getReadableResourceType } from "ol-utilities"
import { ResourceTypeEnum, PlatformEnum, AvailabilityEnum } from "api"
import { factories } from "api/test-utils"
import { getByImageSrc } from "ol-test-utilities"
import { renderWithTheme } from "../../test-utils"

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
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
        next_start_date: "2026-01-01",
      })

      setup({ resource })

      const card = screen.getByRole("article", {
        name: `${expectedLabel}: ${resource.title}`,
      })

      within(card).getByText(expectedLabel)
      within(card).getByText(resource.title)
      within(card).getByText("Starts:")
      within(card).getByText("January 01, 2026")
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
    expect(title).toHaveAttribute("lang", "en-us")
  })

  test("Displays run start date", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      next_start_date: null,
      runs: [
        factories.learningResources.run({
          start_date: "2026-01-01",
        }),
      ],
    })

    setup({ resource })

    screen.getByText("Starts:")
    screen.getByText("January 01, 2026")
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

    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: resource.title,
    })
    expect(new URL(link.href).pathname).toBe("/path/to/thing")
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
})
