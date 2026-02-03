import {
  screen,
  setMockResponse,
  within,
  renderWithProviders,
} from "@/test-utils"
import { factories, urls } from "api/test-utils"

import { faker } from "@faker-js/faker/locale/en"
import {
  LearningResource,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest,
  LearningResourcesSearchResponse,
  LearningResourcesSearchRetrieveDeliveryEnum,
} from "api"
import React from "react"
import * as mitxonline from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import HomeContent from "./HomeContent"
import invariant from "tiny-invariant"
import * as NextProgressBar from "next-nprogress-bar"

jest.mock("posthog-js/react")
jest.mock("next-nprogress-bar")
const mockedUseFeatureFlagEnabled = jest
  .mocked(useFeatureFlagEnabled)
  .mockImplementation(() => false)

const makeSearchResponse = (
  results: LearningResource[],
): LearningResourcesSearchResponse => {
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
  return responseData
}
const setSearchResponse = (
  params: LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest,
  resources: LearningResource[],
) => {
  const withoutUndefined = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined),
  )
  setMockResponse.get(
    expect.stringContaining(urls.search.resources(withoutUndefined)),
    makeSearchResponse(resources),
  )
}
const COMMON_PARAMS: LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest =
  { resource_type: ["course"], sortby: "-views", limit: 12 }

describe("HomeContent", () => {
  type SetupOpts = {
    preference_search_filters?: {
      topic?: string[]
      certification?: boolean
    }
  }
  const setupAPIs = (opts: SetupOpts = {}) => {
    const preferredDelivery = faker.helpers.arrayElement(
      Object.values(LearningResourcesSearchRetrieveDeliveryEnum),
    )
    const user = factories.user.user({
      profile: {
        preference_search_filters: {
          topic: opts.preference_search_filters?.topic ?? [],
          delivery: [preferredDelivery],
          certification: opts.preference_search_filters?.certification ?? false,
        },
      },
    })
    invariant(user.profile)
    const mitxOnlineUser = mitxonline.factories.user.user()

    invariant(user.profile)
    const courses = factories.learningResources.courses
    const resources = {
      topPicks: courses({ count: 3 }).results,
      certification: courses({ count: 3 }).results,
      free: courses({ count: 3 }).results,
      new: courses({ count: 3 }).results,
      popular: courses({ count: 3 }).results,
      topics: Object.fromEntries(
        user.profile.preference_search_filters.topic?.map((topic) => [
          topic,
          courses({ count: 3 }).results,
        ]) ?? [],
      ),
    }

    setMockResponse.get(urls.userMe.get(), user)
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)
    setMockResponse.get(urls.profileMe.get(), user.profile)

    // Set Top Picks Response
    setSearchResponse(
      {
        certification: user.profile.preference_search_filters.certification,
        delivery: [preferredDelivery],
        topic: user.profile.preference_search_filters.topic,
        ...COMMON_PARAMS,
      },
      resources.topPicks,
    )
    // Set Topic Responses
    user.profile.preference_search_filters.topic?.forEach((t) => {
      setSearchResponse({ topic: [t], ...COMMON_PARAMS }, resources.topics[t])
    })
    // Set Cert / No Cert response
    setSearchResponse(
      { certification: true, ...COMMON_PARAMS },
      resources.certification,
    )
    setSearchResponse({ free: true, ...COMMON_PARAMS }, resources.free)

    // Set Popular, New responses
    setSearchResponse({ limit: 12, sortby: "new" }, resources.new)
    setSearchResponse({ limit: 12, sortby: "-views" }, resources.popular)

    setMockResponse.get(urls.userLists.membershipList(), [])
    setMockResponse.get(urls.learningPaths.membershipList(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )
    return { resources }
  }

  test("Renders title", async () => {
    setupAPIs()
    renderWithProviders(<HomeContent />)

    await screen.findByRole("heading", {
      name: "Your MIT Learning Journey",
    })
  })

  test.each([
    { certification: true, certTitle: "Courses with Certificates" },
    { certification: false, certTitle: "Free courses" },
  ])("Renders expected carousels", async ({ certTitle, certification }) => {
    const topic1 = factories.learningResources.topic()
    const topic2 = factories.learningResources.topic()
    const { resources } = setupAPIs({
      preference_search_filters: {
        topic: [topic1.name, topic2.name],
        certification,
      },
    })
    renderWithProviders(<HomeContent />)

    await screen.findByRole("heading", {
      name: `Popular courses in ${topic1.name}`,
    })
    const carousels = await screen.findAllByTestId("resource-carousel")
    expect(carousels).toHaveLength(6)
    const topPicks = carousels[0]
    const topic1Carousel = carousels[1]
    const topic2Carousel = carousels[2]
    const freeOrCert = carousels[3]
    const recent = carousels[4]
    const popular = carousels[5]

    within(topPicks).getByRole("heading", { name: "Top picks for you" })
    within(topic1Carousel).getByRole("heading", {
      name: `Popular courses in ${topic1.name}`,
    })
    within(topic2Carousel).getByRole("heading", {
      name: `Popular courses in ${topic2.name}`,
    })
    within(freeOrCert).getByRole("heading", { name: certTitle })
    within(recent).getByRole("heading", { name: "New" })
    within(popular).getByRole("heading", { name: "Popular" })

    within(topPicks).getByText(resources.topPicks[0].title)
    within(topPicks).getByText(resources.topPicks[1].title)
    within(topPicks).getByText(resources.topPicks[2].title)

    within(topic1Carousel).getByText(resources.topics[topic1.name][0].title)
    within(topic1Carousel).getByText(resources.topics[topic1.name][1].title)
    within(topic1Carousel).getByText(resources.topics[topic1.name][2].title)

    within(topic2Carousel).getByText(resources.topics[topic2.name][0].title)
    within(topic2Carousel).getByText(resources.topics[topic2.name][1].title)
    within(topic2Carousel).getByText(resources.topics[topic2.name][2].title)

    if (certification) {
      within(freeOrCert).getByText(resources.certification[0].title)
      within(freeOrCert).getByText(resources.certification[1].title)
      within(freeOrCert).getByText(resources.certification[2].title)
    } else {
      within(freeOrCert).getByText(resources.free[0].title)
      within(freeOrCert).getByText(resources.free[1].title)
      within(freeOrCert).getByText(resources.free[2].title)
    }

    within(recent).getByText(resources.new[0].title)
    within(recent).getByText(resources.new[1].title)
    within(recent).getByText(resources.new[2].title)

    within(popular).getByText(resources.popular[0].title)
    within(popular).getByText(resources.popular[1].title)
    within(popular).getByText(resources.popular[2].title)
  })

  test.each([{ enrollmentsEnabled: true }, { enrollmentsEnabled: false }])(
    "Shows enrollments if and only if feature flag is enabled",
    async ({ enrollmentsEnabled }) => {
      setupAPIs()
      mockedUseFeatureFlagEnabled.mockImplementation((flag) => {
        if (flag === "enrollment-dashboard") return enrollmentsEnabled
        return false
      })

      // Mock empty contracts and organizations to avoid org cards rendering
      setMockResponse.get(mitxonline.urls.contracts.contractsList(), [])

      if (enrollmentsEnabled) {
        const enrollments = Array.from({ length: 3 }, () =>
          mitxonline.factories.enrollment.courseEnrollment({
            b2b_contract_id: null, // Personal enrollment, not B2B
          }),
        )
        setMockResponse.get(
          mitxonline.urls.enrollment.enrollmentsListV2(),
          enrollments,
        )
      }

      renderWithProviders(<HomeContent />)

      if (enrollmentsEnabled) {
        await screen.findByRole("heading", { name: "My Learning" })
      } else {
        expect(
          screen.queryByRole("heading", { name: "My Learning" }),
        ).not.toBeInTheDocument()
      }
    },
  )

  test("Does not display enrollment error alert when query param is not present", async () => {
    setupAPIs()
    renderWithProviders(<HomeContent />)

    await screen.findByRole("heading", {
      name: "Your MIT Learning Journey",
    })

    expect(screen.queryByText(/Enrollment Error/)).not.toBeInTheDocument()
  })

  test("Displays enrollment error alert when query param is present and then clears it", async () => {
    setupAPIs()
    const mockReplace = jest.fn()
    jest.spyOn(NextProgressBar, "useRouter").mockReturnValue({
      replace: mockReplace,
    } as Partial<ReturnType<typeof NextProgressBar.useRouter>> as ReturnType<
      typeof NextProgressBar.useRouter
    >)

    renderWithProviders(<HomeContent />, {
      url: "/dashboard?enrollment_error=1",
    })

    await screen.findByRole("heading", {
      name: "Your MIT Learning Journey",
    })

    // Verify the alert was shown
    expect(screen.getByText(/Enrollment Error/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /The Enrollment Code is incorrect or no longer available/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Contact Support")).toBeInTheDocument()

    // Verify the query param is cleared
    expect(mockReplace).toHaveBeenCalledWith("/dashboard")
  })

  test("Does not clear query param when it is not present", async () => {
    setupAPIs()
    const mockReplace = jest.fn()
    jest.spyOn(NextProgressBar, "useRouter").mockReturnValue({
      replace: mockReplace,
    } as Partial<ReturnType<typeof NextProgressBar.useRouter>> as ReturnType<
      typeof NextProgressBar.useRouter
    >)

    renderWithProviders(<HomeContent />, {
      url: "/dashboard",
    })

    await screen.findByRole("heading", {
      name: "Your MIT Learning Journey",
    })

    // Verify router.replace was not called
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
