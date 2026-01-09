import React from "react"
import { screen, waitFor, fireEvent } from "@testing-library/react"
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

describe("ArticleEditor", () => {
  beforeEach(() => {
    mockOnSave.mockClear()
    jest.clearAllMocks()
  })

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

    renderWithProviders(<ArticleEditor onSave={mockOnSave} />, { user })

    await screen.findByTestId("editor")

    consoleWarnSpy.mockRestore()
  })

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip("submits article successfully", async () => {
    // Skipping: Tiptap Editor uses contenteditable elements and typing interactions
    // don't reliably trigger editor state updates in test environments.
    // The editor's onUpdate callback may not fire, preventing touched/title state
    // from updating, which keeps the save button disabled or prevents the save handler from executing.
    // See other skipped Tiptap tests for similar issues.
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const createdArticle = factories.articles.article({ id: 101 })
    setMockResponse.post(urls.articles.list(), createdArticle)

    renderWithProviders(<ArticleEditor onSave={mockOnSave} />, { user })

    // Wait for editor to be fully rendered
    await screen.findByTestId("editor")

    // Wait a bit for editor initialization (onCreate has setTimeout)
    await waitFor(
      () => {
        const heading = screen.getByRole("heading", { level: 1 })
        expect(heading).toBeInTheDocument()
      },
      { timeout: 2000 },
    )

    // The title is set by typing into the h1 heading in the banner
    // Find the heading and type into it
    const heading = screen.getByRole("heading", { level: 1 })
    await userEvent.click(heading)

    // Small delay to allow editor to process the click
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Select all and type to replace content (contenteditable elements don't support clear())
    await userEvent.keyboard("{Control>}a{/Control}")
    await userEvent.type(heading, "My Article", { delay: 0 })

    // Wait for the editor to update and the title to be extracted
    // First verify the heading text was updated
    await waitFor(
      () => {
        expect(heading).toHaveTextContent("My Article")
      },
      { timeout: 3000 },
    )

    // Wait for the title to be extracted and button to become enabled
    // The button is enabled when: title is set AND content is touched
    await waitFor(
      () => {
        const publishButton = screen.getByRole("button", { name: "Publish" })
        expect(publishButton).not.toBeDisabled()
      },
      { timeout: 5000 },
    )

    // Get the button and verify it's enabled - check multiple times to ensure state is stable
    let publishButton: HTMLElement
    await waitFor(
      () => {
        publishButton = screen.getByRole("button", { name: "Publish" })
        expect(publishButton).not.toBeDisabled()
      },
      { timeout: 2000 },
    )

    // Verify button doesn't have disabled attribute
    expect(publishButton!).not.toHaveAttribute("disabled", "")

    // Double-check button is still enabled right before clicking
    expect(publishButton!).not.toBeDisabled()

    // Click the Publish button - use fireEvent for more reliable clicking
    fireEvent.click(publishButton!)

    // Wait a bit for React state updates and mutation to start
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Wait for the API call to be made
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          "post",
          urls.articles.list(),
          expect.objectContaining({
            title: "My Article",
            is_published: true,
          }),
        )
      },
      { timeout: 5000 },
    )

    // Wait for onSave callback to be called with the created article
    await waitFor(
      () => expect(mockOnSave).toHaveBeenCalledWith(createdArticle),
      { timeout: 5000 },
    )
  }, 15000) // 15 second timeout for this test

  // Helper to create article with custom content
  const createArticleWithContent = (content: JSONContent, title?: string) => {
    return factories.articles.article({
      id: 1,
      title: title || "Test Article",
      content,
    })
  }

  describe("ArticleEditor - Document Rendering", () => {
    let consoleWarnSpy: ReturnType<typeof jest.spyOn>

    beforeEach(() => {
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

    const setupEditor = async (content: JSONContent, articleId = 1) => {
      const user = factories.user.user({
        is_authenticated: true,
        is_article_editor: true,
      })
      setMockResponse.get(urls.userMe.get(), user)

      const article = createArticleWithContent(content)
      setMockResponse.get(urls.articles.details(articleId), article)

      renderWithProviders(
        <ArticleEditor article={article} onSave={mockOnSave} readOnly />,
        { user },
      )

      await screen.findByTestId("editor")
      return article
    }

    describe("Basic document structure", () => {
      test("renders empty document with banner, byline, and empty paragraph", async () => {
        const content: JSONContent = {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [],
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

        await setupEditor(content)

        // Should render editor
        expect(screen.getByTestId("editor")).toBeInTheDocument()
        // Should have banner heading
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
      })

      test("renders document with title in banner heading", async () => {
        const content: JSONContent = {
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
                  content: [{ type: "text", text: "Banner subtitle" }],
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

        await setupEditor(content)

        expect(screen.getByText("Article Title")).toBeInTheDocument()
        expect(screen.getByText("Banner subtitle")).toBeInTheDocument()
      })

      test("renders document with multiple paragraphs", async () => {
        const content: JSONContent = {
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
              content: [{ type: "text", text: "First paragraph" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Second paragraph" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Third paragraph" }],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("First paragraph")).toBeInTheDocument()
        expect(screen.getByText("Second paragraph")).toBeInTheDocument()
        expect(screen.getByText("Third paragraph")).toBeInTheDocument()
      })
    })

    describe("Headings", () => {
      test("renders document with multiple heading levels", async () => {
        const content: JSONContent = {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: "H1 Title" }],
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
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "H2 Heading" }],
            },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "H3 Heading" }],
            },
            {
              type: "heading",
              attrs: { level: 4 },
              content: [{ type: "text", text: "H4 Heading" }],
            },
          ],
        }

        await setupEditor(content)

        const h1 = screen.getByRole("heading", { level: 1, name: "H1 Title" })
        const h2 = screen.getByRole("heading", { level: 2, name: "H2 Heading" })
        const h3 = screen.getByRole("heading", { level: 3, name: "H3 Heading" })
        const h4 = screen.getByRole("heading", { level: 4, name: "H4 Heading" })

        expect(h1).toBeInTheDocument()
        expect(h2).toBeInTheDocument()
        expect(h3).toBeInTheDocument()
        expect(h4).toBeInTheDocument()
      })
    })

    describe("Text formatting", () => {
      test("renders document with bold text", async () => {
        const content: JSONContent = {
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
              content: [
                { type: "text", text: "This is " },
                { type: "text", marks: [{ type: "bold" }], text: "bold text" },
                { type: "text", text: " in a paragraph." },
              ],
            },
          ],
        }

        await setupEditor(content)

        const boldText = screen.getByText("bold text")
        expect(boldText).toBeInTheDocument()
        expect(boldText.closest("strong") || boldText.closest("b")).toBeTruthy()
      })

      test("renders document with italic text", async () => {
        const content: JSONContent = {
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
              content: [
                { type: "text", text: "This is " },
                {
                  type: "text",
                  marks: [{ type: "italic" }],
                  text: "italic text",
                },
                { type: "text", text: " in a paragraph." },
              ],
            },
          ],
        }

        await setupEditor(content)

        const italicText = screen.getByText("italic text")
        expect(italicText).toBeInTheDocument()
        expect(italicText.closest("em") || italicText.closest("i")).toBeTruthy()
      })

      test("renders document with highlighted text", async () => {
        const content: JSONContent = {
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
              content: [
                { type: "text", text: "This is " },
                {
                  type: "text",
                  marks: [{ type: "highlight" }],
                  text: "highlighted text",
                },
                { type: "text", text: " in a paragraph." },
              ],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("highlighted text")).toBeInTheDocument()
      })

      test("renders document with links", async () => {
        const content: JSONContent = {
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
              content: [
                { type: "text", text: "Visit " },
                {
                  type: "text",
                  marks: [
                    {
                      type: "link",
                      attrs: { href: "https://example.com", target: "_blank" },
                    },
                  ],
                  text: "example.com",
                },
                { type: "text", text: " for more info." },
              ],
            },
          ],
        }

        await setupEditor(content)

        const link = screen.getByRole("link", { name: "example.com" })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute("href", "https://example.com")
      })
    })

    describe("Lists", () => {
      test("renders document with bullet list", async () => {
        const content: JSONContent = {
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
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "First item" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Second item" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Third item" }],
                    },
                  ],
                },
              ],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("First item")).toBeInTheDocument()
        expect(screen.getByText("Second item")).toBeInTheDocument()
        expect(screen.getByText("Third item")).toBeInTheDocument()
      })

      test("renders document with ordered list", async () => {
        const content: JSONContent = {
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
              type: "orderedList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Step one" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Step two" }],
                    },
                  ],
                },
              ],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("Step one")).toBeInTheDocument()
        expect(screen.getByText("Step two")).toBeInTheDocument()
      })

      test("renders document with task list", async () => {
        const content: JSONContent = {
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
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Unchecked task" }],
                    },
                  ],
                },
                {
                  type: "taskItem",
                  attrs: { checked: true },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Checked task" }],
                    },
                  ],
                },
              ],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("Unchecked task")).toBeInTheDocument()
        expect(screen.getByText("Checked task")).toBeInTheDocument()
      })
    })

    describe("Block elements", () => {
      test("renders document with blockquote", async () => {
        const content: JSONContent = {
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
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "This is a quote" }],
                },
              ],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("This is a quote")).toBeInTheDocument()
      })

      test("renders document with code block", async () => {
        const content: JSONContent = {
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
              type: "codeBlock",
              attrs: { language: "javascript" },
              content: [{ type: "text", text: "const x = 1;" }],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("const x = 1;")).toBeInTheDocument()
      })

      test("renders document with horizontal rule", async () => {
        const content: JSONContent = {
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
              content: [{ type: "text", text: "Above the rule" }],
            },
            {
              type: "horizontalRule",
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Below the rule" }],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("Above the rule")).toBeInTheDocument()
        expect(screen.getByText("Below the rule")).toBeInTheDocument()
      })
    })

    describe("Complex document structures", () => {
      test("renders document with mixed content types", async () => {
        const content: JSONContent = {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: "Complex Article" }],
                },
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "A " },
                    {
                      type: "text",
                      marks: [{ type: "bold" }],
                      text: "complex",
                    },
                    { type: "text", text: " article with " },
                    {
                      type: "text",
                      marks: [{ type: "italic" }],
                      text: "various",
                    },
                    { type: "text", text: " elements." },
                  ],
                },
              ],
            },
            {
              type: "byline",
            },
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Introduction" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "First paragraph of content." }],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "List item one" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Important quote" }],
                },
              ],
            },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Conclusion" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Final thoughts." }],
            },
          ],
        }

        await setupEditor(content)

        // Check banner content
        expect(screen.getByText("Complex Article")).toBeInTheDocument()
        expect(screen.getByText("complex")).toBeInTheDocument()
        expect(screen.getByText("various")).toBeInTheDocument()

        // Check headings
        expect(
          screen.getByRole("heading", { level: 2, name: "Introduction" }),
        ).toBeInTheDocument()
        expect(
          screen.getByRole("heading", { level: 3, name: "Conclusion" }),
        ).toBeInTheDocument()

        // Check paragraphs
        expect(
          screen.getByText("First paragraph of content."),
        ).toBeInTheDocument()
        expect(screen.getByText("Final thoughts.")).toBeInTheDocument()

        // Check list
        expect(screen.getByText("List item one")).toBeInTheDocument()

        // Check blockquote
        expect(screen.getByText("Important quote")).toBeInTheDocument()
      })

      test("renders document with nested lists", async () => {
        const content: JSONContent = {
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
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Parent item" }],
                    },
                    {
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Nested item" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("Parent item")).toBeInTheDocument()
        expect(screen.getByText("Nested item")).toBeInTheDocument()
      })
    })

    describe("Document structure validation", () => {
      test("renders editor even with minimal valid structure", async () => {
        const content: JSONContent = {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [],
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

        await setupEditor(content)

        expect(screen.getByTestId("editor")).toBeInTheDocument()
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
      })

      test("renders document with empty banner subtitle", async () => {
        const content: JSONContent = {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: "Title Only" }],
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
              content: [{ type: "text", text: "Content paragraph" }],
            },
          ],
        }

        await setupEditor(content)

        expect(screen.getByText("Title Only")).toBeInTheDocument()
        expect(screen.getByText("Content paragraph")).toBeInTheDocument()
      })
    })
  })

  // Note: All "Content Editing and Saving" tests have been moved to
  // ArticleEditor.happydom.test.tsx to use Happy DOM environment, which better
  // supports DOM APIs like getClientRects needed by Tiptap editor.
  // The following tests were moved:
  // - Editing title in banner heading
  // - Editing paragraph content
  // - Save button states
  // - Save as Draft functionality
  // - Error handling during save
})
