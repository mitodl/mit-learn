import React from "react"
import { screen, renderWithProviders, setMockResponse } from "@/test-utils"
import { factories, urls } from "api/test-utils"
import { ArticleEditor } from "./ArticleEditor"

describe("ArticleViewer", () => {
  test("renders article content", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      content: {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: {
                  textAlign: null,
                  level: 1,
                },
                content: [
                  {
                    type: "text",
                    text: "Test Title",
                  },
                ],
              },
              {
                type: "paragraph",
                attrs: {
                  textAlign: null,
                },
                content: [
                  {
                    type: "text",
                    text: "Test subheading",
                  },
                ],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            attrs: {
              textAlign: null,
            },
            content: [
              {
                type: "text",
                text: "Test content",
              },
            ],
          },
        ],
      },
    })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    await screen.findByRole("heading", { name: "Test Title", level: 1 })
    await screen.findByText("Test subheading")
    await screen.findByText("Test content")
  })

  test("renders editor name in byline", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const authorName = `${user.first_name} ${user.last_name}`
    const article = factories.articles.article({
      user,
      author_name: authorName,
    })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    await screen.findByText(`By ${authorName}`)
  })

  test("renders headings levels 1-6", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      content: {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: {
                  textAlign: null,
                  level: 1,
                },
                content: [
                  {
                    type: "text",
                    text: "Article Title",
                  },
                ],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "heading",
            attrs: {
              textAlign: null,
              level: 1,
            },
            content: [
              {
                type: "text",
                text: "Heading Level 1",
              },
            ],
          },
          {
            type: "heading",
            attrs: {
              textAlign: null,
              level: 2,
            },
            content: [
              {
                type: "text",
                text: "Heading Level 2",
              },
            ],
          },
          {
            type: "heading",
            attrs: {
              textAlign: null,
              level: 3,
            },
            content: [
              {
                type: "text",
                text: "Heading Level 3",
              },
            ],
          },
          {
            type: "heading",
            attrs: {
              textAlign: null,
              level: 4,
            },
            content: [
              {
                type: "text",
                text: "Heading Level 4",
              },
            ],
          },
          {
            type: "heading",
            attrs: {
              textAlign: null,
              level: 5,
            },
            content: [
              {
                type: "text",
                text: "Heading Level 5",
              },
            ],
          },
          {
            type: "heading",
            attrs: {
              textAlign: null,
              level: 6,
            },
            content: [
              {
                type: "text",
                text: "Heading Level 6",
              },
            ],
          },
        ],
      },
    })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    await screen.findByRole("heading", { level: 1, name: "Heading Level 1" })
    await screen.findByRole("heading", { level: 2, name: "Heading Level 2" })
    await screen.findByRole("heading", { level: 3, name: "Heading Level 3" })
    await screen.findByRole("heading", { level: 4, name: "Heading Level 4" })
    await screen.findByRole("heading", { level: 5, name: "Heading Level 5" })
    await screen.findByRole("heading", { level: 6, name: "Heading Level 6" })
  })

  test("renders ordered and unordered lists", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      content: {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: {
                  textAlign: null,
                  level: 1,
                },
                content: [
                  {
                    type: "text",
                    text: "Article Title",
                  },
                ],
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
                    type: "text",
                    text: "First unordered item",
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "text",
                    text: "Second unordered item",
                  },
                ],
              },
            ],
          },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "text",
                    text: "First ordered item",
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "text",
                    text: "Second ordered item",
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    const firstUnordered = await screen.findByText("First unordered item")
    const secondUnordered = await screen.findByText("Second unordered item")
    const firstOrdered = await screen.findByText("First ordered item")
    const secondOrdered = await screen.findByText("Second ordered item")

    expect(firstUnordered.closest("li")).toBeTruthy()
    expect(secondUnordered.closest("li")).toBeTruthy()
    expect(firstOrdered.closest("li")).toBeTruthy()
    expect(secondOrdered.closest("li")).toBeTruthy()

    const lists = screen.getAllByRole("list")
    const unorderedList = lists.find((list) => list.tagName === "UL")
    const orderedList = lists.find((list) => list.tagName === "OL")

    expect(unorderedList).toBeDefined()
    expect(orderedList).toBeDefined()
  })

  test("renders inline marks including bold, italic, code and underline", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      content: {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: {
                  textAlign: null,
                  level: 1,
                },
                content: [
                  {
                    type: "text",
                    text: "Article Title",
                  },
                ],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            attrs: {
              textAlign: null,
            },
            content: [
              {
                type: "text",
                text: "This is ",
              },
              {
                type: "text",
                marks: [{ type: "bold" }],
                text: "bold text",
              },
              {
                type: "text",
                text: ", ",
              },
              {
                type: "text",
                marks: [{ type: "italic" }],
                text: "italic text",
              },
              {
                type: "text",
                text: ", ",
              },
              {
                type: "text",
                marks: [{ type: "code" }],
                text: "code text",
              },
              {
                type: "text",
                text: ", and ",
              },
              {
                type: "text",
                marks: [{ type: "underline" }],
                text: "underlined text",
              },
              {
                type: "text",
                text: ".",
              },
            ],
          },
        ],
      },
    })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    const boldText = await screen.findByText("bold text")
    expect(boldText).toBeInTheDocument()
    expect(
      boldText.closest("strong") || boldText.closest("b"),
    ).toBeInTheDocument()

    const italicText = screen.getByText("italic text")
    expect(italicText).toBeInTheDocument()
    expect(
      italicText.closest("em") || italicText.closest("i"),
    ).toBeInTheDocument()

    const codeText = screen.getByText("code text")
    expect(codeText).toBeInTheDocument()
    expect(codeText.closest("code")).toBeInTheDocument()

    const underlinedText = screen.getByText("underlined text")
    expect(underlinedText).toBeInTheDocument()
    expect(underlinedText.closest("u")).toBeInTheDocument()
  })

  test("renders links", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)

    const article = factories.articles.article({
      content: {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: {
                  textAlign: null,
                  level: 1,
                },
                content: [
                  {
                    type: "text",
                    text: "Article Title",
                  },
                ],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            attrs: {
              textAlign: null,
            },
            content: [
              {
                type: "text",
                text: "Visit ",
              },
              {
                type: "text",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "https://example.com",
                      target: "_blank",
                    },
                  },
                ],
                text: "example.com",
              },
              {
                type: "text",
                text: " for more information.",
              },
            ],
          },
        ],
      },
    })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    const link = await screen.findByRole("link", { name: "example.com" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "https://example.com")
    expect(link).toHaveAttribute("target", "_blank")
  })

  test("shows edit button for article editors", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.articles.article()
    renderWithProviders(<ArticleEditor article={article} readOnly />)

    await screen.findByRole("link", { name: "Edit" })
  })
})
