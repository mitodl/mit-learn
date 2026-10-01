/**
 * @jest-environment @happy-dom/jest-environment
 *
 * Using the Happy DOM environment as the editor accesses DOM APIs and uses
 * contenteditable elements not supported by JSDOM, the default Jest environment.
 */
import React from "react"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import { WebsiteContentNewPage } from "./WebsiteContentNewPage"
import { websiteContentEditView } from "@/common/urls"
import { renderWithProviders } from "@/test-utils"

/** Mounting a real ProseMirror in happy-dom and waiting out a save. */
jest.setTimeout(30000)

/**
 * The page navigates through `next-nprogress-bar`'s wrapper rather than
 * `next/navigation` directly, so this is where a push can be observed --
 * spying on the memory router does not see it. The wrapper's own same-URL
 * check only suppresses the progress bar; it still pushes.
 */
jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => routerMocks.push(...args),
  }),
}))

const routerMocks = { push: jest.fn() }

beforeEach(() => {
  routerMocks.push.mockClear()
  window.history.replaceState({}, "", "/website_content/article/new")
})

/** What production uses; this test waits it out deliberately. */
const AUTOSAVE_DELAY_MS = 2000

describe("WebsiteContentNewPage autosave", () => {
  /**
   * The first autosave of something new is what gives it a URL, and it lands
   * while the author is still typing. Navigating there would take the editor
   * down mid-sentence -- the caret goes, and the next route shows a spinner
   * while it fetches the item the editor is already holding. To the author the
   * page reloaded under them.
   *
   * Only the absence of the push can be asserted here, not the absence of the
   * remount: the router is mocked, so a `push` would not actually unmount
   * anything in this environment. The push is the cause, so it is the thing
   * worth pinning.
   */
  test("the created draft's URL is adopted without navigating", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.websiteContent.websiteContent({
      id: 777,
      content_type: "article",
      is_published: false,
    })
    setMockResponse.post(urls.websiteContent.list(), article)
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    renderWithProviders(
      <WebsiteContentNewPage
        type="article"
        autosaveDelayMs={AUTOSAVE_DELAY_MS}
      />,
      { user, url: "/website_content/article/new" },
    )
    await screen.findByTestId("editor")

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      "A brand new article",
    )

    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "post" }),
        )
      },
      { timeout: 12000 },
    )

    // The address bar names the item that was created...
    await waitFor(() => {
      expect(window.location.pathname).toBe(
        websiteContentEditView("article", article.id),
      )
    })
    // ...and nothing navigated to get there.
    expect(routerMocks.push).not.toHaveBeenCalled()

    // Settled, so no write lands after the test ends.
    await waitFor(() => expect(screen.queryByText("Saving...")).toBe(null))
  })
})
