import React from "react"
import {
  expectProps,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@/test-utils"
import LearningResourceDrawer from "./LearningResourceDrawer"
import { urls, factories, setMockResponse } from "api/test-utils"
import { LearningResourceExpanded } from "../LearningResourceExpanded/LearningResourceExpanded"
import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { LearningResource, ResourceTypeEnum } from "api"
import { makeUserSettings } from "@/test-utils/factories"
import type { User } from "api/hooks/user"
import { usePostHog } from "posthog-js/react"

jest.mock("./LearningResourceExpanded", () => {
  const actual = jest.requireActual("./LearningResourceExpanded")
  return {
    ...actual,
    LearningResourceExpanded: jest.fn(actual.LearningResourceExpanded),
  }
})

const mockedPostHogCapture = jest.fn()
jest.mock("posthog-js/react")
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockedPostHogCapture },
)

describe("LearningResourceDrawer", () => {
  const setupApis = (
    overries: {
      user?: Partial<User>
      resource?: Partial<LearningResource>
    } = {},
  ) => {
    const user = makeUserSettings(overries.user)
    const resource = factories.learningResources.resource(overries.resource)
    if (user.is_authenticated) {
      setMockResponse.get(urls.userMe.get(), user)
      setMockResponse.get(urls.userLists.membershipList(), [])
    } else {
      setMockResponse.get(urls.userMe.get(), null, { code: 403 })
    }
    if (user.is_learning_path_editor) {
      setMockResponse.get(urls.learningPaths.membershipList(), [])
    }

    setMockResponse.get(
      urls.learningResources.details({ id: resource.id }),
      resource,
    )
    setMockResponse.get(
      urls.learningResources.vectorSimilar({ id: resource.id }),
      [],
    )

    if (
      resource.resource_type === ResourceTypeEnum.Program ||
      resource.resource_type === ResourceTypeEnum.VideoPlaylist ||
      resource.resource_type === ResourceTypeEnum.Podcast
    ) {
      const relationships =
        factories.learningResources.learningResourceRelationships({
          count: 3,
          parent: resource.id,
        })

      setMockResponse.get(
        `${urls.learningResources.items({ id: resource.id })}?limit=12`,
        relationships,
      )

      return { resource, user }
    }

    return { resource, user }
  }

  it.each([
    { descriptor: "is enabled", enablePostHog: true },
    { descriptor: "is not enabled", enablePostHog: false },
  ])(
    "Renders drawer content when resource=id is in the URL and captures the view if PostHog $descriptor",
    async ({ enablePostHog }) => {
      const { resource } = setupApis()
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = enablePostHog
        ? "12345abcdef" // pragma: allowlist secret
        : ""

      renderWithProviders(<LearningResourceDrawer />, {
        url: `?dog=woof&${RESOURCE_DRAWER_QUERY_PARAM}=${resource.id}`,
      })
      expect(LearningResourceExpanded).toHaveBeenCalled()
      await waitFor(() => {
        expectProps(LearningResourceExpanded, { resource })
      })
      await screen.findByText(resource.title)

      if (enablePostHog) {
        expect(mockedPostHogCapture).toHaveBeenCalled()
      } else {
        expect(mockedPostHogCapture).not.toHaveBeenCalled()
      }
    },
  )

  it("Does not render drawer content when resource=id is NOT in the URL", async () => {
    renderWithProviders(<LearningResourceDrawer />, {
      url: "?dog=woof",
    })
    expect(LearningResourceExpanded).not.toHaveBeenCalled()
  })

  test("Drawer is a dialog and has title", async () => {
    const { resource } = setupApis({
      resource: {
        resource_type: ResourceTypeEnum.Course,
      },
    })
    renderWithProviders(<LearningResourceDrawer />, {
      url: `?resource=${resource.id}`,
    })
    await screen.findByRole("dialog", {
      name: `Course ${resource.title}`,
    })
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
    "Renders call to action section list buttons correctly",
    async ({
      isLearningPathEditor,
      isAuthenticated,
      expectAddToLearningPathButton,
    }) => {
      const { resource } = setupApis({
        user: {
          is_authenticated: isAuthenticated,
          is_learning_path_editor: isLearningPathEditor,
        },
        resource: {
          resource_type: ResourceTypeEnum.Course,
          runs: [
            factories.learningResources.run({
              languages: ["en-us", "es-es", "fr-fr"],
            }),
          ],
        },
      })

      renderWithProviders(<LearningResourceDrawer />, {
        url: `?resource=${resource.id}`,
      })

      expect(LearningResourceExpanded).toHaveBeenCalled()

      await waitFor(() => {
        expectProps(LearningResourceExpanded, { resource })
      })

      const section = screen.getByTestId("drawer-cta")

      const buttons = within(section).getAllByRole("button")
      const expectedButtons = expectAddToLearningPathButton ? 3 : 2
      expect(buttons).toHaveLength(expectedButtons)
      expect(
        !!within(section).queryByRole("button", {
          name: "Add to list",
        }),
      ).toBe(expectAddToLearningPathButton)
    },
  )

  it("Renders similar resource carousels", async () => {
    const { resource } = setupApis({
      resource: {
        resource_type: ResourceTypeEnum.Course,
        runs: [
          factories.learningResources.run({
            languages: ["en-us", "es-es", "fr-fr"],
          }),
        ],
      },
    })
    const similarResources = factories.learningResources.resources({
      count: 10,
    }).results

    setMockResponse.get(
      urls.learningResources.vectorSimilar({ id: resource.id }),
      similarResources,
    )

    renderWithProviders(<LearningResourceDrawer />, {
      url: `?resource=${resource.id}`,
    })
    await screen.findByText("Similar Learning Resources")
    await screen.findAllByText((text) =>
      similarResources.some((r) => text.includes(r.title)),
    )
  })
})
