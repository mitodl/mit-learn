import React from "react"
import { screen, renderWithProviders, setMockResponse } from "@/test-utils"
import { waitFor, fireEvent } from "@testing-library/react"
import { factories, urls } from "api/test-utils"
import { ArticleEditPage } from "./ArticleEditPage"

const pushMock = jest.fn()

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe("ArticleEditPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("renders editor when user has ArticleEditor permission", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      id: 42,
      title: "Existing Title",
      content: "{id: 1, content: 'Existing content'}",
    })
    setMockResponse.get(urls.articles.details(article.id), article)

    renderWithProviders(<ArticleEditPage articleId={"42"} />)

    expect(await screen.findByText("Edit Article")).toBeInTheDocument()
    expect(screen.getByTestId("editor")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Existing Title")).toBeInTheDocument()
  })

  test("submits article successfully and redirects", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      id: 123,
      title: "Existing Title",
      content: "{id: 1, content: 'Existing content'}",
    })
    setMockResponse.get(urls.articles.details(article.id), article)

    // ✅ Mock successful update response
    const updated = { ...article, title: "Updated Title" }
    setMockResponse.patch(urls.articles.details(article.id), updated)

    renderWithProviders(<ArticleEditPage articleId={"123"} />)

    const titleInput = await screen.findByPlaceholderText("Enter article title")

    fireEvent.change(titleInput, { target: { value: "Updated Title" } })
    await waitFor(() => expect(titleInput).toHaveValue("Updated Title"))

    fireEvent.click(screen.getByText(/save article/i))

    // ✅ Wait for redirect after update success
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/articles/123"))
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
      content: "{id: 1, content: 'Bad content'}",
    })
    setMockResponse.get(urls.articles.details(article.id), article)

    // ✅ Mock failed update (500)
    setMockResponse.patch(
      urls.articles.details(article.id),
      { detail: "Server Error" },
      { code: 500 },
    )

    renderWithProviders(<ArticleEditPage articleId={"7"} />)

    const titleInput = await screen.findByPlaceholderText("Enter article title")
    fireEvent.change(titleInput, { target: { value: "Bad Article" } })

    fireEvent.click(screen.getByText(/save article/i))

    expect(
      await screen.findByText(/Failed to save article/i),
    ).toBeInTheDocument()
  })
})
