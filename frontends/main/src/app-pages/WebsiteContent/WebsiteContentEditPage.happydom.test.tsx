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
import { websiteContentEditView } from "@/common/urls"
import { renderWithProviders } from "@/test-utils"

/**
 * Mounting the editor and driving a multi-step interaction through it is slow:
 * happy-dom plus a real ProseMirror instance, then a drawer save and the
 * refetch it triggers. On an unloaded dev machine each test here runs in about
 * a second, but CI gives every worker a core and runs them all at once, and
 * there the same tests land close enough to Jest's 5s default to trip it
 * intermittently -- they timed out on main before this branch existed. The
 * timeout is what the act(...) warnings in those runs came from, too: the test
 * is torn down while the editor is still mounting, so its state update lands
 * outside any act() scope.
 */
jest.setTimeout(20000)

/**
 * The page navigates through `next-nprogress-bar`'s wrapper rather than
 * `next/navigation` directly, so this is where a push can be observed --
 * spying on the memory router does not see it. The wrapper's own same-URL
 * check only suppresses the progress bar; it still pushes.
 *
 * Referenced lazily so the factory, which jest hoists above these imports,
 * does not read `routerMocks` before it exists.
 */
jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => routerMocks.push(...args),
  }),
}))

const routerMocks = { push: jest.fn() }

beforeEach(() => {
  routerMocks.push.mockClear()
})

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
    { user, url: websiteContentEditView("article", id) },
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
describe("WebsiteContentEditPage navigation", () => {
  test("a draft save does not re-navigate to the page it is already on", async () => {
    const { article } = await setup(4242)
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    /**
     * A draft writes itself every couple of seconds, and this page reads its
     * item through React Query -- which the mutation already invalidates. So
     * pushing the route we are on buys nothing and costs a soft navigation
     * and a run of the progress bar each time.
     */
    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "patch" }),
        )
      },
      { timeout: 6000 },
    )

    expect(routerMocks.push).not.toHaveBeenCalled()
  })
})

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
