import React from "react"
import {
  screen,
  renderWithProviders,
  setMockResponse,
  TestingErrorBoundary,
} from "@/test-utils"
import { waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { factories, urls } from "api/test-utils"
import { ArticleNewPage } from "./ArticleNewPage"

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

jest.mock("ol-components", () => {
  // Reuse other exports from ol-components if needed
  const actual = jest.requireActual("ol-components")
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TiptapEditor: ({ value, onChange, "data-testid": testId }: any) => {
      return (
        <textarea
          data-testid={testId || "editor"}
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              // Allow simulating JSON-like updates if needed
              const parsed = JSON.parse(e.target.value)
              onChange?.(parsed)
            } catch {
              // fallback to raw string for simple tests
              onChange?.(e.target.value)
            }
          }}
        />
      )
    },
  }
})

describe("ArticleNewPage", () => {
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
        <ArticleNewPage />
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

    renderWithProviders(<ArticleNewPage />)

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

    renderWithProviders(<ArticleNewPage />)

    await screen.findByTestId("editor")

    const titleInput = await screen.findByPlaceholderText("Enter article title")
    fireEvent.change(titleInput, { target: { value: "My Article" } })
    await waitFor(() => expect(titleInput).toHaveValue("My Article"))

    await userEvent.click(screen.getByText(/save article/i))

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

    renderWithProviders(<ArticleNewPage />)

    await screen.findByPlaceholderText("Enter article title")

    fireEvent.change(screen.getByPlaceholderText("Enter article title"), {
      target: { value: "My Article" },
    })
    await userEvent.click(screen.getByTestId("editor"))
    await userEvent.click(screen.getByText("Save Article"))

    expect(await screen.findByText(/Mock Error/)).toBeInTheDocument()
  })
})
