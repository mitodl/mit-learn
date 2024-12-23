import React from "react"
import {
  expectProps,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@/test-utils"
import LearningResourceDrawerV2 from "./LearningResourceDrawerV2"
import { urls, factories, setMockResponse } from "api/test-utils"
import { LearningResourceExpandedV2 } from "ol-components"
import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { CourseResource, LearningResource, ResourceTypeEnum } from "api"
import { ControlledPromise } from "ol-test-utilities"

jest.mock("ol-components", () => {
  const actual = jest.requireActual("ol-components")
  return {
    ...actual,
    LearningResourceExpandedV2: jest.fn(actual.LearningResourceExpandedV2),
  }
})

const makeSearchResponse = (results: CourseResource[] | LearningResource[]) => {
  const responseData = {
    metadata: {
      suggestions: [],
      aggregations: {},
    },
    count: results.length,
    results: results,
    next: null,
    previous: null,
  }
  const promise = new ControlledPromise()
  promise.resolve(responseData)
  return responseData
}

const setupApis = (resource: LearningResource) => {
  setMockResponse.get(
    urls.learningResources.details({ id: resource.id }),
    resource,
  )
  const count = 10
  const similarResources = factories.learningResources.resources({
    count,
  }).results
  setMockResponse.get(urls.userMe.get(), null, { code: 403 })
  setMockResponse.get(
    urls.learningResources.details({ id: resource.id }),
    resource,
  )
  setMockResponse.get(
    urls.learningResources.vectorSimilar({ id: resource.id }),
    similarResources,
  )
  const topicsCourses: CourseResource[] = []
  resource.topics?.forEach((topic) => {
    const topicCourses = factories.learningResources.courses({ count: 10 })
    topicCourses.results.map((course) => {
      course.topics = [factories.learningResources.topic({ name: topic.name })]
    })
    topicsCourses.push(...topicCourses.results)
  })
  resource.topics?.forEach((topic) => {
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({
          limit: 12,
          resource_type: ["course"],
          sortby: "-views",
          topic: [topic.name],
        }),
      ),
      makeSearchResponse(
        topicsCourses.filter(
          (course) => course.topics?.[0].name === topic.name,
        ),
      ),
    )
  })
  return { resource, similarResources }
}

describe("LearningResourceDrawerV2", () => {
  it.each([
    { descriptor: "is enabled", enablePostHog: true },
    { descriptor: "is not enabled", enablePostHog: false },
  ])(
    "Renders drawer content when resource=id is in the URL and captures the view if PostHog $descriptor",
    async ({ enablePostHog }) => {
      setMockResponse.get(urls.userMe.get(), {})
      setMockResponse.get(urls.userLists.membershipList(), [])
      setMockResponse.get(urls.learningPaths.membershipList(), [])
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = enablePostHog
        ? "12345abcdef" // pragma: allowlist secret
        : ""
      const resource = factories.learningResources.resource()
      setupApis(resource)

      renderWithProviders(<LearningResourceDrawerV2 />, {
        url: `?dog=woof&${RESOURCE_DRAWER_QUERY_PARAM}=${resource.id}`,
      })
      expect(LearningResourceExpandedV2).toHaveBeenCalled()
      await waitFor(() => {
        expectProps(LearningResourceExpandedV2, { resource })
      })
      await screen.findByText(resource.title)
    },
  )

  it("Does not render drawer content when resource=id is NOT in the URL", async () => {
    renderWithProviders(<LearningResourceDrawerV2 />, {
      url: "?dog=woof",
    })
    expect(LearningResourceExpandedV2).not.toHaveBeenCalled()
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
      const resource = factories.learningResources.resource({
        resource_type: ResourceTypeEnum.Course,
        runs: [
          factories.learningResources.run({
            languages: ["en-us", "es-es", "fr-fr"],
          }),
        ],
      })
      setupApis(resource)
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

      renderWithProviders(<LearningResourceDrawerV2 />, {
        url: `?resource=${resource.id}`,
      })

      expect(LearningResourceExpandedV2).toHaveBeenCalled()

      await waitFor(() => {
        expectProps(LearningResourceExpandedV2, { resource })
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
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
      runs: [
        factories.learningResources.run({
          languages: ["en-us", "es-es", "fr-fr"],
        }),
      ],
    })
    const { similarResources } = setupApis(resource)
    renderWithProviders(<LearningResourceDrawerV2 />, {
      url: `?resource=${resource.id}`,
    })
    await screen.findByText("Similar Learning Resources")
    for (const similarResource of similarResources) {
      await screen.findByText(similarResource.title)
    }
  })
})
