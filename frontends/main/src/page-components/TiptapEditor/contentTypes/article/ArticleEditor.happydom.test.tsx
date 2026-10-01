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

/**
 * Far enough out that no draft saves itself while a test works. A background
 * write landing mid-interaction re-renders the toolbar, and the update lands
 * outside `act` -- which failed these suites intermittently, a different test
 * each time. The tests that are about autosave set their own delay.
 */
const AUTOSAVE_OFF = 10 * 60 * 1000

/** What production uses; the autosave tests wait this out deliberately. */
const AUTOSAVE_DELAY_MS = 2000

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

/** The same document, with the banner's subheading filled in. */
const withSubheading = (text: string): JSONContent => ({
  ...content,
  content: [
    {
      type: "banner",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Article Title" }],
        },
        { type: "paragraph", content: [{ type: "text", text }] },
      ],
    },
    { type: "byline" },
    { type: "paragraph", content: [] },
  ],
})

const renderArticleEditor = ({
  readOnly = false,
  isPublished = false,
  topics = [],
  seoTitleOverride = "",
  seoDescriptionOverride = "",
  subheading = "",
  autosaveDelayMs = AUTOSAVE_OFF,
}: {
  readOnly?: boolean
  isPublished?: boolean
  topics?: number[]
  seoTitleOverride?: string
  seoDescriptionOverride?: string
  /**
   * The banner's subheading, which is what an SEO description falls back to.
   * Blank by default, matching `content` below -- so an article with neither
   * an override nor a subheading has no description to resolve, which is the
   * one case publishing still has to ask about.
   */
  subheading?: string
  autosaveDelayMs?: number
} = {}) => {
  const user = factories.user.user({
    is_authenticated: true,
    is_article_editor: true,
  })
  setMockResponse.get(urls.userMe.get(), user)
  const article = factories.websiteContent.websiteContent({
    content: subheading ? withSubheading(subheading) : content,
    is_published: isPublished,
    topics,
    seo_title_override: seoTitleOverride,
    seo_description_override: seoDescriptionOverride,
    /* As the serializer resolves them: the override, else the content. */
    seo_title: seoTitleOverride || "Article Title",
    seo_description: seoDescriptionOverride || subheading,
  })
  renderWithProviders(
    <ArticleEditor
      article={article}
      readOnly={readOnly}
      autosaveDelayMs={autosaveDelayMs}
    />,
    { user },
  )
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
    await screen.findByRole("button", { name: "Publish" })
    expect(await screen.findByText(/Status:/)).toHaveTextContent(
      "Status: Draft",
    )
    /* A draft writes itself now, so there is nothing to press. */
    expect(screen.queryByRole("button", { name: "Save as Draft" })).toBe(null)
  })

  test("a published article offers Draft, Edit and Settings", async () => {
    renderArticleEditor({ readOnly: true, isPublished: true })

    await screen.findByRole("link", { name: "Draft" })
    await screen.findByRole("link", { name: "Edit" })
    await screen.findByRole("button", { name: "Settings" })
    expect(await screen.findByText(/Status:/)).toHaveTextContent(
      "Status: Published",
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
  test("saving settings PATCHes the drawer's values and nothing else", async () => {
    const mainTopics = factories.learningResources.topics({ count: 1 })
    const [topic] = mainTopics.results
    setMockResponse.get(urls.topics.list({ limit: 1000 }), mainTopics)

    /* The SEO fields are required too, so they arrive already written -- this
       test is about what the save sends, not about the requirement. */
    const { article } = renderArticleEditor({
      subheading: "The line under the headline.",
    })
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
          body: {
            topics: [topic.id],
            seo_title_override: "",
            seo_description_override: "",
          },
        }),
      )
    })
  })

  test("saving settings PATCHes the SEO fields", async () => {
    setMockResponse.get(
      urls.topics.list({ limit: 1000 }),
      factories.learningResources.topics({ count: 1 }),
    )
    /* A topic is required to save as well, so the article has one already. */
    const { article } = renderArticleEditor({ topics: [7] })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.type(
      await screen.findByLabelText(/^SEO Title/),
      "A better title for search",
    )
    await userEvent.type(
      screen.getByLabelText(/^SEO Description/),
      "What this is about.",
    )
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: {
            topics: [7],
            seo_title_override: "A better title for search",
            seo_description_override: "What this is about.",
          },
        }),
      )
    })
  })

  test("the drawer opens with the saved SEO values", async () => {
    setMockResponse.get(
      urls.topics.list({ limit: 1000 }),
      factories.learningResources.topics({ count: 1 }),
    )
    renderArticleEditor({
      seoTitleOverride: "Stored title",
      seoDescriptionOverride: "Stored description",
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )

    expect(await screen.findByLabelText(/^SEO Title/)).toHaveValue(
      "Stored title",
    )
    expect(screen.getByLabelText(/^SEO Description/)).toHaveValue(
      "Stored description",
    )
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
/**
 * An article that has everything publishing insists on: a topic, and an SEO
 * title and description. Without all three the press opens the settings
 * drawer instead, which is its own set of tests below.
 */
const renderPublishableArticle = (
  options: Parameters<typeof renderArticleEditor>[0] = {},
) =>
  renderArticleEditor({
    topics: [7],
    /**
     * The SEO title resolves from the content's own title with no help, but a
     * description has to come from somewhere -- so this gives the banner a
     * subheading, which is the ordinary way an article has one.
     */
    subheading: "The line under the headline.",
    ...options,
  })

describe("ArticleEditor publish confirmation", () => {
  test("publishing a draft asks for confirmation first", async () => {
    const { article } = renderPublishableArticle()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    renderPublishableArticle()

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    const { article } = renderPublishableArticle({ isPublished: true })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    const heading = await screen.findByRole("heading", { level: 1 })
    await userEvent.click(heading)
    await userEvent.type(heading, " edited")

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    const { article } = renderPublishableArticle()
    setMockResponse.patch(
      urls.websiteContent.details(article.id),
      { detail: "boom" },
      { code: 500 },
    )

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    const { article } = renderPublishableArticle()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    /* SEO supplied, so topics are the only thing that can hold the press. */
    renderArticleEditor({
      subheading: "The line under the headline.",
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    await screen.findByText("Select at least one topic to publish your article")
  })

  test("a draft saves itself without them, rather than asking", async () => {
    mockTopics()
    const { article } = renderArticleEditor({
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.type(await screen.findByRole("heading", { level: 1 }), "!")

    // Autosave cannot stop to ask, so neither requirement -- topics or the
    // SEO fields -- is the draft save's to enforce.
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
    const { article } = renderArticleEditor({
      subheading: "The line under the headline.",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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

  test("a draft's topics may not be emptied either", async () => {
    const topics = factories.learningResources.topics({ count: 1 })
    const [topic] = topics.results
    setMockResponse.get(urls.topics.list({ limit: 1000 }), topics)
    const { article } = renderArticleEditor({
      topics: [topic.id],
      subheading: "The line under the headline.",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: `Remove ${topic.name}` }),
    )

    /**
     * Not only once the content is public. The field is marked required and
     * the section says a topic is needed, so letting the save through on a
     * draft would contradict both -- and the topics would be gone.
     */
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeDisabled()
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
  })

  test("the drawer will not save a published article with its topics emptied", async () => {
    const topics = factories.learningResources.topics({ count: 1 })
    const [topic] = topics.results
    setMockResponse.get(urls.topics.list({ limit: 1000 }), topics)
    const { article } = renderArticleEditor({
      isPublished: true,
      topics: [topic.id],
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: `Remove ${topic.name}` }),
    )

    /**
     * The drawer is where a selection can be taken away, so gating the save
     * buttons is not enough on its own -- an article would lose its topics
     * through here, and with them its place on a topic page.
     */
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeDisabled()
    await screen.findByText("A published article needs at least one topic")
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
  })

  test("closing the drawer abandons the held-back publish", async () => {
    const topic = mockTopics()
    const { article } = renderArticleEditor({
      subheading: "The line under the headline.",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
          body: {
            topics: [topic.id],
            seo_title_override: "",
            seo_description_override: "",
          },
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

/**
 * The SEO title and description are held to the same rule as topics, and for
 * the same reason: they are what a search result and a link preview show, and
 * without them the page head falls back to the title and whatever the body
 * happens to open with.
 */
describe("ArticleEditor SEO requirement", () => {
  const mockTopics = () => {
    setMockResponse.get(
      urls.topics.list({ limit: 1000 }),
      factories.learningResources.topics({ count: 1 }),
    )
  }

  /**
   * Topics supplied, and no subheading -- so the SEO description is the only
   * thing publishing can still be waiting on. The title is never missing: it
   * resolves from the content's own title, which is the whole point of
   * inferring it.
   */
  const renderTopicalArticle = (
    options: Parameters<typeof renderArticleEditor>[0] = {},
  ) => renderArticleEditor({ topics: [7], ...options })

  test("publishing with nothing to infer a description from asks for one", async () => {
    mockTopics()
    renderTopicalArticle()

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
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
    await screen.findByText(
      /Add an SEO title and description to publish your article/,
    )
  })

  /**
   * The common case, and the one worth protecting: nobody has filled anything
   * in, and publishing goes ahead on the content's own words.
   */
  test("publishing goes ahead on what the content infers", async () => {
    mockTopics()
    const { article } = renderTopicalArticle({
      subheading: "The line under the headline.",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    )

    // Straight to the confirmation -- no drawer, nothing to ask for.
    await screen.findByRole("heading", { name: "Publish article" })
    expect(
      screen.queryByRole("heading", { name: "Article Settings" }),
    ).not.toBeInTheDocument()
  })

  test("whitespace is not an override, so inference still applies", async () => {
    mockTopics()
    const { article } = renderTopicalArticle({
      seoTitleOverride: "   ",
      subheading: "The line under the headline.",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    )

    /**
     * A space is not something somebody wrote for search, so it does not
     * displace the title -- and it does not block the publish either, which it
     * would if emptiness were judged on the override alone.
     */
    await screen.findByRole("heading", { name: "Publish article" })
  })

  test("the held-back publish resumes once a description is written", async () => {
    mockTopics()
    const { article } = renderTopicalArticle()
    setMockResponse.patch(urls.websiteContent.details(article.id), {
      ...article,
      is_published: true,
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    )
    await screen.findByRole("heading", { name: "Article Settings" })

    await userEvent.type(
      await screen.findByLabelText(/^SEO Description/),
      "A description for search results.",
    )
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    // Picking up where the press left off, confirmation included.
    await userEvent.click(
      await screen.findByRole("button", { name: "Yes, Publish article" }),
    )

    /**
     * Only the description was written, so only it is stored -- the title is
     * still the content's, and still following it.
     */
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: expect.objectContaining({
            is_published: true,
            seo_title_override: "",
            seo_description_override: "A description for search results.",
          }),
        }),
      )
    })
  }, 30000)

  /**
   * Saving the drawer closes it, and closing forgets the press -- so a save
   * that still left the fields blank would drop the publish with nothing on
   * screen to say why.
   */
  test("the drawer will not save while the publish is still waiting", async () => {
    mockTopics()
    renderTopicalArticle()

    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    )
    await screen.findByRole("heading", { name: "Article Settings" })

    /* The description is what is missing; the title resolves on its own. */
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeDisabled()

    await userEvent.type(
      await screen.findByLabelText(/^SEO Description/),
      "A description.",
    )
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeEnabled()
  }, 30000)

  /**
   * Clearing an override is how an editor goes back to the content's own
   * words, so it has to be allowed -- the save is only refused when there is
   * nothing left to fall back to.
   */
  test("clearing an override is allowed, and hands the field back", async () => {
    mockTopics()
    const { article } = renderPublishableArticle({
      isPublished: true,
      seoTitleOverride: "Something written for search",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    const field = await screen.findByLabelText(/^SEO Title/)
    expect(field).toHaveValue("Something written for search")

    await userEvent.clear(field)

    // The content's own title is what will be used, and is shown as such.
    expect(field).toHaveAttribute("placeholder", "Article Title")
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: expect.objectContaining({ seo_title_override: "" }),
        }),
      )
    })
  }, 30000)

  test("a published article may not be left with nothing to show", async () => {
    mockTopics()
    /* No subheading, so clearing the description override empties it. */
    renderArticleEditor({
      isPublished: true,
      topics: [7],
      seoDescriptionOverride: "A description for search.",
    })

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.clear(await screen.findByLabelText(/^SEO Description/))

    expect(screen.getByRole("button", { name: "Save Settings" })).toBeDisabled()
    await screen.findByText(
      /A published article needs an SEO title and description/,
    )
  }, 20000)

  test("a draft with nothing to infer from cannot save its settings", async () => {
    mockTopics()
    renderArticleEditor({ topics: [7] })

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )

    /**
     * Refused on a draft too, not only once it is public -- but only because
     * this document has no subheading, so the description resolves to nothing
     * at all. An ordinary article saves its settings untouched.
     *
     * The draft's *content* is unaffected: autosave keeps writing it, and only
     * the drawer's own settings wait here.
     */
    await screen.findByRole("heading", { name: "Article Settings" })
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeDisabled()
    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "patch" }),
    )
  })

  test("a draft whose content infers both saves its settings untouched", async () => {
    mockTopics()
    const { article } = renderArticleEditor({
      topics: [7],
      subheading: "The line under the headline.",
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    /* Nothing typed, so nothing overridden -- and that is a valid save. */
    await waitFor(() => {
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "patch",
          body: {
            topics: [7],
            seo_title_override: "",
            seo_description_override: "",
          },
        }),
      )
    })
  })
})

describe("ArticleEditor autosave", () => {
  test("a draft saves itself once typing stops", async () => {
    const { article } = renderArticleEditor({
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
    })
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

  test("an article that has never been saved is created once, then updated", async () => {
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const created = factories.websiteContent.websiteContent({
      id: 909,
      content,
      is_published: false,
    })
    setMockResponse.post(urls.websiteContent.list(), created)
    setMockResponse.patch(urls.websiteContent.details(created.id), created)

    /* No `article`: the editor starts with nothing to update. */
    renderWithProviders(<ArticleEditor autosaveDelayMs={AUTOSAVE_DELAY_MS} />, {
      user,
    })

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " first",
    )
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "post" }),
        )
      },
      { timeout: 12000 },
    )
    // Settled first: typing while the create is still open puts a background
    // write in every synchronous gap, which updates the toolbar outside `act`.
    await waitFor(() => expect(screen.queryByText("Saving...")).toBe(null))

    /**
     * The editor has created the item but still holds no `contentItem` -- the
     * caller has not navigated here -- so without remembering what it created
     * this second save would insert another article.
     */
    await userEvent.type(screen.getByRole("heading", { level: 1 }), " again")
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "patch",
            url: urls.websiteContent.details(created.id),
          }),
        )
      },
      { timeout: 12000 },
    )

    const posts = makeRequest.mock.calls.filter(
      (call) => call[0]?.method === "post",
    )
    expect(posts).toHaveLength(1)
  }, 30000)

  test("an autosave of an existing draft asks for no navigation", async () => {
    const onSave = jest.fn()
    const user = factories.user.user({
      is_authenticated: true,
      is_article_editor: true,
    })
    setMockResponse.get(urls.userMe.get(), user)
    const article = factories.websiteContent.websiteContent({
      content,
      is_published: false,
    })
    setMockResponse.get(urls.websiteContent.details(article.id), article)
    setMockResponse.patch(urls.websiteContent.details(article.id), article)

    renderWithProviders(
      <ArticleEditor
        article={article}
        onSave={onSave}
        autosaveDelayMs={AUTOSAVE_DELAY_MS}
      />,
      { user },
    )

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: "patch" }),
        )
      },
      { timeout: 6000 },
    )

    /**
     * `onSave` is how the caller learns to navigate, and a draft that already
     * exists has not moved. Left to fire, every autosave would ask the page to
     * push the route it is already on.
     */
    expect(onSave).not.toHaveBeenCalled()
  }, 15000)

  test("the indicator stops saying Saved as soon as typing resumes", async () => {
    const { article } = renderArticleEditor({
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
    })
    setMockResponse.patch(urls.websiteContent.details(article.id), article)
    const heading = await screen.findByRole("heading", { level: 1 })

    await userEvent.type(heading, " edited")
    await screen.findByText("Saved", {}, { timeout: 6000 })

    /* The next keystroke is not saved, so the bar must stop claiming it is.
       Re-queried: the node from before the save has been replaced. */
    await userEvent.type(screen.getByRole("heading", { level: 1 }), "!")

    expect(screen.queryByText("Saved")).toBe(null)
  }, 15000)

  test("a settings save is not overtaken by an autosave in flight", async () => {
    const topics = factories.learningResources.topics({ count: 1 })
    const [topic] = topics.results
    setMockResponse.get(urls.topics.list({ limit: 1000 }), topics)
    const { article } = renderArticleEditor({
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
      /* Required to save the drawer, and not what this test is about. */
      subheading: "The line under the headline.",
    })

    let contentWriteFinished = false
    let settingsSawContentWriteFinished: boolean | null = null
    /**
     * The content write carries `topics` as they were when it started, so it
     * is slow here on purpose: still open while the drawer saves new ones.
     */
    setMockResponse.patch(
      urls.websiteContent.details(article.id),
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            contentWriteFinished = true
            resolve(article)
          }, 3000),
        ),
      { requestBody: expect.objectContaining({ is_published: false }) },
    )
    /* The settings write, which sends topics and nothing else. */
    setMockResponse.patch(
      urls.websiteContent.details(article.id),
      () => {
        settingsSawContentWriteFinished = contentWriteFinished
        return article
      },
      {
        requestBody: expect.not.objectContaining({
          is_published: expect.anything(),
        }),
      },
    )

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )
    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "patch",
            body: expect.objectContaining({ is_published: false }),
          }),
        )
      },
      { timeout: 12000 },
    )

    // Pick a topic while that write is still open.
    await userEvent.click(
      await screen.findByRole("button", { name: "Settings" }),
    )
    await userEvent.click(await screen.findByLabelText("Topic"))
    await userEvent.click(
      await screen.findByRole("option", { name: topic.name }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Add" }))
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    await waitFor(
      () => expect(settingsSawContentWriteFinished).not.toBe(null),
      { timeout: 12000 },
    )

    /**
     * Sent only once the content write had finished. Overlapping, the content
     * write's older topic list could be the one the server stored last, and
     * the editor's new selection would vanish with nothing to say so.
     */
    expect(settingsSawContentWriteFinished).toBe(true)
  }, 30000)

  test("a publish waits for the draft save already in flight", async () => {
    const { article } = renderPublishableArticle({
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
    })
    /**
     * A slow draft write, so it is genuinely still running when the publish is
     * confirmed -- which is the only way the two can interleave.
     */
    setMockResponse.patch(
      urls.websiteContent.details(article.id),
      new Promise((resolve) => setTimeout(() => resolve(article), 800)),
      { requestBody: expect.objectContaining({ is_published: false }) },
    )
    setMockResponse.patch(
      urls.websiteContent.details(article.id),
      { ...article, is_published: true },
      { requestBody: expect.objectContaining({ is_published: true }) },
    )

    await userEvent.type(
      await screen.findByRole("heading", { level: 1 }),
      " edited",
    )
    // Wait for the draft write to start, then publish while it is in flight.
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
    await userEvent.click(
      await screen.findByRole("button", { name: "Publish" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Yes, Publish article" }),
    )

    await waitFor(
      () => {
        expect(makeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "patch",
            body: expect.objectContaining({ is_published: true }),
          }),
        )
      },
      { timeout: 8000 },
    )

    /**
     * The publish is the last write. Unqueued it could be sent while the draft
     * PATCH was still open, and whichever the server handled last would decide
     * whether the item ended up public -- with the dialog reporting success
     * either way.
     */
    // Settled before teardown, so nothing updates after the test ends.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))

    const bodies = makeRequest.mock.calls
      .filter((call) => call[0]?.method === "patch")
      // `body` is deliberately `unknown` in the request harness.
      .map((call) => (call[0].body as { is_published?: boolean }).is_published)
    expect(bodies).toEqual([false, true])
  }, 25000)

  test("a published article is never saved behind the author's back", async () => {
    const { article } = renderPublishableArticle({
      isPublished: true,
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
    })
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

  test("the indicator is a live region before it has anything to say", async () => {
    renderArticleEditor()

    /**
     * Mounted empty, ahead of the first message. A live region inserted in the
     * same paint as its content is routinely not announced at all, and the
     * first message -- that the work is being saved -- is the one that matters.
     */
    const region = await screen.findByRole("status")
    expect(region).toBeEmptyDOMElement()
  })

  test("the control bar reports the save", async () => {
    const { article } = renderArticleEditor({
      autosaveDelayMs: AUTOSAVE_DELAY_MS,
    })
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
      name: "Publish",
    })
    const undo = screen.getByRole("button", { name: "Undo" })
    const bar = screen.getByRole("toolbar")

    // Two rows, in this order: the actions, then the formatting controls.
    expect(bar.children).toHaveLength(2)
    const [actionRow, formattingRow] = Array.from(bar.children)
    expect(actionRow).toContainElement(publish)
    expect(formattingRow).toContainElement(undo)
  })

  test("puts the status at one end and the actions at the other", async () => {
    renderArticleEditor()

    const publish = await screen.findByRole("button", {
      name: "Publish",
    })
    const settings = screen.getByRole("button", { name: "Settings" })
    const status = screen.getByText(/Status:/)

    // The status leads the row; the actions follow it.
    expect(
      status.compareDocumentPosition(publish) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Settings sits immediately after Publish, as the design pairs them.
    expect(publish.nextElementSibling).toBe(settings)
  })

  test("the settings control is the icon alone", async () => {
    renderArticleEditor()

    const settings = await screen.findByRole("button", { name: "Settings" })

    /* No label of its own, so the name has to come from `aria-label`. */
    expect(settings).toHaveTextContent("")
    expect(settings.querySelector("svg")).toBeInTheDocument()
  })
})

/**
 * The published view's bar is the same bar in the same place, so it is laid
 * out the same way. It used to run the full width of the window with its
 * buttons against the left edge and the status against the right, which read
 * as a different component.
 */
describe("ArticleEditor published control bar layout", () => {
  const renderPublished = () =>
    renderArticleEditor({ readOnly: true, isPublished: true })

  test("puts the status at one end and the actions at the other", async () => {
    renderPublished()

    const draft = await screen.findByRole("link", { name: "Draft" })
    const edit = screen.getByRole("link", { name: "Edit" })
    const settings = screen.getByRole("button", { name: "Settings" })
    const status = screen.getByText(/Status:/)

    // The status leads the row, as in edit mode; the actions follow it.
    expect(
      status.compareDocumentPosition(draft) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Grouped at the far end, in the order the design has them.
    expect(draft.nextElementSibling).toBe(edit)
    expect(edit.nextElementSibling).toBe(settings)
  })

  test("the row is the same column the article is set in", async () => {
    renderPublished()

    const status = await screen.findByText(/Status:/)
    const draft = screen.getByRole("link", { name: "Draft" })
    const bar = screen.getByRole("toolbar")

    /**
     * One row inside the bar holding both ends, rather than the two sitting
     * directly in a full-width toolbar. That row is what carries the article's
     * 890px column, so the status lines up with the breadcrumb and the actions
     * with the far edge of the text.
     */
    expect(bar.children).toHaveLength(1)
    const [actionRow] = Array.from(bar.children)
    expect(actionRow).toContainElement(status)
    expect(actionRow).toContainElement(draft)
  })
})
