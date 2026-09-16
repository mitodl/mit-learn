/**
 * @jest-environment @happy-dom/jest-environment
 *
 * Using the Happy DOM environment as the editor accesses DOM APIs and uses
 * contenteditable elements not supported by JSDOM, the default Jest environment.
 */
import React from "react"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import type { JSONContent } from "@tiptap/react"
import { WebsiteContentEditPage } from "./WebsiteContentEditPage"
import { renderWithProviders } from "@/test-utils"

const SERVER_TEXT = "Paragraph as the server has it"

const content: JSONContent = {
  type: "doc",
  content: [
    {
      type: "banner",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Article Title" }],
        },
        { type: "paragraph", content: [] },
      ],
    },
    { type: "byline" },
    { type: "paragraph", content: [{ type: "text", text: SERVER_TEXT }] },
  ],
}

const detailUrl = (id: number) => urls.websiteContent.detailRetrieve(String(id))

/** How many times the page's detail endpoint has been fetched. */
const detailFetchCount = (id: number) =>
  makeRequest.mock.calls.filter(
    (call) =>
      call[0]?.method === "get" &&
      String(call[0]?.url).includes(`/website_content/detail/${id}/`),
  ).length

const setup = async (id: number) => {
  const user = factories.user.user({
    is_authenticated: true,
    is_article_editor: true,
  })
  setMockResponse.get(urls.userMe.get(), user)

  const article = factories.websiteContent.websiteContent({
    id,
    title: "Article Title",
    content,
    content_type: "article",
    is_published: false,
  })
  setMockResponse.get(detailUrl(id), article)

  const topics = factories.learningResources.topics({ count: 1 })
  setMockResponse.get(urls.topics.list({ limit: 1000 }), topics)

  renderWithProviders(
    <WebsiteContentEditPage type="article" idOrSlug={String(id)} />,
    { user },
  )
  await screen.findByTestId("editor")
  return { article, topic: topics.results[0] }
}

/**
 * Save a topic in the drawer and wait for the resulting refetch to land.
 *
 * Both halves matter. The PATCH invalidates the detail query, and the refetch
 * is what used to overwrite the editor -- so a test that asserts before it
 * arrives passes for the wrong reason. The refetched item must also *differ*
 * from the cached one, or React Query's structural sharing hands back the same
 * object and nothing downstream re-runs; saving a topic changes it in exactly
 * that way, which is why this is the payload the server would now return.
 */
const saveTopicInDrawer = async (
  article: { id: number },
  topic: { id: number; name: string },
) => {
  setMockResponse.patch(urls.websiteContent.details(article.id), {
    ...article,
    topics: [topic.id],
  })
  setMockResponse.get(detailUrl(article.id), {
    ...article,
    topics: [topic.id],
  })

  const fetchesBefore = detailFetchCount(article.id)

  await userEvent.click(await screen.findByRole("button", { name: "Settings" }))
  await userEvent.click(await screen.findByLabelText("Topic"))
  await userEvent.click(await screen.findByRole("option", { name: topic.name }))
  await userEvent.click(await screen.findByRole("button", { name: "Add" }))
  await userEvent.click(
    await screen.findByRole("button", { name: "Save Settings" }),
  )

  await waitFor(() =>
    expect(detailFetchCount(article.id)).toBeGreaterThan(fetchesBefore),
  )
}

/**
 * Typing appends rather than replaces here -- happy-dom does not honour the
 * select-all that would clear the node first -- so these match on a substring
 * of the resulting text rather than the whole of it.
 */
describe("WebsiteContentEditPage settings drawer", () => {
  test("saving the drawer keeps unsaved body edits", async () => {
    const { article, topic } = await setup(601)

    await userEvent.click(await screen.findByText(SERVER_TEXT))
    await userEvent.type(
      await screen.findByText(SERVER_TEXT),
      " plus a pending edit",
    )
    const editor = screen.getByTestId("editor")
    await within(editor).findByText(/plus a pending edit/)

    await saveTopicInDrawer(article, topic)

    expect(await within(editor).findByText(/plus a pending edit/)).toBeVisible()
  })

  test("saving the drawer keeps an unsaved title edit", async () => {
    const { article, topic } = await setup(602)

    const heading = await screen.findByRole("heading", { level: 1 })
    await userEvent.click(heading)
    await userEvent.type(heading, " Retitled")
    await screen.findByRole("heading", { level: 1, name: /Retitled/ })

    await saveTopicInDrawer(article, topic)

    expect(
      await screen.findByRole("heading", { level: 1, name: /Retitled/ }),
    ).toBeVisible()
  })

  test("the topic saved in the drawer is still selected when it reopens", async () => {
    const { article, topic } = await setup(603)

    await saveTopicInDrawer(article, topic)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await screen.findByRole("button", { name: `Remove ${topic.name}` })
  })
})
