import React from "react"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls } from "api/test-utils"
import { ArticleSettingsDrawer } from "./ArticleSettingsDrawer"
import { renderWithProviders } from "@/test-utils"

/**
 * One top-level topic with two subtopics under it. The drawer fetches every
 * topic once and splits them by `parent`, so both selects and the saved-value
 * lookup are served from this single response.
 */
const mockTopics = () => {
  const mainTopics = factories.learningResources.topics({ count: 1 })
  const [topic] = mainTopics.results
  const subtopics = factories.learningResources.topics({ count: 2 })
  subtopics.results.forEach((s) => {
    s.parent = topic.id
  })
  const [subA, subB] = subtopics.results

  const all = [...mainTopics.results, ...subtopics.results]
  setMockResponse.get(urls.topics.list({ limit: 1000 }), {
    count: all.length,
    next: null,
    previous: null,
    results: all,
  })

  return { topic, subA, subB }
}

const renderDrawer = (topics?: number[]) => {
  const onSave = jest.fn()
  renderWithProviders(
    <ArticleSettingsDrawer
      open
      onClose={jest.fn()}
      onSave={onSave}
      initialValues={topics ? { topics } : undefined}
    />,
  )
  return { onSave }
}

const setup = () => ({ ...mockTopics(), ...renderDrawer() })

const pickTopic = async (name: string) => {
  await userEvent.click(await screen.findByLabelText("Topic"))
  await userEvent.click(await screen.findByRole("option", { name }))
}

const pickSubtopic = async (name: string) => {
  await userEvent.click(await screen.findByLabelText("Subtopic"))
  await userEvent.click(await screen.findByRole("option", { name }))
}

const add = async () =>
  userEvent.click(screen.getByRole("button", { name: "Add" }))

const save = async () =>
  userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

describe("ArticleSettingsDrawer topic selection", () => {
  /**
   * Adding a topic on its own and then a subtopic under it used to leave the
   * bare entry behind: only subtopics get a chip, and the whole-topic remove
   * button only appeared when every entry was bare, so it became unreachable
   * and still rode along into the saved payload.
   */
  test("adding a subtopic supersedes the topic's bare entry", async () => {
    const { topic, subA, onSave } = setup()

    await pickTopic(topic.name)
    await add()
    // The topic stays selected by design, so this adds under the same topic.
    await pickSubtopic(subA.name)
    await add()

    await save()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].topics).toEqual([subA.id])
  })

  test("a bare topic cannot be re-added once it has a subtopic", async () => {
    const { topic, subA } = setup()

    await pickTopic(topic.name)
    await pickSubtopic(subA.name)
    await add()

    // Adding clears the subtopic but keeps the topic, so the pending selection
    // is now the bare topic again — which would recreate the phantom entry.
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
  })

  test("several subtopics accumulate under the one topic", async () => {
    const { topic, subA, subB, onSave } = setup()

    await pickTopic(topic.name)
    await pickSubtopic(subA.name)
    await add()
    await pickSubtopic(subB.name)
    await add()

    await save()

    expect(onSave.mock.calls[0][0].topics).toEqual([subA.id, subB.id])
  })

  test("a topic added with no subtopic is still removable", async () => {
    const { topic, onSave } = setup()

    await pickTopic(topic.name)
    await add()

    const selected = screen.getByRole("list", { name: "Selected topics" })
    within(selected).getByText(topic.name)

    await userEvent.click(
      screen.getByRole("button", { name: `Remove ${topic.name}` }),
    )

    expect(
      screen.queryByRole("list", { name: "Selected topics" }),
    ).not.toBeInTheDocument()

    await save()
    expect(onSave.mock.calls[0][0].topics).toEqual([])
  })
})

/**
 * Only the leaf of each selection is saved -- the id the API stores -- so the
 * grouping the design calls for has to be rebuilt from each topic's own
 * `parent` when the drawer reopens.
 */
describe("ArticleSettingsDrawer saved values", () => {
  test("a saved subtopic reopens as a chip under its parent", async () => {
    const { topic, subA } = mockTopics()
    renderDrawer([subA.id])

    // Awaiting the composed label proves both ends of the grouping resolved:
    // the chip's own name and the parent it was filed under.
    await screen.findByRole("button", {
      name: `Remove ${subA.name} from ${topic.name}`,
    })
    const selected = screen.getByRole("list", { name: "Selected topics" })
    within(selected).getByText(topic.name)
  })

  test("a saved top-level topic reopens as a bare entry", async () => {
    const { topic } = mockTopics()
    renderDrawer([topic.id])

    await screen.findByRole("button", { name: `Remove ${topic.name}` })
  })

  test("saved ids are handed back unchanged when nothing is edited", async () => {
    const { subA } = mockTopics()
    const { onSave } = renderDrawer([subA.id])

    await save()

    expect(onSave.mock.calls[0][0].topics).toEqual([subA.id])
  })
})

describe("ArticleSettingsDrawer SEO fields", () => {
  /* The title budget is derived from this, so it has to be known, not ambient. */
  const previousSiteName = process.env.NEXT_PUBLIC_SITE_NAME
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_NAME = "MIT Learn"
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_NAME = previousSiteName
  })

  /**
   * `WebsiteContent.seo_title` is a `CharField(max_length=255)`, so anything
   * longer is rejected by the server -- and the drawer's save is fired and
   * forgotten, so that rejection reaches the editor only as a generic banner.
   * The field stops it here instead.
   */
  test("the SEO title cannot be typed past what the server stores", async () => {
    mockTopics()
    const { onSave } = renderDrawer()

    const field = await screen.findByLabelText(/^SEO Title/)
    expect(field).toHaveAttribute("maxLength", "255")

    await userEvent.type(field, "x".repeat(260))
    expect(field).toHaveValue("x".repeat(255))

    await save()
    expect(onSave.mock.calls[0][0].seoTitle).toHaveLength(255)
  }, 30000)

  /**
   * MIT's SEO rules ask for a title tag of 50-60 characters, and the page
   * appends " | MIT Learn" to whatever is entered here -- so the budget shown
   * to the editor is the 60 less that suffix, not 60 and not the 255 the
   * column happens to hold.
   */
  test("the title budget is the tag's, less the appended site name", async () => {
    mockTopics()
    renderDrawer()

    // 60 - " | MIT Learn".length
    await screen.findByText("0 / 48 characters")
    await screen.findByText(
      /Aim for 48 characters or fewer\. " \| MIT Learn" is appended, for a 60-character title/,
    )
  })

  test("the description budget is stated with the mobile cut-off", async () => {
    mockTopics()
    renderDrawer()

    await screen.findByText("0 / 160 characters")
    await screen.findByText(
      /Aim for 160 characters or fewer\. Only about 120 show on a phone/,
    )
  })

  /**
   * Guidance, not a limit: both numbers stand in for pixel widths, and a tag a
   * little over is truncated rather than rejected. So the counter says so and
   * the save still goes through -- what it must not do is look like nothing
   * happened.
   */
  test("going over the title budget is flagged but not prevented", async () => {
    mockTopics()
    const { onSave } = renderDrawer()

    const under = await screen.findByText("0 / 48 characters")
    expect(under).toHaveAttribute("data-over-budget", "false")

    await userEvent.type(
      await screen.findByLabelText(/^SEO Title/),
      "x".repeat(50),
    )

    const over = await screen.findByText("50 / 48 characters")
    expect(over).toHaveAttribute("data-over-budget", "true")

    /* Still saved: the budget is guidance, and the editor has seen it. */
    await save()
    expect(onSave.mock.calls[0][0].seoTitle).toHaveLength(50)
  }, 30000)
})
