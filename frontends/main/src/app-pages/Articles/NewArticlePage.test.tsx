import React from "react"
import {
  screen,
  renderWithProviders,
  setMockResponse,
  TestingErrorBoundary,
} from "@/test-utils"
import { waitFor, fireEvent } from "@testing-library/react"
import { factories, urls } from "api/test-utils"
import { NewArticlePage } from "./NewArticlePage"

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe("NewArticlePage", () => {
  test("throws ForbiddenError when user lacks ArticleEditor permission", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: false,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const onError = jest.fn()

    renderWithProviders(
      <TestingErrorBoundary onError={onError}>
        <NewArticlePage />
      </TestingErrorBoundary>,
    )

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })

  test("renders editor when user has ArticleEditor permission", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<NewArticlePage />)

    expect(await screen.findByText("Write Article")).toBeInTheDocument()
    expect(screen.getByTestId("editor")).toBeInTheDocument()
  })

  test("submits article successfully", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    // Mock article creation API
    const createdArticle = factories.articles.article({ id: 101 })
    setMockResponse.post(urls.articles.list(), createdArticle)

    renderWithProviders(<NewArticlePage />)

    await screen.findByTestId("editor")

    const titleInput = await screen.findByPlaceholderText("Enter article title")
    fireEvent.change(titleInput, { target: { value: "My Article" } })
    await waitFor(() => expect(titleInput).toHaveValue("My Article"))

    fireEvent.click(screen.getByText(/save article/i))

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/articles/101", undefined),
    )
  })

  test("shows error on failure", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    // Simulate failed API request (500)
    setMockResponse.post(
      urls.articles.list(),
      { detail: "Server error" },
      { code: 500 },
    )

    renderWithProviders(<NewArticlePage />)

    await screen.findByPlaceholderText("Enter article title")

    fireEvent.change(screen.getByPlaceholderText("Enter article title"), {
      target: { value: "My Article" },
    })
    fireEvent.click(screen.getByTestId("editor"))
    fireEvent.click(screen.getByText("Save Article"))

    expect(
      await screen.findByText(/Failed to save article/),
    ).toBeInTheDocument()
  })
})
