import React from "react"
import { screen, renderWithProviders, setMockResponse } from "@/test-utils"
import { waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { factories, urls, makeRequest } from "api/test-utils"
import { ArticleEditPage } from "./ArticleEditPage"

const mockPush = jest.fn()

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe("ArticleEditPage", () => {
  test("renders editor when user has ArticleEditor permission", async () => {
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
            type: "paragraph",
            content: [{ type: "text", text: "Existing Title" }],
          },
        ],
      },
    })
    setMockResponse.get(urls.articles.details(article.id), article)

    renderWithProviders(<ArticleEditPage articleId={"42"} />)

    await screen.findByTestId("editor")

    expect(screen.getByDisplayValue("Existing Title")).toBeInTheDocument()
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
            content: [{ type: "text", text: "Existing Title" }],
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
