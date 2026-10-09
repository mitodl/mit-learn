import React from "react"
import { screen, waitFor } from "@testing-library/react"
import { factories, setMockResponse, urls, makeRequest } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import TopicFeaturedCarousel, { FEATURED_COUNT } from "./TopicFeaturedCarousel"

const CHANNEL_NAME = "data-science"

const featuredUrl = () =>
  `${urls.channels.featured("topic", CHANNEL_NAME)}?limit=${FEATURED_COUNT}`

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
   * The row is curated through the channel's learning path rather than
   * queried, so what it shows is whatever an editor put there -- in that order.
   */
  test("shows the channel's featured resources", async () => {
    mockUser()
    const resources = factories.learningResources.resources({ count: 3 })
    setMockResponse.get(featuredUrl(), resources)

    renderWithProviders(<TopicFeaturedCarousel name={CHANNEL_NAME} />)

    await screen.findByRole("heading", { name: "Featured" })
    for (const resource of resources.results) {
      await screen.findByText(resource.title)
    }
  })

  /**
   * An empty "Featured" heading above a blank strip reads as a page that
   * failed to load, and the hero spaces its children 64px apart, so an empty
   * row would also leave a gap. A channel featuring nothing gets no row.
   */
  test("renders nothing when the channel features nothing", async () => {
    mockUser()
    setMockResponse.get(featuredUrl(), {
      count: 0,
      next: null,
      previous: null,
      results: [],
    })

    renderWithProviders(<TopicFeaturedCarousel name={CHANNEL_NAME} />)

    await waitFor(() => {
      expect(screen.queryByText("Featured")).toBe(null)
    })
  })

  test("renders nothing, and asks for nothing, without a channel name", async () => {
    renderWithProviders(<TopicFeaturedCarousel name="" />)

    expect(screen.queryByText("Featured")).toBe(null)
    await waitFor(() => {
      expect(makeRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "get" }),
      )
    })
  })

  test("asks the channel's own endpoint for enough items to page through", async () => {
    mockUser()
    const resources = factories.learningResources.resources({ count: 1 })
    setMockResponse.get(featuredUrl(), resources)

    renderWithProviders(<TopicFeaturedCarousel name={CHANNEL_NAME} />)

    /* Four are on screen at desktop width; the rest are what the arrows page
       through, so the request has to cover more than one screenful. */
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(
            `/channels/type/topic/${CHANNEL_NAME}/featured/`,
          ),
        }),
      )
    })
    expect(FEATURED_COUNT).toBeGreaterThan(4)
  })
})
