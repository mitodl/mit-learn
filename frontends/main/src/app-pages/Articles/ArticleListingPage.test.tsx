import React from "react"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import { renderWithProviders } from "@/test-utils"
import { ArticleListingPage } from "./ArticleListingPage"

const setup = ({
  isArticleEditor = true,
  isPublished = true,
}: { isArticleEditor?: boolean; isPublished?: boolean } = {}) => {
  const user = factories.user.user({
    is_authenticated: true,
    is_article_editor: isArticleEditor,
  })
  setMockResponse.get(urls.userMe.get(), user)

  const article = factories.websiteContent.websiteContent({
    id: 701,
    title: "Breaking the old model of education",
    content_type: "article",
    is_published: isPublished,
  })
  setMockResponse.get(
    urls.websiteContent.list({ limit: 10, offset: 0, content_type: "article" }),
    { count: 1, next: null, previous: null, results: [article] },
  )

  renderWithProviders(<ArticleListingPage />, { user })
  return { article }
}

const menuName = (title: string) => `More options for ${title}`

/**
 * The page renders its mobile and desktop layouts together and hides one with
 * CSS, so every card is in the DOM twice. These queries take the first match
 * rather than asserting a single one.
 */
const findMenuButtons = (title: string) =>
  screen.findAllByRole("button", { name: menuName(title) })
const queryMenuButtons = (title: string) =>
  screen.queryAllByRole("button", { name: menuName(title) })

describe("ArticleListingPage article actions", () => {
  test("an editor can unpublish a published article from the card", async () => {
    const { article } = setup()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: false,
    })

    await userEvent.click((await findMenuButtons(article.title))[0])
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Unpublish" }),
    )

    // The menu only asks; the dialog owns the confirmation.
    await screen.findByRole("heading", { name: "Unpublish article" })
    await userEvent.click(
      await screen.findByRole("button", { name: "Yes, Unpublish article" }),
    )

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          url: urls.websiteContent.details(article.id),
          body: { is_published: false },
        }),
      )
    })
  })

  test("cancelling the dialog unpublishes nothing", async () => {
    const { article } = setup()

    await userEvent.click((await findMenuButtons(article.title))[0])
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Unpublish" }),
    )
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }))

    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
  })

  test("the menu is hidden from users who cannot edit articles", async () => {
    const { article } = setup({ isArticleEditor: false })

    await screen.findAllByText(article.title)

    expect(queryMenuButtons(article.title)).toHaveLength(0)
  })

  test("a draft has no menu, since unpublishing is the only action", async () => {
    const { article } = setup({ isPublished: false })

    await screen.findAllByText(article.title)

    expect(queryMenuButtons(article.title)).toHaveLength(0)
  })
})

describe("ArticleListingPage links", () => {
  const hrefs = (title: string) =>
    screen
      .getAllByRole("link", { name: title })
      .map((a) => a.getAttribute("href"))

  test("a draft links to the editor, since it has no public page", async () => {
    const { article } = setup({ isPublished: false })

    await screen.findAllByText(article.title)

    /* Every link on the card, so the title and the image cannot diverge. */
    const unique = [...new Set(hrefs(article.title))]
    expect(unique).toEqual([`/website_content/article/${article.id}/edit`])
  })

  test("a published article links to its public page", async () => {
    const { article } = setup({ isPublished: true })

    await screen.findAllByText(article.title)

    const unique = [...new Set(hrefs(article.title))]
    expect(unique).toEqual([`/articles/${article.slug ?? article.id}`])
  })
})
