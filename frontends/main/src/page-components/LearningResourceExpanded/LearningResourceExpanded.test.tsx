import React from "react"
import { screen, waitFor, within } from "@testing-library/react"
import { LearningResourceExpanded } from "../LearningResourceExpanded/LearningResourceExpanded"
import { getCallToActionText } from "./CallToActionSection"
import type { LearningResourceExpandedProps } from "../LearningResourceExpanded/LearningResourceExpanded"
import { ResourceTypeEnum } from "api"
import { factories, setMockResponse, urls } from "api/test-utils"
import invariant from "tiny-invariant"
import { PLATFORM_LOGOS } from "ol-components"
import user from "@testing-library/user-event"
import { renderWithProviders } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

const IMG_CONFIG: LearningResourceExpandedProps["imgConfig"] = {
  width: 385,
  height: 200,
}

// This is a pipe followed by a zero-width space
const SEPARATOR = "|​"

type SetupOpts = {
  isLearningPathEditor?: boolean
}
type SetupProps = Partial<LearningResourceExpandedProps>
const setup = (props: SetupProps, opts?: SetupOpts) => {
  const resourceId = props.resourceId ?? props.resource?.id
  invariant(resourceId, "resourceId or resource must be provided")

  const user = {
    ...factories.user.user({
      is_learning_path_editor: opts?.isLearningPathEditor,
    }),
    is_authenticated: true,
  }
  setMockResponse.get(urls.userMe.get(), user)
  const allProps: LearningResourceExpandedProps = {
    user: user,
    chatExpanded: false,
    shareUrl: `https://learn.mit.edu/search?resource=${resourceId}`,
    imgConfig: IMG_CONFIG,
    ...props,
    resourceId,
  }
  const { view } = renderWithProviders(
    <LearningResourceExpanded {...allProps} />,
  )
  return {
    rerender: (newProps: Partial<LearningResourceExpandedProps>) =>
      view.rerender(<LearningResourceExpanded {...allProps} {...newProps} />),
  }
}

const RESOURCE_TYPES = Object.values(ResourceTypeEnum).map((v) => ({
  resourceType: v,
}))

describe("Learning Resource Expanded", () => {
  const isVideo = (resourceType: ResourceTypeEnum) =>
    resourceType === ResourceTypeEnum.Video ||
    resourceType === ResourceTypeEnum.VideoPlaylist

  test.each(
    RESOURCE_TYPES.filter(({ resourceType }) => !isVideo(resourceType)),
  )(
    'Renders image and title for resource type "$resourceType"',
    ({ resourceType }) => {
      const resource = factories.learningResources.resource({
        resource_type: resourceType,
      })

      setup({ resource })

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

    setup({ resource })

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

      setup({ resource })

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

      setup({ resource })

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

      setup({ resource })
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

    setup({ resource })

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

    setup({ resource })

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

    setup({ resource })

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

    setup({ resource })

    const section = screen.getByTestId("drawer-info-items")

    within(section).getByText("1:13:44")
  })

  test("Renders info section podcast episode duration correctly", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.PodcastEpisode,
      podcast_episode: { duration: "PT13M44S" },
    })

    setup({ resource })

    const section = screen.getByTestId("drawer-info-items")

    within(section).getByText("13:44")
  })

  test.each([true, false])(
    "Add to list button only shows if you have the proper permissions",
    (isLearningPathEditor) => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
      })

      setup({ resource }, { isLearningPathEditor })

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

    setup({ resource })

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

    setup({ resource })

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

describe.each([true, false])(
  "LearningResourceExpanded AiChat (enabled: %s)",
  (enabled) => {
    beforeEach(() => {
      mockedUseFeatureFlagEnabled.mockReturnValue(enabled)
    })

    test.each(RESOURCE_TYPES)(
      "Chat button visible only on courses ($resourceType)",
      ({ resourceType }) => {
        const resource = factories.learningResources.resource({
          resource_type: resourceType,
        })
        setup({ resource })

        const chatButton = screen.queryByRole("button", {
          name: "Ask TIM about this course",
        })
        const shouldBeVisible =
          enabled && resourceType === ResourceTypeEnum.Course
        expect(!!chatButton).toBe(shouldBeVisible)
      },
    )

    test("Rerendering with a new resource keeps drawer open if and only if AiChat is enabled", async () => {
      if (!enabled) return
      const course1 = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
      })
      const course2 = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
      })
      const episode = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.PodcastEpisode,
      })

      const { rerender } = setup({
        resource: course1,
        chatExpanded: true,
      })
      await user.click(screen.getByRole("button", { name: "Close" }))

      const dataTestId = "ai-chat-entry-screen"
      expect(screen.getByTestId(dataTestId)).toBeInTheDocument()
      rerender({ resource: course2 })
      expect(screen.getByTestId(dataTestId)).toBeInTheDocument()
      rerender({ resource: episode })
      await waitFor(() => {
        expect(screen.queryByTestId(dataTestId)).toBe(null)
      })
    })

    test("When `chatExpanded=false`, chat button is not pressed and chat is inert", () => {
      if (!enabled) return
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
      })
      setup({ resource, chatExpanded: false })

      screen.getByRole("button", {
        name: /Ask\sTIM/,
        pressed: false,
      })

      // AiChat is always in the dom, but it's hidden and inert when not expanded.
      const aiChat = screen.getByTestId("ai-chat-entry-screen")
      expect(!!aiChat.closest("[inert]")).toBe(true)
    })

    test("When `chatExpanded=true`, chat is not inert until closed", async () => {
      if (!enabled) return
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
      })
      setup({ resource, chatExpanded: true })

      const aiChat = screen.getByTestId("ai-chat-entry-screen")
      expect(!!aiChat.closest("[inert]")).toBe(false)

      await user.click(screen.getByRole("button", { name: "Close" }))

      expect(!!aiChat.closest("[inert]")).toBe(true)
    })
  },
)
