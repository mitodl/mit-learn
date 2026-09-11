/**
 * @jest-environment @happy-dom/jest-environment
 *
 * Using the Happy DOM environment as the editor accesses DOM APIs and uses
 * contenteditable elements not supported by JSDOM, the default Jest environment.
 */
import React from "react"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls } from "api/test-utils"
import type { JSONContent } from "@tiptap/react"
import { ArticleEditor } from "./ArticleEditor"
import { renderWithProviders } from "@/test-utils"

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
        { type: "paragraph", content: [] },
      ],
    },
    { type: "byline" },
    { type: "paragraph", content: [] },
  ],
}

const renderArticleEditor = ({
  readOnly = false,
  isPublished = false,
}: { readOnly?: boolean; isPublished?: boolean } = {}) => {
  const user = factories.user.user({
    is_authenticated: true,
    is_article_editor: true,
  })
  setMockResponse.get(urls.userMe.get(), user)
  const article = factories.websiteContent.websiteContent({
    content,
    is_published: isPublished,
  })
  renderWithProviders(<ArticleEditor article={article} readOnly={readOnly} />, {
    user,
  })
  return article
}

describe("ArticleEditor", () => {
  test("mounts the live editor with an editable banner heading", async () => {
    renderArticleEditor()

    await screen.findByTestId("editor")
    await screen.findByRole("heading", { level: 1, name: "Article Title" })
  })

  test("renders the article breadcrumb bar in edit mode", async () => {
    renderArticleEditor()

    await screen.findByText("Articles")
  })
})

describe("ArticleEditor article controls", () => {
  test("the draft control bar carries the article actions and status", async () => {
    renderArticleEditor()

    await screen.findByRole("button", { name: "Settings" })
    await screen.findByRole("button", { name: "Save as Draft" })
    await screen.findByRole("button", { name: "Publish" })
    expect(await screen.findByText(/Article status:/)).toHaveTextContent(
      "Article status: Draft",
    )
  })

  test("a published article offers Draft, Edit, Settings and Unpublish", async () => {
    renderArticleEditor({ readOnly: true, isPublished: true })

    await screen.findByRole("link", { name: "Draft" })
    await screen.findByRole("link", { name: "Edit" })
    await screen.findByRole("button", { name: "Settings" })
    await screen.findByRole("button", { name: "Unpublish Article" })
    expect(await screen.findByText(/Article status:/)).toHaveTextContent(
      "Article status: Published",
    )
  })

  test("Settings opens the article settings drawer", async () => {
    setMockResponse.get(
      urls.topics.list({ is_toplevel: true, limit: 100 }),
      factories.learningResources.topics({ count: 2 }),
    )
    renderArticleEditor()

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )

    await screen.findByRole("heading", { name: "Article Settings" })
    await screen.findByRole("heading", { name: "Select Topics" })
    await screen.findByRole("heading", { name: "SEO Settings" })
    await screen.findByRole("button", { name: "Save Settings" })
  })

  test("the topic dropdowns populate from the topics API", async () => {
    const mainTopics = factories.learningResources.topics({ count: 2 })
    const [firstTopic] = mainTopics.results
    const subtopics = factories.learningResources.topics({ count: 1 })
    subtopics.results[0].parent = firstTopic.id

    // Top-level topics and a given parent's children are separate requests,
    // so a subtopic resolves even when its parent is absent from the other.
    setMockResponse.get(
      urls.topics.list({ is_toplevel: true, limit: 100 }),
      mainTopics,
    )
    setMockResponse.get(
      urls.topics.list({ parent_topic_id: [firstTopic.id], limit: 100 }),
      subtopics,
    )

    renderArticleEditor()
    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )

    // Pick the main topic, which is what triggers the subtopic request.
    await userEvent.click(await screen.findByLabelText("Topic"))
    await userEvent.click(
      await screen.findByRole("option", { name: firstTopic.name }),
    )

    await userEvent.click(await screen.findByLabelText("Subtopic"))
    await screen.findByRole("option", { name: subtopics.results[0].name })
  })
})
