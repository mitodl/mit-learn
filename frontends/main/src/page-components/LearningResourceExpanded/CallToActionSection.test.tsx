import React from "react"
import { screen, fireEvent } from "@testing-library/react"
import { renderWithProviders } from "@/test-utils"
import { factories } from "api/test-utils"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getByImageSrc } from "ol-test-utilities"
import { PlatformEnum, ResourceTypeEnum, ResourceTypeGroupEnum } from "api"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import type { PostHog } from "posthog-js"
import { FeatureFlags } from "@/common/feature_flags"
import { coursePageView, programPageView } from "@/common/urls"
import CallToActionSection from "./CallToActionSection"
import type { ImageConfig } from "ol-components"
import { kebabCase } from "lodash"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")

const mockUsePostHog = jest.mocked(usePostHog)
const mockCapture = jest.fn() as PostHog["capture"]
const posthog = {
  capture: mockCapture,
} as PostHog
mockUsePostHog.mockReturnValue(posthog)
const mockUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
mockUseFeatureFlagEnabled.mockReturnValue(false)

const IMG_CONFIG: ImageConfig = {
  width: 385,
  height: 200,
}

describe("CallToActionSection", () => {
  describe("Resource URL rendering", () => {
    it.each([
      {
        resourceType: ResourceTypeEnum.Course,
        platform: PlatformEnum.Xpro,
        resourceCategory: "Course",
        expectedText: "Learn More",
      },
      {
        resourceType: ResourceTypeEnum.Course,
        platform: PlatformEnum.Ocw,
        resourceCategory: "Course",
        expectedText: "Access Course Materials",
      },

      {
        resourceType: ResourceTypeEnum.Program,
        platform: PlatformEnum.Xpro,
        resourceCategory: "Program",
        expectedText: "Learn More",
      },
      {
        resourceType: ResourceTypeEnum.Video,
        platform: PlatformEnum.Youtube,
        resourceCategory: "Video",
        expectedText: "Watch Video",
      },
      {
        resourceType: ResourceTypeEnum.Video,
        platform: PlatformEnum.Ocw,
        resourceCategory: "Lecture Video",
        expectedText: "Watch Video",
      },
      {
        resourceType: ResourceTypeEnum.VideoPlaylist,
        platform: PlatformEnum.Youtube,
        resourceCategory: "Video Playlist",
        expectedText: "Learn More",
      },
      {
        resourceType: ResourceTypeEnum.Podcast,
        expectedText: "Listen to Podcast",
        resourceCategory: "Podcast",
        platform: PlatformEnum.Podcast,
      },
      {
        resourceType: ResourceTypeEnum.PodcastEpisode,
        expectedText: "Listen to Podcast",
        resourceCategory: "Podcast Episode",
        platform: PlatformEnum.Podcast,
      },
      {
        resourceType: ResourceTypeEnum.Document,
        resourceCategory: "Article",
        expectedText: "View Article",
        platform: PlatformEnum.Climate,
      },
      {
        resourceType: ResourceTypeEnum.Document,
        expectedText: "Access Learning Material",
        resourceCategory: "Assignment",
        platform: PlatformEnum.Ocw,
      },
      {
        resourceType: ResourceTypeEnum.Document,
        resourceCategory: "Assignment",
        expectedText: "Learn More",
        platform: PlatformEnum.Xpro,
      },
    ])(
      "renders link with correct text for $resourceType and platform $platform",
      ({ resourceType, expectedText, platform, resourceCategory }) => {
        const resource = factories.learningResources.resource({
          resource_type: resourceType,
          resource_category: resourceCategory,
          platform: { code: platform },
          playlists: [],
          url: "https://example.com/resource",
        })

        renderWithProviders(
          <CallToActionSection
            imgConfig={IMG_CONFIG}
            resource={resource}
            shareUrl="https://learn.mit.edu/test"
          />,
        )

        const link = screen.getByRole("link", { name: expectedText })
        expect(link).toBeInTheDocument()
      },
    )
  })

  describe("UTM parameters", () => {
    it("adds UTM params to external URLs", () => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        title: "Test Course Title",
        url: "https://external-site.com/course",
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      expect(link).toHaveAttribute(
        "href",
        `https://external-site.com/course?utm_source=mit-learn&utm_medium=referral&utm_content=${kebabCase(resource.title)}`,
      )
    })

    it("adds UTM params to URLs with existing query params", () => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        title: "Test Course",
        url: "https://external-site.com/course?existing=param",
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      const href = link.getAttribute("href")
      expect(href).toContain("utm_source=mit-learn")
      expect(href).toContain("utm_medium=referral")
      expect(href).toContain("utm_content=test-course")
      expect(href).toContain("existing=param")
    })

    it("does NOT add UTM params to internal URLs", () => {
      const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        title: "Test Course",
        url: `${NEXT_PUBLIC_ORIGIN}/internal/page`,
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      const href = link.getAttribute("href")
      expect(href).not.toContain("utm_source")
      expect(href).not.toContain("utm_medium")
      expect(href).not.toContain("utm_content")
      expect(href).toBe(`${NEXT_PUBLIC_ORIGIN}/internal/page`)
    })

    it("does NOT add UTM params to relative URLs", () => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        title: "Test Course",
        url: "/relative/path",
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      const href = link.getAttribute("href")
      expect(href).not.toContain("utm_source")
      expect(href).not.toContain("utm_medium")
      expect(href).not.toContain("utm_content")
      expect(href).toBe("/relative/path")
    })
  })

  describe("MITx Online product pages", () => {
    const readableId = faker.lorem.slug()
    const url = faker.internet.url()

    const mitxOnlineResource: typeof factories.learningResources.resource = (
      overrides,
    ) => {
      return factories.learningResources.resource({
        platform: { code: PlatformEnum.Mitxonline },
        readable_id: readableId,
        url,
        ...overrides,
      })
    }

    it.each([
      {
        resourceType: ResourceTypeEnum.Course,
        expectedPath: coursePageView(readableId),
      },
      {
        resourceType: ResourceTypeEnum.Program,
        resourceTypeGroup: ResourceTypeGroupEnum.Program,
        expectedPath: programPageView({
          readable_id: readableId,
          display_mode: "",
        }),
      },
      {
        resourceType: ResourceTypeEnum.Program,
        resourceTypeGroup: ResourceTypeGroupEnum.Course,
        expectedPath: programPageView({
          readable_id: readableId,
          display_mode: "course",
        }),
      },
    ])(
      "links to product page $expectedPath when flag is ON for MITx Online $resourceType",
      ({ resourceType, resourceTypeGroup, expectedPath }) => {
        mockUseFeatureFlagEnabled.mockImplementation(
          (flag) => flag === FeatureFlags.MitxOnlineProductPages,
        )
        const resource = mitxOnlineResource({
          resource_type: resourceType,
          resource_type_group: resourceTypeGroup,
        })

        renderWithProviders(
          <CallToActionSection
            imgConfig={IMG_CONFIG}
            resource={resource}
            shareUrl="https://learn.mit.edu/test"
          />,
        )

        const link = screen.getByRole("link", { name: "Learn More" })
        expect(link).toHaveAttribute("href", expectedPath)
        expect(link.getAttribute("href")).not.toContain("utm_")
      },
    )

    it("uses external URL with UTM params when feature flag is OFF for MITx Online course/program", () => {
      mockUseFeatureFlagEnabled.mockReturnValue(false)

      const resource = mitxOnlineResource({
        resource_type: ResourceTypeEnum.Course,
      })
      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      const href = link.getAttribute("href")
      expect(href).toContain(url)
      expect(href).toContain("utm_source=mit-learn")
      expect(href).toContain("utm_medium=referral")
    })

    it("uses external URL with UTM params for non-MITx Online course even when flag is ON", () => {
      mockUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.MitxOnlineProductPages,
      )

      const resource = mitxOnlineResource({
        resource_type: ResourceTypeEnum.Course,
        platform: { code: PlatformEnum.Ocw },
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", {
        name: "Access Course Materials",
      })
      const href = link.getAttribute("href")
      expect(href).toContain(url)
      expect(href).toContain("utm_source=mit-learn")
      expect(href).not.toContain("/courses/")
    })
  })

  describe("Image fallback chain", () => {
    const render = (
      resource: ReturnType<typeof factories.learningResources.resource>,
    ) =>
      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

    it("shows content_files image when resource.image is null for Document/Video", () => {
      const contentFileImageSrc = "https://example.com/content-file.jpg"
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Document,
        image: null,
        content_files: [
          factories.learningResources.contentFile({
            image_src: contentFileImageSrc,
          }),
        ],
      })

      const { view } = render(resource)

      getByImageSrc(view.container, contentFileImageSrc)
    })

    it("falls back to DEFAULT_RESOURCE_IMG when image.url returns 404", () => {
      const primaryUrl = "https://example.com/primary.jpg"
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Document,
        image: { url: primaryUrl, alt: "primary" },
      })

      const { view } = render(resource)
      fireEvent.error(getByImageSrc(view.container, primaryUrl))

      getByImageSrc(view.container, DEFAULT_RESOURCE_IMG)
    })
  })

  describe("OCW product pages", () => {
    const ocwSlug =
      "16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006"
    const ocwUrl = `https://ocw.mit.edu/courses/${ocwSlug}/`

    const ocwResource: typeof factories.learningResources.resource = (
      overrides,
    ) => {
      return factories.learningResources.resource({
        platform: { code: PlatformEnum.Ocw },
        url: ocwUrl,
        ...overrides,
      })
    }

    it("links to internal OCW page when flag is ON for OCW course", () => {
      mockUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.OcwProductPages,
      )
      const resource = ocwResource({ resource_type: ResourceTypeEnum.Course })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Access Course Materials" })
      expect(link).toHaveAttribute("href", `/courses/o/${ocwSlug}`)
      expect(link.getAttribute("href")).not.toContain("utm_")
    })

    it("uses external URL with UTM params when flag is OFF for OCW course", () => {
      mockUseFeatureFlagEnabled.mockReturnValue(false)
      const resource = ocwResource({ resource_type: ResourceTypeEnum.Course })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Access Course Materials" })
      const href = link.getAttribute("href")
      expect(href).toContain("ocw.mit.edu")
      expect(href).toContain("utm_source=mit-learn")
      expect(href).toContain("utm_medium=referral")
    })

    it("does not transform non-OCW course URL when only OcwProductPages flag is ON", () => {
      mockUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.OcwProductPages,
      )
      const resource = factories.learningResources.resource({
        platform: { code: PlatformEnum.Mitxonline },
        resource_type: ResourceTypeEnum.Course,
        url: "https://courses.mitxonline.mit.edu/learn/course/some-course/",
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      const href = link.getAttribute("href")
      expect(href).toContain("mitxonline.mit.edu")
      expect(href).not.toContain("/courses/o/")
    })

    it("transforms OCW non-course URL when flag is ON", () => {
      mockUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.OcwProductPages,
      )
      const resource = ocwResource({
        resource_type: ResourceTypeEnum.Video,
        resource_category: "Lecture Video",
        url: `${ocwUrl}resources/abc-def`,
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", {
        name: "Watch Video",
      })
      const href = link.getAttribute("href")
      expect(href).toContain(`/courses/o/${ocwSlug}/resources/abc-def`)
      expect(href).not.toContain("ocw.mit.edu")
      expect(href).not.toContain("utm_")
    })
  })

  describe("PostHog integration", () => {
    it("calls posthog.capture when CTA link is clicked", () => {
      const originalPostHogKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"

      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        url: "https://example.com/course",
      })

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })
      link.click()

      expect(mockCapture).toHaveBeenCalledWith("cta_clicked", {
        resource,
        label: "Learn More",
      })

      // Restore original value
      if (originalPostHogKey) {
        process.env.NEXT_PUBLIC_POSTHOG_API_KEY = originalPostHogKey
      } else {
        delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      }
    })
  })
})
