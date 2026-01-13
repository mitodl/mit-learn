import React from "react"
import { screen, renderWithProviders, setMockResponse } from "@/test-utils"
import { factories, urls } from "api/test-utils"
import { ArticleEditor } from "./ArticleEditor"

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe("ArticleEditor", () => {
  test("renders article content in read-only mode", async () => {
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
    const article = factories.articles.article({
      id: 42,
      title: "Existing Title",
      content: {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Existing Title" }],
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
    })
    renderWithProviders(<ArticleEditor article={article} readOnly />)
    expect(await screen.findByText("Existing Title")).toBeInTheDocument()
    consoleWarnSpy.mockRestore()
  })

  test("renders article with content in read-only mode", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.articles.article({
      id: 123,
      title: "Article Title",
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
            content: [{ type: "text", text: "Article content here" }],
          },
        ],
      },
    })
    renderWithProviders(<ArticleEditor article={article} readOnly />)
    expect(await screen.findByText("Article Title")).toBeInTheDocument()
    expect(await screen.findByText("Article content here")).toBeInTheDocument()
  })

  test("shows edit button for article editors in read-only mode", async () => {
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
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Old Title" }],
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
            content: [{ type: "text", text: "Article Title" }],
          },
        ],
      },
    })
    renderWithProviders(<ArticleEditor article={article} readOnly />)
    expect(
      await screen.findByRole("link", { name: "Edit" }),
    ).toBeInTheDocument()
  })
})
