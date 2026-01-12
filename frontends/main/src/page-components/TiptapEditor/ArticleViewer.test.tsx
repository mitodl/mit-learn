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

    await screen.findByText("Test Title")
    await screen.findByText("Test subheading")
    await screen.findByText("Test content")
  })

  test("renders editor name in byline", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.articles.article({ user })

    renderWithProviders(<ArticleEditor article={article} readOnly />)

    await screen.findByText(`By ${user.first_name} ${user.last_name}`)
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
