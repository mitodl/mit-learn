import React from "react"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test-utils"
import { factories } from "api/test-utils"
import { PlatformEnum, ResourceTypeEnum } from "api"
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
      { resourceType: ResourceTypeEnum.Course, expectedText: "Learn More" },
      { resourceType: ResourceTypeEnum.Program, expectedText: "Learn More" },
      {
        resourceType: ResourceTypeEnum.Video,
        expectedText: "Watch on YouTube",
      },
      {
        resourceType: ResourceTypeEnum.VideoPlaylist,
        expectedText: "Watch on YouTube",
      },
      {
        resourceType: ResourceTypeEnum.Podcast,
        expectedText: "Listen to Podcast",
      },
      {
        resourceType: ResourceTypeEnum.PodcastEpisode,
        expectedText: "Listen to Podcast",
      },
      { resourceType: ResourceTypeEnum.Article, expectedText: "View Article" },
      {
        resourceType: ResourceTypeEnum.LearningPath,
        expectedText: "Learn More",
      },
    ])(
      "renders link with correct text for $resourceType",
      ({ resourceType, expectedText }) => {
        const resource = factories.learningResources.resource({
          resource_type: resourceType,
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

    it("renders 'Access Course Materials' for OCW courses", () => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        platform: { code: PlatformEnum.Ocw },
        url: "https://ocw.mit.edu/course",
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
      expect(link).toBeInTheDocument()
    })
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
    const makeMitxOnlineResource = () =>
      factories.learningResources.resource({
        resource_type: faker.helpers.arrayElement([
          ResourceTypeEnum.Course,
          ResourceTypeEnum.Program,
        ]),
        readable_id: "test-readable-id",
        platform: { code: PlatformEnum.Mitxonline },
        url: "https://mitxonline.mit.edu/external-url",
      })

    it("uses new course product page when feature flag is ON and resource is MITx Online course/program", () => {
      mockUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.MitxOnlineProductPages,
      )
      const resource = makeMitxOnlineResource()

      renderWithProviders(
        <CallToActionSection
          imgConfig={IMG_CONFIG}
          resource={resource}
          shareUrl="https://learn.mit.edu/test"
        />,
      )

      const link = screen.getByRole("link", { name: "Learn More" })

      const expectedUrl =
        resource.resource_type === ResourceTypeEnum.Course
          ? coursePageView(resource.readable_id)
          : programPageView(resource.readable_id)
      expect(link).toHaveAttribute("href", expectedUrl)
      expect(link.getAttribute("href")).not.toContain("utm_")
    })

    it("uses external URL with UTM params when feature flag is OFF for MITx Online course/program", () => {
      mockUseFeatureFlagEnabled.mockReturnValue(false)

      const resource = makeMitxOnlineResource()
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
      expect(href).toContain("utm_source=mit-learn")
      expect(href).toContain("utm_medium=referral")
    })

    it("uses external URL with UTM params for non-MITx Online course even when flag is ON", () => {
      mockUseFeatureFlagEnabled.mockImplementation(
        (flag) => flag === FeatureFlags.MitxOnlineProductPages,
      )

      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        readable_id: "ocw-course",
        platform: { code: PlatformEnum.Ocw },
        url: "https://ocw.mit.edu/course",
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
      expect(href).toContain("ocw.mit.edu")
      expect(href).toContain("utm_source=mit-learn")
      expect(href).toContain("utm_medium=referral")
      expect(href).not.toContain("/courses/")
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
