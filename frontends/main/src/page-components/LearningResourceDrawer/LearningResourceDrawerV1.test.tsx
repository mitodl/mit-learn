import React from "react"
import {
  expectProps,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@/test-utils"
import LearningResourceDrawerV1 from "./LearningResourceDrawerV1"
import { urls, factories, setMockResponse } from "api/test-utils"
import { LearningResourceExpandedV1 } from "ol-components"
import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { ResourceTypeEnum } from "api"
import invariant from "tiny-invariant"

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    ...actual,
    LearningResourceExpandedV1: jest.fn(actual.LearningResourceExpandedV1),
  }
})

const mockedPostHogCapture = jest.fn()

jest.mock("posthog-js/react", () => ({
  PostHogProvider: (props: { children: React.ReactNode }) => (
    <div data-testid="phProvider">{props.children}</div>
  ),

  usePostHog: () => {
    return { capture: mockedPostHogCapture }
  },
}))

describe("LearningResourceDrawerV1", () => {
  it.each([{ descriptor: "is enabled", enablePostHog: true }])(
    "Renders drawer content when resource=id is in the URL and captures the view if PostHog $descriptor",
    async ({ enablePostHog }) => {
      setMockResponse.get(urls.userMe.get(), {})
      setMockResponse.get(urls.userLists.membershipList(), [])
      setMockResponse.get(urls.learningPaths.membershipList(), [])
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = enablePostHog
        ? "12345abcdef" // pragma: allowlist secret
        : ""
      const resource = factories.learningResources.resource()
      setMockResponse.get(
        urls.learningResources.details({ id: resource.id }),
        resource,
      )

      renderWithProviders(<LearningResourceDrawerV1 />, {
        url: `?dog=woof&${RESOURCE_DRAWER_QUERY_PARAM}=${resource.id}`,
      })
      expect(LearningResourceExpandedV1).toHaveBeenCalled()
      await waitFor(() => {
        expectProps(LearningResourceExpandedV1, {
          resource,
        })
      })
      await screen.findByRole("heading", { name: resource.title })

      if (enablePostHog) {
        expect(mockedPostHogCapture).toHaveBeenCalled()
      } else {
        expect(mockedPostHogCapture).not.toHaveBeenCalled()
      }
    },
  )

  it("Does not render drawer content when resource=id is NOT in the URL", async () => {
    renderWithProviders(<LearningResourceDrawerV1 />, {
      url: "?dog=woof",
    })
    expect(LearningResourceExpandedV1).not.toHaveBeenCalled()
  })

  test.each([
    {
      isLearningPathEditor: true,
      isAuthenticated: true,
      expectAddToLearningPathButton: true,
    },
    {
      isLearningPathEditor: false,
      isAuthenticated: true,
      expectAddToLearningPathButton: false,
    },
    {
      isLearningPathEditor: false,
      isAuthenticated: false,
      expectAddToLearningPathButton: false,
    },
  ])(
    "Renders info section list buttons correctly",
    async ({
      isLearningPathEditor,
      isAuthenticated,
      expectAddToLearningPathButton,
    }) => {
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        runs: [
          factories.learningResources.run({
            languages: ["en-us", "es-es", "fr-fr"],
          }),
        ],
      })
      setMockResponse.get(
        urls.learningResources.details({ id: resource.id }),
        resource,
      )
      const user = factories.user.user({
        is_learning_path_editor: isLearningPathEditor,
      })
      if (isAuthenticated) {
        setMockResponse.get(urls.userMe.get(), user)
      } else {
        setMockResponse.get(urls.userMe.get(), null, { code: 403 })
      }
      setMockResponse.get(urls.userLists.membershipList(), [])
      setMockResponse.get(urls.learningPaths.membershipList(), [])

      renderWithProviders(<LearningResourceDrawerV1 />, {
        url: `?resource=${resource.id}`,
      })

      expect(LearningResourceExpandedV1).toHaveBeenCalled()

      await waitFor(() => {
        expectProps(LearningResourceExpandedV1, { resource })
      })

      const section = screen
        .getByRole("heading", { name: "Info" })
        .closest("section")
      invariant(section)

      const buttons = within(section).getAllByRole("button")
      const expectedButtons = expectAddToLearningPathButton ? 2 : 1
      expect(buttons).toHaveLength(expectedButtons)
      expect(
        !!within(section).queryByRole("button", {
          name: "Add to Learning Path",
        }),
      ).toBe(expectAddToLearningPathButton)
    },
  )
})
