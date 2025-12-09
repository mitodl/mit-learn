import React from "react"
import {
  screen,
  renderWithProviders,
  setMockResponse,
  fireEvent,
  user as userEvent,
} from "@/test-utils"
import { factories, urls, makeRequest } from "api/test-utils"
import { ArticleEditPage } from "./ArticleEditPage"
import { waitFor } from "@testing-library/react"

const mockPush = jest.fn()

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// eslint-disable-next-line jest/no-disabled-tests
describe.skip("ArticleEditPage", () => {
  // Skipping tests: Tiptap Editor uses contentediable elements
  // and accesses DOM APIs not available in React Testing Library / JSDOM
  // Errors e.g. TypeError: target.getClientRects is not a function

  test("renders editor when user has ArticleEditor permission", async () => {
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation((message) => {
        // Suppress the expected duplicate extension warning for now (TODO: investigate)
        if (
          typeof message === "string" &&
          message.includes("Duplicate extension names")
        ) {
          return
        }
      })
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.articles.article({
      id: 42,
      title: "Existing Title",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Existing Title" }],
          },
        ],
      },
    })
    setMockResponse.get(
      urls.articles.articlesDetailRetrieve(String(article.id)),
      article,
    )

    renderWithProviders(<ArticleEditPage articleId={"42"} />)
    await screen.findByTestId("editor")
    expect(screen.getByText("Existing Title")).toBeInTheDocument()
    consoleWarnSpy.mockRestore()
  })
  test("submits article successfully", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.articles.article({
      id: 123,
      title: "Existing Title",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Existing Title" }],
          },
        ],
      },
    })
    setMockResponse.get(urls.articles.details(article.id), article)
    const updated = { ...article, title: "Updated Title" }
    setMockResponse.patch(urls.articles.details(article.id), updated)
    renderWithProviders(<ArticleEditPage articleId={"123"} />)
    await screen.findByTestId("editor")
    const titleInput = await screen.findByPlaceholderText("Article title")
    fireEvent.change(titleInput, { target: { value: "Updated Title" } })
    await waitFor(() => expect(titleInput).toHaveValue("Updated Title"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        "patch",
        urls.articles.details(article.id),
        expect.objectContaining({ title: "Updated Title" }),
      ),
    )
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/articles/123"))
  })
  test("shows error alert on failure", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.articles.article({
      id: 7,
      title: "Old Title",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Article Title" }],
          },
        ],
      },
    })
    setMockResponse.get(urls.articles.details(article.id), article)
    setMockResponse.patch(
      urls.articles.details(article.id),
      { detail: "Server Error" },
      { code: 500 },
    )
    renderWithProviders(<ArticleEditPage articleId={"7"} />)
    await screen.findByTestId("editor")
    const titleInput = await screen.findByPlaceholderText("Article title")
    fireEvent.change(titleInput, { target: { value: "Bad Article" } })
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText(/Mock Error/i)).toBeInTheDocument()
  })
})
