import React from "react"
import { screen, within } from "@testing-library/react"

import {
  getCallToActionText,
  LearningResourceExpanded,
} from "./LearningResourceExpanded"
import type { LearningResourceExpandedProps } from "./LearningResourceExpanded"
import { ResourceTypeEnum } from "api"
import { factories, setMockResponse, urls } from "api/test-utils"
import invariant from "tiny-invariant"
import type { LearningResource } from "api"
import { PLATFORM_LOGOS } from "ol-components"
import user from "@testing-library/user-event"
import { renderWithTheme } from "@/test-utils"

const IMG_CONFIG: LearningResourceExpandedProps["imgConfig"] = {
  width: 385,
  height: 200,
}

// This is a pipe followed by a zero-width space
const SEPARATOR = "|​"

const setup = (resource: LearningResource, isLearningPathEditor?: boolean) => {
  const user = {
    ...factories.user.user({
      is_learning_path_editor: isLearningPathEditor,
    }),
    is_authenticated: true,
  }
  setMockResponse.get(urls.userMe.get(), user)
  return renderWithTheme(
    <LearningResourceExpanded
      resourceId={resource.id}
      resource={resource}
      user={user}
      shareUrl={`https://learn.mit.edu/search?resource=${resource.id}`}
      imgConfig={IMG_CONFIG}
    />,
  )
}

describe("Learning Resource Expanded", () => {
  const RESOURCE_TYPES = Object.values(ResourceTypeEnum)
  const isVideo = (resourceType: ResourceTypeEnum) =>
    resourceType === ResourceTypeEnum.Video ||
    resourceType === ResourceTypeEnum.VideoPlaylist

  test.each(RESOURCE_TYPES.filter((type) => !isVideo(type)))(
    'Renders image and title for resource type "%s"',
    (resourceType) => {
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
      })

      setup(resource)

      const images = screen.getAllByRole("img")
      const image = images.find((img) =>
        img
          .getAttribute("src")
          ?.includes(encodeURIComponent(resource.image?.url ?? "")),
      )
      expect(image).toBeInTheDocument()
      invariant(image)
      expect(image).toHaveAttribute("alt", resource.image?.alt ?? "")

      screen.getByText(resource.title)

      const linkName = getCallToActionText(resource)

      if (linkName) {
        const link = screen.getByRole("link", {
          name: linkName,
        }) as HTMLAnchorElement
        expect(link.target).toBe("_blank")
        expect(link.href).toMatch(new RegExp(`^${resource.url}/?$`))
      }
    },
  )

  test(`Renders card and title for resource type "${ResourceTypeEnum.Video}"`, () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Video,
    })

    setup(resource)

    const embedlyCard = screen.getByTestId("embedly-card")
    invariant(embedlyCard)
    expect(embedlyCard).toHaveAttribute("href", resource.url)

    screen.getByText(resource.title)
  })

  test.each([ResourceTypeEnum.Program, ResourceTypeEnum.LearningPath])(
    'Renders CTA button for resource type "%s"',
    (resourceType) => {
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
      })

      setup(resource)

      const linkName = "Learn More"
      if (linkName) {
        const link = screen.getByRole("link", {
          name: linkName,
        }) as HTMLAnchorElement

        expect(link.href).toMatch(new RegExp(`^${resource.url}/?$`))
        expect(link.getAttribute("data-ph-action")).toBe("click-cta")
      }
    },
  )

  test.each([ResourceTypeEnum.PodcastEpisode])(
    'Renders CTA button for resource type "%s"',
    (resourceType) => {
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
        podcast_episode: {
          episode_link: "https://example.com",
        },
      })

      setup(resource)

      const link = screen.getByRole("link", {
        name: "Listen to Podcast",
      }) as HTMLAnchorElement

      expect(link.href).toMatch(resource.url || "")
    },
  )

  test.each([ResourceTypeEnum.PodcastEpisode])(
    "Renders xpro logo conditionally on offered_by=xpro and not platform.code",
    (resourceType) => {
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
        platform: { code: "test" },
        offered_by: { code: "xpro" },
        podcast_episode: {
          episode_link: "https://example.com",
        },
      })

      setup(resource)
      const xproImage = screen
        .getAllByRole("img")
        .find((img) => img.getAttribute("alt")?.includes("xPRO"))

      expect(xproImage).toBeInTheDocument()
      expect(xproImage).toHaveAttribute("alt", PLATFORM_LOGOS["xpro"].name)
    },
  )

  test(`Renders info section for resource type "${ResourceTypeEnum.Video}"`, () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Video,
    })

    setup(resource)

    const run = resource.runs![0]

    if (run) {
      const section = screen
        .getByRole("heading", { name: "Info" })!
        .closest("section")!

      const price = run.resource_prices?.[0]

      const displayPrice =
        parseFloat(price.amount) === 0
          ? "Free"
          : price.amount
            ? `$${price.amount}`
            : null
      if (displayPrice) {
        within(section).getByText(displayPrice)
      }

      const level = run.level?.[0]
      if (level) {
        within(section).getByText(level.name)
      }

      const instructors = run.instructors
        ?.filter((instructor) => instructor.full_name)
        .map(({ full_name: name }) => name)
      if (instructors?.length) {
        within(section!).getByText(instructors.join(", "))
      }
    }
  })

  test("Renders info section topics correctly", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      topics: [
        factories.learningResources.topic({ name: "Topic 1" }),
        factories.learningResources.topic({ name: "Topic 2" }),
        factories.learningResources.topic({ name: "Topic 3" }),
      ],
    })

    setup(resource)

    const section = screen.getByTestId("drawer-info-items")

    within(section).getByText((_content, node) => {
      return (
        node?.textContent ===
          ["Topic 1", "Topic 2", "Topic 3"].join(SEPARATOR) || false
      )
    })
  })

  test("Renders info section languages correctly", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      runs: [
        factories.learningResources.run({
          languages: ["en-us", "es-es", "fr-fr"],
        }),
      ],
    })

    setup(resource)

    const section = screen.getByTestId("drawer-info-items")

    within(section).getByText((_content, node) => {
      return (
        node?.textContent ===
          ["English", "Spanish", "French"].join(SEPARATOR) || false
      )
    })
  })

  test("Renders info section video duration correctly", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Video,
      video: { duration: "PT1H13M44S" },
    })

    setup(resource)

    const section = screen.getByTestId("drawer-info-items")

    within(section).getByText("1:13:44")
  })

  test("Renders info section podcast episode duration correctly", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.PodcastEpisode,
      podcast_episode: { duration: "PT13M44S" },
    })

    setup(resource)

    const section = screen.getByTestId("drawer-info-items")

    within(section).getByText("13:44")
  })

  test.each([true, false])(
    "Add to list button only shows if you have the proper permissions",
    (isLearningPathEditor) => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
      })

      setup(resource, isLearningPathEditor)

      const section = screen.getByTestId("drawer-cta")

      const buttons = within(section).getAllByRole("button")
      expect(buttons).toHaveLength(isLearningPathEditor ? 3 : 2)
      expect(
        !!within(section).queryByRole("button", {
          name: "Add to list",
        }),
      ).toBe(isLearningPathEditor)
    },
  )

  test("Clicking the share button toggles the share section", async () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })

    setup(resource)

    await user.click(screen.getByRole("button", { name: "Share" }))

    const shareSection = screen.getByTestId("drawer-share")
    expect(shareSection).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Share" }))
    expect(shareSection).not.toBeInTheDocument()
  })

  test("Clicking the share button copies the share URL to the clipboard", async () => {
    const writeText = jest.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })

    setup(resource)

    const shareButton = screen.getByRole("button", { name: "Share" })
    await user.click(shareButton)

    const shareSection = screen.getByTestId("drawer-share")
    const copyButton = within(shareSection).getByRole("button", {
      name: "Copy Link",
    })

    await user.click(copyButton)
    expect(writeText).toHaveBeenCalledWith(
      `https://learn.mit.edu/search?resource=${resource.id}`,
    )
    expect(copyButton).toHaveTextContent("Copied!")
  })
})