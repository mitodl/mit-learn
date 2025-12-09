import React from "react"
import {
  screen,
  renderWithProviders,
  setMockResponse,
  TestingErrorBoundary,
  fireEvent,
  user as userEvent,
} from "@/test-utils"
import { waitFor } from "@testing-library/react"
import { factories, urls } from "api/test-utils"
import { ArticleNewPage } from "./ArticleNewPage"

const mockPush = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

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

  // Skipping tests: Tiptap Editor uses contentediable elements
  // and accesses DOM APIs not available in React Testing Library / JSDOM
  // Errors e.g. TypeError: target.getClientRects is not a function
  // eslint-disable-next-line jest/no-disabled-tests
  test.skip("renders editor when user has ArticleEditor permission", async () => {
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

    renderWithProviders(<ArticleNewPage />)

    await screen.findByTestId("editor")

    consoleWarnSpy.mockRestore()
  })

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip("submits article successfully", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const createdArticle = factories.articles.article({ id: 101 })
    setMockResponse.post(urls.articles.list(), createdArticle)

    renderWithProviders(<ArticleNewPage />)

    await screen.findByTestId("editor")

    const titleInput = await screen.findByPlaceholderText("Article title")
    fireEvent.change(titleInput, { target: { value: "My Article" } })
    await waitFor(() => expect(titleInput).toHaveValue("My Article"))

    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/articles/101", undefined),
    )
  })

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip("shows error on failure", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    setMockResponse.post(
      urls.articles.list(),
      { detail: "Server error" },
      { code: 500 },
    )

    renderWithProviders(<ArticleNewPage />)

    await screen.findByTestId("editor")

    await screen.findByPlaceholderText("Article title")

    fireEvent.change(screen.getByPlaceholderText("Article title"), {
      target: { value: "My Article" },
    })
    await userEvent.click(screen.getByTestId("editor"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(/Mock Error/)).toBeInTheDocument()
  })
})
