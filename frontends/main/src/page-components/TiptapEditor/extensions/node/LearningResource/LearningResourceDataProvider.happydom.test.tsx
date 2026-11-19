/**
 * @jest-environment @happy-dom/jest-environment
 */
import React from "react"
import { act, screen, waitFor } from "@testing-library/react"
import type { Editor, JSONContent } from "@tiptap/react"
import type { LearningResource } from "api"
import { setMockResponse, factories, urls } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import { NewsEditor } from "../../../contentTypes/news/NewsEditor"

const contentWithCards = (ids: number[]): JSONContent => ({
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
})

const listResponse = (results: LearningResource[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

/**
 * Renders a published news item holding a card for each of `resources`:
 * read-only as a visitor sees it, or in the editor. Published, so nothing
 * autosaves.
 */
const setup = async (
  resources: LearningResource[],
  { readOnly }: { readOnly: boolean },
) => {
  const user = readOnly
    ? factories.user.user({ is_authenticated: false })
    : factories.user.user({ is_authenticated: true, is_article_editor: true })
  setMockResponse.get(urls.userMe.get(), user)
  setMockResponse.get(urls.userLists.membershipList(), [])
  setMockResponse.get(urls.learningPaths.membershipList(), [])
  const ids = resources.map((resource) => resource.id)
  setMockResponse.get(
    urls.learningResources.list({ resource_id: ids }),
    listResponse(resources),
  )
  const newsItem = factories.websiteContent.websiteContent({
    content: contentWithCards(ids),
    is_published: true,
  })
  renderWithProviders(<NewsEditor newsItem={newsItem} readOnly={readOnly} />, {
    user,
  })
  for (const resource of resources) {
    expect(await screen.findByText(resource.title)).toBeInTheDocument()
  }
  const editor = (
    document.querySelector(".ProseMirror") as HTMLElement & { editor: Editor }
  ).editor
  return { ids, editor }
}

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
    await setup(factories.learningResources.resources({ count: 3 }).results, {
      readOnly: true,
    })
  })

  test("fills in a card added to the document", async () => {
    const [first, second, added] = factories.learningResources.resources({
      count: 3,
    }).results
    const { ids, editor } = await setup([first, second], { readOnly: false })
    // Held open so the test can look at the cards while the new list loads.
    let respond = () => {}
    const response = new Promise<void>((resolve) => {
      respond = resolve
    }).then(() => listResponse([first, second, added]))
    setMockResponse.get(
      urls.learningResources.list({ resource_id: [...ids, added.id] }),
      response,
    )

    act(() => {
      editor.chain().focus("end").insertLearningResource(added.id).run()
    })

    // While the new list loads, only the added card is a skeleton.
    await waitFor(() => {
      const skeletonCards = [
        ...document.querySelectorAll(".node-learningResource"),
      ].filter((card) => card.querySelector(".MuiSkeleton-root"))
      expect(skeletonCards).toHaveLength(1)
    })
    expect(screen.getByText(first.title)).toBeInTheDocument()
    expect(screen.getByText(second.title)).toBeInTheDocument()

    await act(async () => respond())
    expect(await screen.findByText(added.title)).toBeInTheDocument()
    expect(screen.getByText(first.title)).toBeInTheDocument()
    expect(screen.getByText(second.title)).toBeInTheDocument()
  })
})
