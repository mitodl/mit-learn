/**
 * @jest-environment @happy-dom/jest-environment
 */
import React from "react"
import { screen } from "@testing-library/react"
import type { JSONContent } from "@tiptap/react"
import { setMockResponse, factories, urls } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import { NewsEditor } from "../../../contentTypes/news/NewsEditor"

describe("LearningResourceProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  /**
   * The cards' data must not be written back into the query cache during
   * render. When it was, every render rewrote the cards' detail queries, which
   * re-rendered the provider, which rewrote them again: React gave up with
   * "Maximum update depth exceeded" and the page showed the error page.
   *
   * Each rewrite only differs from the last by its `Date.now()` stamp, so on a
   * fast machine the loop could settle by itself. The clock here moves on every
   * read so the test fails reliably if the loop comes back; React's error
   * reaches `console.error`, which fails the test.
   */
  test("renders a read-only news item's resource cards without a render loop", async () => {
    let now = Date.now()
    jest.spyOn(Date, "now").mockImplementation(() => (now += 1))
    setMockResponse.get(
      urls.userMe.get(),
      factories.user.user({ is_authenticated: false }),
    )

    const resources = factories.learningResources.resources({ count: 3 })
    const ids = resources.results.map((resource) => resource.id)
    setMockResponse.get(
      urls.learningResources.list({ resource_id: ids }),
      resources,
    )

    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "banner",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "News with cards" }],
            },
            { type: "paragraph", content: [] },
          ],
        },
        { type: "byline" },
        ...ids.map((resourceId) => ({
          type: "learningResource",
          attrs: { resourceId },
        })),
      ],
    }
    const newsItem = factories.websiteContent.websiteContent({
      content,
      is_published: true,
    })

    renderWithProviders(<NewsEditor newsItem={newsItem} readOnly />)

    for (const resource of resources.results) {
      expect(await screen.findByText(resource.title)).toBeInTheDocument()
    }
  })
})
