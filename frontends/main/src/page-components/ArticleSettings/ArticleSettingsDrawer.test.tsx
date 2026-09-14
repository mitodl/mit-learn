import React from "react"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { setMockResponse, factories, urls } from "api/test-utils"
import { ArticleSettingsDrawer } from "./ArticleSettingsDrawer"
import { renderWithProviders } from "@/test-utils"

const setup = () => {
  const mainTopics = factories.learningResources.topics({ count: 1 })
  const [topic] = mainTopics.results
  const subtopics = factories.learningResources.topics({ count: 2 })
  subtopics.results.forEach((s) => {
    s.parent = topic.id
  })
  const [subA, subB] = subtopics.results

  setMockResponse.get(
    urls.topics.list({ is_toplevel: true, limit: 100 }),
    mainTopics,
  )
  setMockResponse.get(
    urls.topics.list({ parent_topic_id: [topic.id], limit: 100 }),
    subtopics,
  )

  const onSave = jest.fn()
  renderWithProviders(
    <ArticleSettingsDrawer open onClose={jest.fn()} onSave={onSave} />,
  )
  return { topic, subA, subB, onSave }
}

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

    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].topics).toEqual([
      { topicId: topic.id, subtopicId: subA.id },
    ])
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

    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))

    expect(onSave.mock.calls[0][0].topics).toEqual([
      { topicId: topic.id, subtopicId: subA.id },
      { topicId: topic.id, subtopicId: subB.id },
    ])
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

    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }))
    expect(onSave.mock.calls[0][0].topics).toEqual([])
  })
})
