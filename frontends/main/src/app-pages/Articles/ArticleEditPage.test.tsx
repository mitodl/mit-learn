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

// Mock API hooks
const mockUpdateMutate = jest.fn()
jest.mock("api/hooks/articles", () => ({
  useArticleDetail: (id: number) => ({
    data: {
      id,
      title: "Existing Title",
      html: "<p>Existing content</p>",
    },
    isLoading: false,
  }),
  useArticlePartialUpdate: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
}))

// Mock CKEditor
jest.mock("ol-ckeditor", () => ({
  CKEditorClient: ({ onChange }: { onChange: (content: string) => void }) => (
    <textarea
      data-testid="editor"
      onChange={(e) => onChange(e.target.value)}
      value="mock content"
    />
  ),
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

    renderWithProviders(<ArticleEditPage articleId={"42"} />)

    expect(await screen.findByText("Write Article")).toBeInTheDocument()
    expect(screen.getByTestId("editor")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Existing Title")).toBeInTheDocument()
  })

  test("submits article successfully and redirects", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<ArticleEditPage articleId={"123"} />)

    const titleInput = await screen.findByPlaceholderText("Enter article title")

    // Change title
    fireEvent.change(titleInput, { target: { value: "Updated Title" } })
    await waitFor(() => expect(titleInput).toHaveValue("Updated Title"))

    // Mock success response
    mockUpdateMutate.mockImplementation((_data, opts) => {
      opts.onSuccess({ id: 123 })
    })

    // Click save
    fireEvent.click(screen.getByText(/save article/i))

    // Assert payload
    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        {
          id: 123,
          title: "Updated Title",
          html: "<p>Existing content</p>",
        },
        expect.any(Object),
      )
    })

    // Assert redirect
    expect(pushMock).toHaveBeenCalledWith("/articles/123")
  })

  test("shows error alert on failure", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<ArticleEditPage articleId={"7"} />)

    const titleInput = await screen.findByPlaceholderText("Enter article title")
    fireEvent.change(titleInput, { target: { value: "Bad Article" } })

    mockUpdateMutate.mockImplementation((_data, opts) => {
      opts.onError?.()
    })

    fireEvent.click(screen.getByText(/save article/i))

    expect(
      await screen.findByText(/Failed to save article/i),
    ).toBeInTheDocument()
  })
})
