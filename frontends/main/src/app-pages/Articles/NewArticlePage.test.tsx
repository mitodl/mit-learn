import React from "react"
import { screen, renderWithProviders, setMockResponse } from "@/test-utils"
import { waitFor, fireEvent } from "@testing-library/react"
import { factories, urls } from "api/test-utils"
import { NewArticlePage } from "./NewArticlePage"

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

class TestErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="forbidden-error">Forbidden</div>
    }
    return this.props.children
  }
}

const mockMutate = jest.fn()
jest.mock("api/hooks/articles", () => ({
  useArticleCreate: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

jest.mock("ol-ckeditor", () => ({
  CKEditorClient: ({ onChange }: { onChange: (content: string) => void }) => (
    <textarea
      data-testid="editor"
      role="button"
      tabIndex={0}
      onClick={() => onChange("test content")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onChange("test content")
        }
      }}
      aria-label="Editor mock"
    />
  ),
}))

describe("NewArticlePage", () => {
  beforeEach(() => mockMutate.mockReset())

  test("throws ForbiddenError when user lacks ArticleEditor permission", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: false,
    })

    setMockResponse.get(urls.userMe.get(), user)

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    renderWithProviders(
      <TestErrorBoundary>
        <NewArticlePage />
      </TestErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("forbidden-error")).toBeInTheDocument()
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

    renderWithProviders(<NewArticlePage />)

    await screen.findByTestId("editor")

    const titleInput = screen.getByRole("textbox")
    fireEvent.change(titleInput, { target: { value: "My Article" } })

    mockMutate.mockImplementation((data, opts) => {
      opts.onSuccess({ id: "101" })
    })

    fireEvent.click(screen.getByText(/save article/i))

    expect(mockMutate).toHaveBeenCalledWith(
      { title: "My Article", html: "" }, // mock editor starts empty
      expect.any(Object),
    )

    expect(pushMock).toHaveBeenCalledWith("/articles/101", undefined)
  })

  test("shows error on failure", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<NewArticlePage />)

    await screen.findByPlaceholderText("Enter article title")

    fireEvent.change(screen.getByPlaceholderText("Enter article title"), {
      target: { value: "My Article" },
    })

    fireEvent.click(screen.getByTestId("editor"))

    mockMutate.mockImplementation((_data, opts) => {
      opts?.onError?.()
    })

    fireEvent.click(screen.getByText("Save Article"))

    expect(
      await screen.findByText(/Failed to save article/),
    ).toBeInTheDocument()
  })
})
