/**
 * @jest-environment @happy-dom/jest-environment
 *
 * Using the Happy DOM environment as the editor accesses DOM APIs and uses
 * contenteditable elements not supported by JSDOM, the default Jest environment.
 */
import React from "react"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls, makeRequest } from "api/test-utils"
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
  topics = [],
}: {
  readOnly?: boolean
  isPublished?: boolean
  topics?: number[]
} = {}) => {
  const user = factories.user.user({
    is_authenticated: true,
    is_article_editor: true,
  })
  setMockResponse.get(urls.userMe.get(), user)
  const article = factories.websiteContent.websiteContent({
    content,
    is_published: isPublished,
    topics,
  })
  renderWithProviders(<ArticleEditor article={article} readOnly={readOnly} />, {
    user,
  })
  return { article }
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
    await screen.findByRole("button", { name: "Publish Article" })
    expect(await screen.findByText(/Article status:/)).toHaveTextContent(
      "Article status: Draft",
    )
    /* A draft writes itself now, so there is nothing to press. */
    expect(screen.queryByRole("button", { name: "Save as Draft" })).toBe(null)
  })

  test("a published article offers Draft, Edit and Settings", async () => {
    renderArticleEditor({ readOnly: true, isPublished: true })

    await screen.findByRole("link", { name: "Draft" })
    await screen.findByRole("link", { name: "Edit" })
    await screen.findByRole("button", { name: "Settings" })
    expect(await screen.findByText(/Article status:/)).toHaveTextContent(
      "Article status: Published",
    )
    /* Unpublishing lives on the listing card's menu, not here. */
    expect(screen.queryByRole("button", { name: "Unpublish Article" })).toBe(
      null,
    )
  })

  test("Settings opens the article settings drawer", async () => {
    setMockResponse.get(
      urls.topics.list({ limit: 1000 }),
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

    // One request for every topic; the drawer splits them by `parent` to fill
    // the two selects.
    setMockResponse.get(urls.topics.list({ limit: 1000 }), {
      ...mainTopics,
      count: 3,
      results: [...mainTopics.results, ...subtopics.results],
    })

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

  test("added subtopics group under one topic name and can be removed", async () => {
    const mainTopics = factories.learningResources.topics({ count: 1 })
    const [topic] = mainTopics.results
    const subtopics = factories.learningResources.topics({ count: 2 })
    subtopics.results.forEach((s) => {
      s.parent = topic.id
    })
    const [subA, subB] = subtopics.results

    setMockResponse.get(urls.topics.list({ limit: 1000 }), {
      ...mainTopics,
      count: 3,
      results: [...mainTopics.results, ...subtopics.results],
    })

    renderArticleEditor()
    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )

    await userEvent.click(await screen.findByLabelText("Topic"))
    await userEvent.click(
      await screen.findByRole("option", { name: topic.name }),
    )

    // Add both subtopics under the same topic.
    for (const sub of [subA, subB]) {
      await userEvent.click(await screen.findByLabelText("Subtopic"))
      await userEvent.click(
        await screen.findByRole("option", { name: sub.name }),
      )
      await userEvent.click(screen.getByRole("button", { name: "Add" }))
    }

    // Scoped to the list: the Topic select also still displays the name.
    const selected = screen.getByRole("list", { name: "Selected topics" })
    // The topic name labels the group once, not once per subtopic.
    expect(within(selected).getAllByText(topic.name)).toHaveLength(1)
    const removeA = await screen.findByRole("button", {
      name: `Remove ${subA.name} from ${topic.name}`,
    })
    await screen.findByRole("button", {
      name: `Remove ${subB.name} from ${topic.name}`,
    })

    await userEvent.click(removeA)

    expect(
      screen.queryByRole("button", {
        name: `Remove ${subA.name} from ${topic.name}`,
      }),
    ).not.toBeInTheDocument()
    // Removing one leaves the other, and the group label with it.
    await screen.findByRole("button", {
      name: `Remove ${subB.name} from ${topic.name}`,
    })
    expect(
      within(
        screen.getByRole("list", { name: "Selected topics" }),
      ).getAllByText(topic.name),
    ).toHaveLength(1)
  })
})

describe("ArticleEditor settings", () => {
  test("saving settings PATCHes the chosen topics and nothing else", async () => {
    const mainTopics = factories.learningResources.topics({ count: 1 })
    const [topic] = mainTopics.results
    setMockResponse.get(urls.topics.list({ limit: 1000 }), mainTopics)

    const { article } = renderArticleEditor()
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.click(await screen.findByLabelText("Topic"))
    await userEvent.click(
      await screen.findByRole("option", { name: topic.name }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Add" }))
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    // The exact body matters as much as the topics: sending the editor's
    // current content or published state here would push unsaved edits live.
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: { topics: [topic.id] },
        }),
      )
    })
  })

  test("an article's saved topics are already selected when the drawer opens", async () => {
    const mainTopics = factories.learningResources.topics({ count: 1 })
    const [topic] = mainTopics.results
    setMockResponse.get(urls.topics.list({ limit: 1000 }), mainTopics)

    renderArticleEditor({ topics: [topic.id] })

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )

    await screen.findByRole("button", { name: `Remove ${topic.name}` })
  })
})

/**
 * An article cannot be saved without topics, which is its own describe below.
 * These are about the confirmation dialog, so they start from one that has
 * them -- as an article being published in earnest would.
 */
const renderTopicalArticle = (
  options: Parameters<typeof renderArticleEditor>[0] = {},
) => renderArticleEditor({ topics: [7], ...options })

describe("ArticleEditor publish confirmation", () => {
  test("publishing a draft asks for confirmation first", async () => {
    const { article } = renderTopicalArticle()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )

    // Nothing is saved until the dialog is confirmed.
    await screen.findByRole("heading", { name: "Publish article" })
    await screen.findByText(
      "Publishing this article will make it publicly available. You can unpublish it again at any time.",
    )
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )

    await userEvent.click(
      screen.getByRole("button", { name: "Yes, Publish article" }),
    )

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: expect.objectContaining({ is_published: true }),
        }),
      )
    })
  })

  test("cancelling the publish dialog saves nothing", async () => {
    renderTopicalArticle()

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )
    await screen.findByRole("heading", { name: "Publish article" })
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
  })

  test("re-saving an already published article does not ask", async () => {
    // The dialog confirms the transition to public, not every save, so editing
    // a live article and pressing Publish must save straight away.
    const { article } = renderTopicalArticle({ isPublished: true })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    const heading = await screen.findByRole("heading", { level: 1 })
    await userEvent.click(heading)
    await userEvent.type(heading, " edited")

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )

    expect(
      screen.queryByRole("heading", { name: "Publish article" }),
    ).not.toBeInTheDocument()
  })
})

describe("ArticleEditor publish confirmation errors", () => {
  /**
   * Dialog closes only once `onConfirm` resolves, so the confirmation callback
   * has to hand back the save's promise. With the callback form of `mutate`
   * the callback returned void, the dialog closed immediately, and a failed
   * save was dismissed as though it had worked.
   */
  test("a failed publish leaves the confirmation open", async () => {
    const { article } = renderTopicalArticle()
    setMockResponse.patch(
      urls.websiteContent.details(article.id),
      { detail: "boom" },
      { code: 500 },
    )

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )
    await screen.findByRole("heading", { name: "Publish article" })
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, Publish article" }),
    )

    // The request was attempted...
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "patch" }),
      )
    })
    // ...and because it failed, the dialog is still there to retry from.
    expect(
      screen.getByRole("heading", { name: "Publish article" }),
    ).toBeInTheDocument()

    /**
     * The failure is reported inside the dialog. MUI marks the rest of the page
     * aria-hidden while a modal is open, so the editor's page-level alert is
     * announced to nobody here however it is stacked -- role="alert" only
     * resolves because this one lives inside the dialog.
     */
    const dialog = screen.getByRole("dialog")
    within(dialog).getByRole("alert")
  })

  test("a successful publish closes the confirmation", async () => {
    const { article } = renderTopicalArticle()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )
    await screen.findByRole("heading", { name: "Publish article" })
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, Publish article" }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Publish article" }),
      ).not.toBeInTheDocument()
    })
  })
})

describe("ArticleEditor topics requirement", () => {
  const mockTopics = () => {
    const topics = factories.learningResources.topics({ count: 2 })
    setMockResponse.get(urls.topics.list({ limit: 1000 }), topics)
    return topics.results[0]
  }

  test("publishing with no topics asks for them instead", async () => {
    mockTopics()
    renderArticleEditor()

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )

    // The drawer, not the publish confirmation, and nothing saved.
    await screen.findByRole("heading", { name: "Article Settings" })
    expect(
      screen.queryByRole("heading", { name: "Publish article" }),
    ).not.toBeInTheDocument()
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
    /* The section says why it opened, rather than leaving the editor to guess. */
    await screen.findByText("Select at least one topic to save your article")
  })

  test("a draft saves itself without them, rather than asking", async () => {
    mockTopics()
    const { article } = renderArticleEditor()
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.type(await screen.findByRole("heading", { level: 1 }), "!")

    // Autosave cannot stop to ask, so the requirement is the publish's alone.
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "patch",
            body: expect.objectContaining({ is_published: false }),
          }),
        )
      },
      { timeout: 6000 },
    )
    expect(screen.queryByRole("heading", { name: "Article Settings" })).toBe(
      null,
    )
  }, 15000)

  test("the held-back publish resumes once a topic is picked", async () => {
    const topic = mockTopics()
    const { article } = renderArticleEditor()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )
    await screen.findByRole("heading", { name: "Article Settings" })

    await userEvent.click(await screen.findByLabelText("Topic"))
    await userEvent.click(
      await screen.findByRole("option", { name: topic.name }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Add" }))
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    // Picking up where the press left off, confirmation included.
    await userEvent.click(
      await screen.findByRole("button", { name: "Yes, Publish article" }),
    )

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: expect.objectContaining({
            is_published: true,
            /* Carried by the save itself, not a separate topics PATCH. */
            topics: [topic.id],
          }),
        }),
      )
    })
  })

  test("closing the drawer abandons the held-back publish", async () => {
    const topic = mockTopics()
    const { article } = renderArticleEditor()
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish Article" }),
    )
    await screen.findByRole("heading", { name: "Article Settings" })
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    // Topics saved later are just topics: the abandoned press must not fire.
    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.click(await screen.findByLabelText("Topic"))
    await userEvent.click(
      await screen.findByRole("option", { name: topic.name }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Add" }))
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: { topics: [topic.id] },
        }),
      )
    })
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: "patch",
        body: expect.objectContaining({ is_published: true }),
      }),
    )
  })
})

describe("ArticleEditor autosave", () => {
  test("a draft saves itself once typing stops", async () => {
    const { article } = renderArticleEditor()
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )

    // Not on every keystroke: the write waits for the typing to stop.
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )

    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "patch",
            url: urls.websiteContent.details(article.id),
            body: expect.objectContaining({ is_published: false }),
          }),
        )
      },
      { timeout: 6000 },
    )
  }, 15000)

  test("a published article is never saved behind the author's back", async () => {
    const { article } = renderArticleEditor({ isPublished: true, topics: [7] })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )
    await new Promise((resolve) => setTimeout(resolve, 3500))

    /* Edits to something public go live only when Publish is pressed. */
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
  }, 15000)

  test("the control bar reports the save", async () => {
    const { article } = renderArticleEditor()
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    // Nothing is claimed before there is anything to save.
    expect(screen.queryByText("Saved")).toBe(null)

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )

    await screen.findByText("Saved", {}, { timeout: 6000 })
  }, 15000)
})

describe("ArticleEditor edit-mode control bar layout", () => {
  test("stacks the actions above the formatting controls", async () => {
    renderArticleEditor()

    const publish = await screen.findByRole("button", {
      name: "Publish Article",
    })
    const undo = screen.getByRole("button", { name: "Undo" })
    const bar = screen.getByRole("toolbar")

    // Two rows, in this order: the actions, then the formatting controls.
    expect(bar.children).toHaveLength(2)
    const [actionRow, formattingRow] = Array.from(bar.children)
    expect(actionRow).toContainElement(publish)
    expect(formattingRow).toContainElement(undo)
  })
})
