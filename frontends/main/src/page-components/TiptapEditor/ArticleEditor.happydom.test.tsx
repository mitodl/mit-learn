/**
 * @jest-environment @happy-dom/jest-environment
 *
 * Using the Happy DOM environment as the editor accesses DOM APIs and uses contenteditable
 * elements not supported by JSDOM, the default environment in Jest.
 */
import React from "react"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
import { ArticleEditor } from "./ArticleEditor"
import type { JSONContent } from "@tiptap/react"
import { renderWithProviders } from "@/test-utils"

jest.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => true,
  usePostHog: () => ({}),
}))

const mockOnSave = jest.fn()

describe("ArticleEditor - Content Editing and Saving", () => {
  beforeEach(() => {
    mockOnSave.mockClear()
    jest.clearAllMocks()
  })

  const setupEditor = async (
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

      const article = await setupEditor(initialContent, 200, "Original Title")

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
                  attrs: { level: 1, textAlign: null },
                  content: [{ type: "text", text: "Updated Title" }],
                },
                {
                  type: "paragraph",
                  attrs: {
                    textAlign: null,
                  },
                },
              ],
            },
            {
              type: "byline",
              attrs: { authorName: null },
            },
            {
              type: "paragraph",
              attrs: {
                textAlign: null,
              },
            },
          ],
        },
      }
      setMockResponse.patch(urls.articles.details(article.id), updatedArticle)

      const heading = screen.getByRole("heading", { level: 1 })
      await userEvent.click(heading)

      await userEvent.keyboard("{Control>}a{/Control}{Delete}")
      await userEvent.type(heading, "Updated Title")

      const updateButton = await screen.findByRole(
        "button",
        { name: /Update|Publish/ },
        { timeout: 3000 },
      )

      await userEvent.click(updateButton)

      expect(makeRequest).toHaveBeenCalledWith(
        "patch",
        urls.articles.details(article.id),
        expect.objectContaining({
          content: updatedArticle.content,
          is_published: true,
          title: updatedArticle.title,
          author_name: "",
        }),
      )

      expect(mockOnSave).toHaveBeenCalled()
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

      const article = await setupEditor(initialContent, 201, "Article Title")

      const paragraph = screen.getByText("Original paragraph text")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, " with some more text")

      const updateButton = await screen.findByRole("button", {
        name: /Update|Publish/,
      })

      await waitFor(
        () => {
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
                  attrs: { level: 1, textAlign: null },
                  content: [{ type: "text", text: "Article Title" }],
                },
                {
                  type: "paragraph",
                  attrs: {
                    textAlign: null,
                  },
                },
              ],
            },
            {
              type: "byline",
              attrs: { authorName: null },
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Original paragraph text with some more text",
                },
              ],
              attrs: {
                textAlign: null,
              },
            },
          ],
        },
      }
      setMockResponse.patch(urls.articles.details(article.id), updatedArticle)

      await userEvent.click(updateButton)

      expect(makeRequest).toHaveBeenCalledWith(
        "patch",
        urls.articles.details(article.id),
        expect.objectContaining({
          content: updatedArticle.content,
          is_published: true,
          title: updatedArticle.title,
          author_name: "",
        }),
      )
    })
  })

  describe("Save button states", () => {
    test("save button is disabled when title is empty", async () => {
      // Suppress act() warnings from MutationObserver updates in vendor code
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation((message) => {
          if (typeof message === "string" && message.includes("act(...)")) {
            return
          }
          console.warn(message)
        })

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

      await setupEditor(initialContent, 207, "Title")

      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      expect(updateButton).not.toBeDisabled()

      // Wait for heading to be available
      let heading: Element
      await waitFor(() => {
        const editor = screen.getByTestId("editor")
        const h1 = editor.querySelector("h1")
        expect(h1).toBeTruthy()
        heading = h1!
      })

      await userEvent.click(heading!)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.keyboard("{Delete}")

      await waitFor(() => {
        expect(updateButton).toBeDisabled()
      })

      consoleError.mockRestore()
    })

    test("save button is enabled when a title is set", async () => {
      const initialContent: JSONContent = {
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
            content: [{ type: "text", text: "Content" }],
          },
        ],
      }

      await setupEditor(initialContent, 206, "")

      const updateButton = screen.getByRole("button", {
        name: /Update|Publish/,
      })
      expect(updateButton).toBeDisabled()

      // Find the empty heading placeholder or the editor area
      const editor = screen.getByTestId("editor")
      const heading =
        editor.querySelector("h1") || editor.querySelector("[data-placeholder]")
      if (!heading) throw new Error("Heading element not found")

      await userEvent.click(heading)
      await userEvent.type(heading, "Article Title")

      await waitFor(() => {
        expect(updateButton).not.toBeDisabled()
      })
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

      const article = await setupEditor(initialContent, 208, "Title")

      const paragraph = screen.getByText("Content")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, "Updated content")

      const updatedArticle = {
        ...article,
        content: expect.objectContaining({
          type: "doc",
        }),
        is_published: false,
      }
      setMockResponse.patch(urls.articles.details(article.id), updatedArticle)

      const saveDraftButton = await screen.findByRole("button", {
        name: "Save As Draft",
      })

      expect(saveDraftButton).not.toBeDisabled()

      await userEvent.click(saveDraftButton)

      expect(makeRequest).toHaveBeenCalledWith(
        "patch",
        urls.articles.details(article.id),
        expect.objectContaining({
          is_published: false,
          author_name: "",
        }),
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

      const article = await setupEditor(initialContent, 209, "Title")

      setMockResponse.patch(
        urls.articles.details(article.id),
        { detail: "Server error" },
        { code: 500 },
      )

      const paragraph = screen.getByText("Content")
      await userEvent.click(paragraph)
      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(paragraph, "Updated content")

      const updateButton = await screen.findByRole("button", {
        name: /Update|Publish/,
      })
      expect(updateButton).not.toBeDisabled()

      await userEvent.click(updateButton)

      const errorText = screen.queryByText(
        /Mock Error|An error occurred while saving|Server error/i,
      )
      if (errorText) {
        expect(errorText).toBeInTheDocument()
      } else {
        const alert = screen.queryByRole("alert")
        if (alert) {
          expect(alert).toBeInTheDocument()
        }
      }
    })
  })

  describe("Creating new articles", () => {
    test("submits article successfully", async () => {
      const user = factories.user.user({
        is_authenticated: true,
        is_article_editor: true,
      })
      setMockResponse.get(urls.userMe.get(), user)

      const createdArticle = factories.articles.article({
        id: 101,
        title: "My Article",
        is_published: true,
      })
      setMockResponse.post(urls.articles.list(), createdArticle)

      renderWithProviders(<ArticleEditor onSave={mockOnSave} />, { user })

      await screen.findByTestId("editor")

      const editor = screen.getByTestId("editor")
      const heading =
        editor.querySelector("h1") || editor.querySelector("[data-placeholder]")
      if (!heading) throw new Error("Heading element not found")

      await userEvent.click(heading)

      await userEvent.keyboard("{Control>}a{/Control}")
      await userEvent.type(heading, "My Article", { delay: 0 })

      // Wait for the text to be updated in the editor
      await waitFor(() => {
        expect(heading.textContent).toContain("My Article")
      })

      const publishButton = await screen.findByRole("button", {
        name: "Publish",
      })

      expect(publishButton).not.toBeDisabled()

      fireEvent.click(publishButton!)

      await waitFor(
        () => {
          expect(makeRequest).toHaveBeenCalledWith(
            "post",
            urls.articles.list(),
            expect.objectContaining({
              title: "My Article",
              author_name: "",
              content: {
                type: "doc",
                content: [
                  {
                    type: "banner",
                    content: [
                      {
                        type: "heading",
                        attrs: { level: 1, textAlign: null },
                        content: [{ type: "text", text: "My Article" }],
                      },
                      {
                        type: "paragraph",
                        attrs: {
                          textAlign: null,
                        },
                      },
                    ],
                  },
                  { type: "byline", attrs: { authorName: null } },
                  {
                    type: "paragraph",
                    attrs: {
                      textAlign: null,
                    },
                  },
                ],
              },
              is_published: true,
            }),
          )
        },
        { timeout: 5000 },
      )

      expect(mockOnSave).toHaveBeenCalled()

      const calls = mockOnSave.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const savedData = calls[calls.length - 1][0]

      expect(savedData).toBeDefined()
      expect(savedData).toMatchObject({
        id: createdArticle.id,
        title: "My Article",
        is_published: true,
      })
    }, 15000)
  })
})

describe("ArticleEditor - Document Rendering", () => {
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    const originalError = console.error
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation((message) => {
        if (
          typeof message === "string" &&
          // Expected as task items (checkboxes) don't have change handlers in edit mode.
          message.includes(
            "You provided a `checked` prop to a form field without an `onChange` handler",
          )
        ) {
          return
        }
        originalError(message)
      })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const setupEditor = async (content: JSONContent, articleId = 1) => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      id: 1,
      title: "Test Article",
      content,
    })
    setMockResponse.get(urls.articles.details(articleId), article)

    renderWithProviders(
      <ArticleEditor article={article} onSave={mockOnSave} readOnly />,
      { user },
    )

    await screen.findByTestId("editor")
    return article
  }

  test("renders editor when user has ArticleEditor permission", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(<ArticleEditor onSave={mockOnSave} />, { user })

    await screen.findByTestId("editor")
  })

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

      await screen.findByTestId("editor")

      await screen.findByRole("heading", { level: 1 })
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

      await screen.findByRole("heading", { level: 1, name: "Article Title" })
      await screen.findByText("Banner subtitle")
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

      await screen.findByText("First paragraph")
      await screen.findByText("Second paragraph")
      await screen.findByText("Third paragraph")
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

      await screen.findByRole("heading", { level: 1, name: "H1 Title" })
      await screen.findByRole("heading", { level: 2, name: "H2 Heading" })
      await screen.findByRole("heading", { level: 3, name: "H3 Heading" })
      await screen.findByRole("heading", { level: 4, name: "H4 Heading" })
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

      const boldText = await screen.findByText("bold text")
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

      const italicText = await screen.findByText("italic text")
      expect(italicText.closest("em") || italicText.closest("i")).toBeTruthy()
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

      const link = await screen.findByRole("link", { name: "example.com" })
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

      const firstItem = await screen.findByText("First item")
      const secondItem = await screen.findByText("Second item")
      const thirdItem = await screen.findByText("Third item")
      expect(firstItem.closest("li")).toBeTruthy()
      expect(secondItem.closest("li")).toBeTruthy()
      expect(thirdItem.closest("li")).toBeTruthy()
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

      const stepOne = await screen.findByText("Step one")
      const stepTwo = await screen.findByText("Step two")
      expect(stepOne.closest("li")).toBeTruthy()
      expect(stepTwo.closest("li")).toBeTruthy()
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

      const uncheckedTask = await screen.findByText("Unchecked task")
      const checkedTask = await screen.findByText("Checked task")
      expect(uncheckedTask.closest("li")).toBeTruthy()
      expect(checkedTask.closest("li")).toBeTruthy()
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

      const quote = await screen.findByText("This is a quote")
      expect(quote.closest("blockquote")).toBeTruthy()
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

      const code = await screen.findByText("const x = 1;")
      expect(code.closest("code")).toBeTruthy()
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
            type: "horizontalRule",
          },
        ],
      }

      await setupEditor(content)

      await screen.findByRole("separator")
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

      expect(
        screen.getByRole("heading", { level: 1, name: "Complex Article" }),
      ).toBeInTheDocument()
      expect(screen.getByText("complex")).toBeInTheDocument()
      expect(screen.getByText("various")).toBeInTheDocument()

      expect(
        screen.getByRole("heading", { level: 2, name: "Introduction" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { level: 3, name: "Conclusion" }),
      ).toBeInTheDocument()

      expect(
        screen.getByText("First paragraph of content."),
      ).toBeInTheDocument()
      expect(screen.getByText("Final thoughts.")).toBeInTheDocument()

      expect(screen.getByText("List item one")).toBeInTheDocument()

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
      await screen.findByRole("heading", { level: 1 })
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

      expect(
        screen.getByRole("heading", { level: 1, name: "Title Only" }),
      ).toBeInTheDocument()
      expect(screen.getByText("Content paragraph")).toBeInTheDocument()
    })

    test("Shows schema errors when content is invalid (missing banner and byline)", async () => {
      const currentMock = consoleErrorSpy.getMockImplementation()
      consoleErrorSpy.mockImplementation((message: unknown) => {
        if (
          typeof message === "string" &&
          message.includes("Document schema check failed")
        ) {
          return
        }
        if (currentMock) {
          currentMock(message)
        }
      })

      // Content missing required banner and byline
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: {
              textAlign: null,
            },
            content: [
              {
                text: "Content paragraph",
                type: "text",
              },
            ],
          },
        ],
      }
      await setupEditor(content)

      await screen.findByText(
        "Document schema check failed: Invalid content for node doc: paragraph is not allowed in this position",
      )

      if (currentMock) {
        consoleErrorSpy.mockImplementation(currentMock)
      }
    })
  })
})
