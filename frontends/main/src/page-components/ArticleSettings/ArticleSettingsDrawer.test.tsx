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
