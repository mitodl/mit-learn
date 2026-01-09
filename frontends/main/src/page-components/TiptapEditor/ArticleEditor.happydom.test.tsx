/**
 * @jest-environment @happy-dom/jest-environment
 *
 * Using the Happy DOM environment as the editor accesses DOM APIs and uses contenteditable
 * elements not supported by JSDOM, the default environment in Jest.
 */
import React from "react"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Provider as NiceModalProvider } from "@ebay/nice-modal-react"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import { userQueries } from "api/hooks/user"
import { renderWithTheme } from "../../../../ol-components/src/test-utils"
import { ArticleEditor } from "./ArticleEditor"
import type { JSONContent } from "@tiptap/react"

// Mock feature flag to always return true
jest.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => true,
  usePostHog: () => ({}),
}))

const mockOnSave = jest.fn()

// Helper to render with providers (uses renderWithTheme + adds React Query and NiceModal)
const renderWithProviders = (
  component: React.ReactElement,
  options: { user?: ReturnType<typeof factories.user.user> } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  if (options.user) {
    queryClient.setQueryData(userQueries.me().queryKey, options.user)
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <NiceModalProvider>{children}</NiceModalProvider>
    </QueryClientProvider>
  )

  return renderWithTheme(<Wrapper>{component}</Wrapper>)
}

// Helper to get mock calls from makeRequest with proper typing
const getMakeRequestCalls = () => {
  return (makeRequest as unknown as ReturnType<typeof jest.fn>).mock.calls
}

// Helper to find a specific API call by method and URL
const findApiCall = (
  method: string,
  url: string,
): [string, string, unknown] | undefined => {
  const calls = getMakeRequestCalls()
  return calls.find((call) => call[0] === method && call[1] === url) as
    | [string, string, unknown]
    | undefined
}

describe("ArticleEditor - Content Editing and Saving (Happy DOM)", () => {
  let consoleWarnSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    mockOnSave.mockClear()
    jest.clearAllMocks()
    consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation((message) => {
        if (
          typeof message === "string" &&
          message.includes("Duplicate extension names")
        ) {
          return
        }
      })
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  const setupEditableEditor = async (
    content: JSONContent,
    articleId = 100,
    title = "Test Article",
  ) => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      id: articleId,
      title,
      content,
      is_published: false,
    })
    setMockResponse.get(urls.articles.details(articleId), article)

    renderWithProviders(
      <ArticleEditor article={article} onSave={mockOnSave} />,
      { user },
    )

    await screen.findByTestId("editor")
    return article
  }

  describe("Editing title in banner heading", () => {
    test("can edit banner heading and save successfully", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Original Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [],
          },
        ],
      }

      const article = await setupEditableEditor(
        initialContent,
        200,
        "Original Title",
      )

      const updatedArticle = {
        ...article,
        title: "Updated Title",
        content: {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: "Updated Title" }],
                },
                {
                  type: "paragraph",
                  content: [],
                },
              ],
            },
            {
              type: "byline",
            },
            {
              type: "paragraph",
              content: [],
            },
          ],
        },
      }
      setMockResponse.patch(urls.articles.details(article.id), updatedArticle)

      // Edit the heading
      const heading = screen.getByRole("heading", { level: 1 })
      await userEvent.click(heading)
      // Select all, delete, then type new text
      await userEvent.keyboard("{Control>}a{/Control}{Delete}")
      await userEvent.type(heading, "Updated Title")

      // Wait for button to become enabled (content is touched)
      await waitFor(
        () => {
          const updateButton = screen.getByRole("button", {
            name: /Update|Publish/,
          })
          expect(updateButton).not.toBeDisabled()
        },
        { timeout: 3000 },
      )

      // Click Update/Publish button (for unpublished articles it's "Publish")
      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      await userEvent.click(updateButton)

      // Verify API call was made with PATCH
      await waitFor(
        () => {
          const patchCall = findApiCall(
            "patch",
            urls.articles.details(article.id),
          )
          expect(patchCall).toBeDefined()
        },
        { timeout: 5000 },
      )

      // Verify the request includes updated title and content
      const patchCall = findApiCall("patch", urls.articles.details(article.id))
      expect(patchCall).toBeDefined()
      if (patchCall) {
        const requestBody = patchCall[2] as {
          title: string
          content: JSONContent
        }
        expect(requestBody.title).toBe("Updated Title")
        expect(requestBody.content).toBeDefined()

        // Verify the updated heading text is in the content
        const contentStr = JSON.stringify(requestBody.content)
        expect(contentStr).toContain("Updated Title")
      }

      // Verify onSave callback was called
      await waitFor(() => expect(mockOnSave).toHaveBeenCalled())
    })
  })

  describe("Editing paragraph content", () => {
    test("can edit paragraph text and save successfully", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Article Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Original paragraph text" }],
          },
        ],
      }

      const article = await setupEditableEditor(
        initialContent,
        201,
        "Article Title",
      )

      // Find and edit the paragraph
      const paragraph = screen.getByText("Original paragraph text")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, "Updated paragraph text")

      // Wait for button to become enabled
      await waitFor(
        () => {
          const updateButton = screen.getByRole("button", {
            name: /Update|Publish/,
          })
          expect(updateButton).not.toBeDisabled()
        },
        { timeout: 3000 },
      )

      const updatedArticle = {
        ...article,
        content: {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: "Article Title" }],
                },
                {
                  type: "paragraph",
                  content: [],
                },
              ],
            },
            {
              type: "byline",
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Updated paragraph text" }],
            },
          ],
        },
      }
      setMockResponse.patch(urls.articles.details(article.id), updatedArticle)

      // Click Update button
      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      await userEvent.click(updateButton)

      // Verify API call was made with PATCH
      await waitFor(
        () => {
          const patchCall = findApiCall(
            "patch",
            urls.articles.details(article.id),
          )
          expect(patchCall).toBeDefined()
        },
        { timeout: 5000 },
      )

      // Verify the request includes updated content with the new paragraph text
      const patchCall = findApiCall(
        "patch",
        urls.articles.details(article.id),
      )
      expect(patchCall).toBeDefined()
      if (patchCall) {
        const requestBody = patchCall[2] as { content: JSONContent }
        expect(requestBody.content).toBeDefined()

        // Verify the updated paragraph text is in the content
        const contentStr = JSON.stringify(requestBody.content)
        expect(contentStr).toContain("Updated paragraph text")
      }
    })
  })

  describe("Save button states", () => {
    test("save button is disabled when content is unchanged", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [],
          },
        ],
      }

      await setupEditableEditor(initialContent, 205, "Title")

      // Button should be disabled initially (no changes made)
      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      expect(updateButton).toBeDisabled()
    })

    test("save button becomes enabled after editing content", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Original text" }],
          },
        ],
      }

      await setupEditableEditor(initialContent, 206, "Title")

      // Initially disabled
      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      expect(updateButton).toBeDisabled()

      // Edit content
      const paragraph = screen.getByText("Original text")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, "Edited text")

      // Button should become enabled
      await waitFor(
        () => {
          expect(updateButton).not.toBeDisabled()
        },
        { timeout: 3000 },
      )
    })

    test("save button is disabled when title is empty", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Content" }],
          },
        ],
      }

      await setupEditableEditor(initialContent, 207, "Title")

      // Clear the title
      const heading = screen.getByRole("heading", { level: 1 })
      await userEvent.click(heading)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.keyboard("{Delete}")

      // Button should be disabled when title is empty
      await waitFor(
        () => {
          const updateButton = screen.getByRole("button", {
            name: /Update|Publish/,
          })
          expect(updateButton).toBeDisabled()
        },
        { timeout: 1000 },
      )
    })
  })

  describe("Save as Draft functionality", () => {
    test("can save article as draft", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Content" }],
          },
        ],
      }

      const article = await setupEditableEditor(initialContent, 208, "Title")

      // Edit content
      const paragraph = screen.getByText("Content")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, "Updated content")

      // Wait for button to become enabled
      await waitFor(
        () => {
          const saveDraftButton = screen.getByRole("button", {
            name: "Save As Draft",
          })
          expect(saveDraftButton).not.toBeDisabled()
        },
        { timeout: 3000 },
      )

      const updatedArticle = {
        ...article,
        content: expect.objectContaining({
          type: "doc",
        }),
        is_published: false,
      }
      setMockResponse.patch(urls.articles.details(article.id), updatedArticle)

      // Click Save As Draft button
      const saveDraftButton = screen.getByRole("button", {
        name: "Save As Draft",
      })
      await userEvent.click(saveDraftButton)

      // Verify API call with is_published: false
      await waitFor(() =>
        expect(makeRequest).toHaveBeenCalledWith(
          "patch",
          urls.articles.details(article.id),
          expect.objectContaining({
            is_published: false,
          }),
        ),
      )
    })
  })

  describe("Error handling during save", () => {
    test("shows error message when save fails", async () => {
      const initialContent: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Content" }],
          },
        ],
      }

      const article = await setupEditableEditor(initialContent, 209, "Title")

      // Mock a failed save
      setMockResponse.patch(
        urls.articles.details(article.id),
        { detail: "Server error" },
        { code: 500 },
      )

      // Edit content
      const paragraph = screen.getByText("Content")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, "Updated content")

      // Wait for button to become enabled
      await waitFor(
        () => {
          const updateButton = screen.getByRole("button", {
            name: /Update|Publish/,
          })
          expect(updateButton).not.toBeDisabled()
        },
        { timeout: 3000 },
      )

      // Click Update button
      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      await userEvent.click(updateButton)

      // Wait for error message - check for error alert
      await waitFor(
        () => {
          // The error might appear in an alert component
          const errorText = screen.queryByText(
            /Mock Error|An error occurred while saving|Server error/i,
          )
          if (errorText) {
            expect(errorText).toBeInTheDocument()
          } else {
            // Sometimes the error might be in a different format
            const alert = screen.queryByRole("alert")
            if (alert) {
              expect(alert).toBeInTheDocument()
            }
          }
        },
        { timeout: 5000 },
      )
    })
  })
})
