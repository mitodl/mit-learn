import React from "react"
import { screen, waitFor } from "@testing-library/react"
import { factories, setMockResponse, urls, makeRequest } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import TopicFeaturedCarousel, { FEATURED_COUNT } from "./TopicFeaturedCarousel"

const LEARNING_PATH_ID = 227

const setLearningPathId = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_FEATURED_LIST_LEARNINGPATH_ID
  } else {
    process.env.NEXT_PUBLIC_FEATURED_LIST_LEARNINGPATH_ID = value
  }
}

const previous = process.env.NEXT_PUBLIC_FEATURED_LIST_LEARNINGPATH_ID
afterEach(() => setLearningPathId(previous))

/** What the carousel requests: the helper takes no limit, so it is appended. */
const itemsUrl = () =>
  `${urls.learningResources.items({ id: LEARNING_PATH_ID })}?limit=${FEATURED_COUNT}`

/**
 * What a rendered resource card reads besides the resource itself: the current
 * user and their list membership, both for the bookmark control.
 */
const mockUser = () => {
  setMockResponse.get(urls.userMe.get(), factories.user.user())
  setMockResponse.get(urls.userLists.membershipList(), [])
  setMockResponse.get(urls.learningPaths.membershipList(), [])
}

describe("TopicFeaturedCarousel", () => {
  /**
   * The row is curated through a learning path rather than queried, so what it
   * shows is whatever an editor put in that path -- in that order.
   */
  test("shows the configured learning path's items", async () => {
    setLearningPathId(String(LEARNING_PATH_ID))
    mockUser()
    const resources = factories.learningResources.resources({ count: 3 })
    setMockResponse.get(
      itemsUrl(),
      {
        count: resources.results.length,
        next: null,
        previous: null,
        results: resources.results.map((resource, position) => ({
          id: position + 1,
          position,
          parent: LEARNING_PATH_ID,
          child: resource.id,
          resource,
        })),
      },
      { requestBody: undefined },
    )

    renderWithProviders(<TopicFeaturedCarousel />)

    await screen.findByRole("heading", { name: "Featured" })
    for (const resource of resources.results) {
      await screen.findByText(resource.title)
    }
  })

  /**
   * An empty "Featured" heading above a blank strip reads as a page that
   * failed to load, and the sections below it stand on their own -- so an
   * unconfigured environment gets no row rather than an empty one.
   */
  test.each([
    { value: undefined, label: "unset" },
    { value: "", label: "blank" },
    { value: "0", label: "zero" },
  ])("renders nothing when the id is $label", async ({ value }) => {
    setLearningPathId(value)

    renderWithProviders(<TopicFeaturedCarousel />)

    expect(screen.queryByText("Featured")).toBe(null)
    // And asks the API for nothing: a request for learning path 0 or NaN
    // could only 404.
    await waitFor(() => {
      expect(makeRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "get" }),
      )
    })
  })

  test("asks for enough items to page through", async () => {
    setLearningPathId(String(LEARNING_PATH_ID))
    mockUser()
    setMockResponse.get(
      itemsUrl(),
      { count: 0, next: null, previous: null, results: [] },
      { requestBody: undefined },
    )

    renderWithProviders(<TopicFeaturedCarousel />)

    /* Four are on screen at desktop width; the rest are what the arrows page
       through, so the request has to cover more than one screenful. */
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(`/${LEARNING_PATH_ID}/items/`),
        }),
      )
    })
    expect(FEATURED_COUNT).toBeGreaterThan(4)
  })
})
