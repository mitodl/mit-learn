import {
  screen,
  waitFor,
  setMockResponse,
  within,
  renderWithProviders,
} from "@/test-utils"
import { factories, urls } from "api/test-utils"
import { Permission } from "api/hooks/user"
import DashboardPage, {
  DashboardTabKeys,
  DashboardTabLabels,
} from "./DashboardPage"
import { faker } from "@faker-js/faker/locale/en"
import {
  CourseResource,
  LearningResource,
  LearningResourcesSearchRetrieveDeliveryEnum,
} from "api"
import { ControlledPromise } from "ol-test-utilities"
import React from "react"
import { DASHBOARD_HOME, MY_LISTS, PROFILE } from "@/common/urls"

describe("DashboardPage", () => {
  const makeSearchResponse = (
    results: CourseResource[] | LearningResource[],
  ) => {
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

  const setupAPIs = () => {
    const profile = factories.user.profile({
      preference_search_filters: {
        topic: factories.learningResources
          .topics({ count: 3 })
          .results.map((topic) => topic.name),
        certification: faker.helpers.arrayElement([true, false]),
        delivery: faker.helpers.arrayElements([
          "online",
          "in-person",
          "hybrid",
          "offline",
        ]),
      },
    })
    const certification: boolean | undefined =
      profile?.preference_search_filters.certification
    const topics = profile?.preference_search_filters.topic
    const delivery = Object.values(
      LearningResourcesSearchRetrieveDeliveryEnum,
    ).filter((format) =>
      profile?.preference_search_filters.delivery?.includes(format),
    )

    const topPicks = factories.learningResources.courses({ count: 10 })

    topPicks.results.forEach((course) => {
      course.topics = topics?.map((topic) =>
        factories.learningResources.topic({ name: topic }),
      )
      course.certification = certification || false
      course.delivery = delivery.map((format) =>
        format
          ? { code: format, name: format }
          : { code: "online", name: "Online" },
      )
    })

    const topicsCourses: CourseResource[] = []
    topics?.forEach((topic) => {
      const topicCourses = factories.learningResources.courses({ count: 10 })
      topicCourses.results.map((course) => {
        course.topics = [factories.learningResources.topic({ name: topic })]
      })
      topicsCourses.push(...topicCourses.results)
    })
    const certificationCourses = factories.learningResources.courses({
      count: 10,
    })
    certificationCourses.results.map((course) => {
      course.certification = certification || false
    })
    const freeCourses = factories.learningResources.courses({
      count: 10,
    })
    freeCourses.results.map((course) => {
      course.free = true
    })
    const courses = [
      ...topPicks.results,
      ...topicsCourses,
      ...certificationCourses.results,
      ...freeCourses.results,
    ]
    const resources = factories.learningResources.resources({ count: 20 })

    setMockResponse.get(urls.userMe.get(), {
      username: profile.username,
      [Permission.Authenticated]: true,
    })
    setMockResponse.get(urls.profileMe.get(), profile)
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({
          certification: certification,
          delivery: delivery,
          limit: 12,
          resource_type: ["course"],
          sortby: "-views",
          topic: topics,
        }),
      ),
      makeSearchResponse(topPicks.results),
    )
    topics?.forEach((topic) => {
      setMockResponse.get(
        expect.stringContaining(
          urls.search.resources({
            limit: 12,
            resource_type: ["course"],
            sortby: "-views",
            topic: [topic],
          }),
        ),
        makeSearchResponse(
          topicsCourses.filter((course) => course.topics?.[0].name === topic),
        ),
      )
    })
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({
          certification: certification,
          limit: 12,
          resource_type: ["course"],
          sortby: "-views",
        }),
      ),
      makeSearchResponse(certificationCourses.results),
    )
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({
          free: true,
          limit: 12,
          resource_type: ["course"],
          sortby: "-views",
        }),
      ),
      makeSearchResponse(freeCourses.results),
    )
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({ limit: 12, sortby: "new" }),
      ),
      makeSearchResponse([...courses, ...resources.results]),
    )
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({ limit: 12, sortby: "-views" }),
      ),
      makeSearchResponse([...courses, ...resources.results]),
    )
    setMockResponse.get(
      expect.stringContaining(
        urls.search.resources({
          limit: 12,
          resource_type: ["course"],
          sortby: "-views",
        }),
      ),
      makeSearchResponse(courses),
    )
    setMockResponse.get(urls.userLists.membershipList(), [])
    setMockResponse.get(urls.learningPaths.membershipList(), [])
    return {
      profile,
      topPicks,
      topicsCourses,
      certificationCourses,
      freeCourses,
      courses,
      resources,
    }
  }

  test("Renders title", async () => {
    setupAPIs()
    renderWithProviders(<DashboardPage />)
    await screen.findByRole("heading", {
      name: "Your MIT Learning Journey",
    })
  })

  test("Renders user info", async () => {
    setupAPIs()
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
      first_name: "Joe",
      last_name: "Smith",
      profile: {
        name: "Jane Smith",
      },
    })

    renderWithProviders(<DashboardPage />)
    await waitFor(() => {
      /**
       * There should be two instances of "Jane Smith" text,
       * one in the header and one in the main content
       */
      const userInfoText = screen.getByText("Jane Smith")
      expect(userInfoText).toBeInTheDocument()
    })
  })

  test("Renders user menu tabs and panels", async () => {
    setupAPIs()
    renderWithProviders(<DashboardPage />)
    const tabLists = await screen.findAllByRole("tablist")
    const desktopTabList = await screen.findByTestId("desktop-tab-list")
    const mobileTabList = await screen.findByTestId("mobile-tab-list")
    const desktopTabs = await within(desktopTabList).findAllByRole("tab")
    const mobileTabs = await within(mobileTabList).findAllByRole("tab")
    const tabPanels = await screen.findAllByRole("tabpanel", { hidden: true })
    // 1 for mobile, 1 for desktop
    expect(tabLists).toHaveLength(2)
    expect(mobileTabs).toHaveLength(4)
    expect(desktopTabs).toHaveLength(4)
    expect(tabPanels).toHaveLength(4)
    Object.values(DashboardTabLabels).forEach((label) => {
      const desktopLabel = within(desktopTabList).getByText(label)
      const mobileLabel = within(mobileTabList).getByText(label)
      expect(desktopLabel).toBeInTheDocument()
      expect(mobileLabel).toBeInTheDocument()
    })
  })

  test("Renders the expected tab links", async () => {
    setupAPIs()
    renderWithProviders(<DashboardPage />)
    const urls = [DASHBOARD_HOME, MY_LISTS, PROFILE]
    urls.forEach((url: string) => {
      const key = DashboardTabKeys[url as keyof typeof DashboardTabKeys]
      const desktopTab = screen.getByTestId(`desktop-tab-${key}`)
      const mobileTab = screen.getByTestId(`mobile-tab-${key}`)
      expect(desktopTab).toBeInTheDocument()
      expect(mobileTab).toBeInTheDocument()
      expect(desktopTab).toHaveAttribute("href", url)
      expect(mobileTab).toHaveAttribute("href", url)
    })
  })

  test("Renders the expected carousels on the dashboard", async () => {
    const {
      profile,
      topPicks,
      topicsCourses,
      certificationCourses,
      freeCourses,
      courses,
      resources,
    } = setupAPIs()
    const all = [...courses, ...resources.results]
    renderWithProviders(<DashboardPage />)

    const topPicksTitle = await screen.findByText("Top picks for you")
    expect(topPicksTitle).toBeInTheDocument()

    await Promise.all(
      topPicks.results.map((course) => {
        return screen.findAllByText(course.title)
      }),
    )

    profile.preference_search_filters.topic?.forEach(async (topic) => {
      const topicTitle = await screen.findByText(`Popular courses in ${topic}`)
      expect(topicTitle).toBeInTheDocument()
      const topicCarousel = await screen.findByTestId(`topic-carousel-${topic}`)
      topicsCourses
        .filter((course) => course.topics?.[0].name === topic)
        .forEach(async (course) => {
          const courseTitle = await within(topicCarousel).findByText(
            course.title,
          )
          expect(courseTitle).toBeInTheDocument()
        })
    })

    const certificationDesired = profile.preference_search_filters.certification
    if (certificationDesired) {
      const certificationText = "Courses with Certificates"
      const certificationTitle = await screen.findByText(certificationText)
      expect(certificationTitle).toBeInTheDocument()
      const certificationCarousel = await screen.findByTestId(
        "certification-carousel",
      )
      certificationCourses.results.forEach(async (course) => {
        const courseTitle = await within(certificationCarousel).findByText(
          course.title,
        )
        expect(courseTitle).toBeInTheDocument()
      })
    } else {
      const freeText = "Free courses"
      const freeTitle = await screen.findByText(freeText)
      expect(freeTitle).toBeInTheDocument()
      const freeCarousel = await screen.findByTestId("free-carousel")
      freeCourses.results.forEach(async (course) => {
        const courseTitle = await within(freeCarousel).findByText(course.title)
        expect(courseTitle).toBeInTheDocument()
      })
    }

    const newTitle = await screen.findByText("New")
    expect(newTitle).toBeInTheDocument()
    const newCarousel = await screen.findByTestId(
      "new-learning-resources-carousel",
    )
    all.forEach(async (learningResource) => {
      const courseTitle = await within(newCarousel).findByText(
        learningResource.title,
      )
      expect(courseTitle).toBeInTheDocument()
    })

    const popularTitle = await screen.findByText("Popular")
    expect(popularTitle).toBeInTheDocument()
    const popularCarousel = await screen.findByTestId(
      "popular-learning-resources-carousel",
    )
    all.forEach(async (learningResource) => {
      const courseTitle = await within(popularCarousel).findByText(
        learningResource.title,
      )
      expect(courseTitle).toBeInTheDocument()
    })
  }, 10000)
})
