import { ResourceTypeEnum } from "api"
import * as factories from "./learningResources"

/**
 * `mergeOverrides<T>` takes partials and asserts the result is `T`, so a
 * required field missing from a factory is invisible to tsc — the runtime
 * object simply violates the generated API contract. These assertions are the
 * only thing standing between us and that, so they are worth keeping for any
 * field the API declares non-nullable.
 */
describe("learning resource factories satisfy the non-nullable contract", () => {
  const resourceFactories = {
    resource: factories.resource,
    course: factories.course,
    program: factories.program,
    learningPath: factories.learningPath,
    podcast: factories.podcast,
    podcastEpisode: factories.podcastEpisode,
    video: factories.video,
    videoPlaylist: factories.videoPlaylist,
    resourceSummary: factories.resourceSummary,
  }

  test.each(Object.keys(resourceFactories))("%s emits learn_url", (name) => {
    const factory = resourceFactories[name as keyof typeof resourceFactories]
    const resource = factory()

    expect(typeof resource.learn_url).toBe("string")
    // Built from the resource's own id, so a mismatch means the factory
    // generated the two independently.
    expect(resource.learn_url).toContain(`resource=${resource.id}`)
  })

  // Covers `document`, which is reachable only through the dispatcher.
  test.each(Object.values(ResourceTypeEnum))(
    "resource({ resource_type: %s }) emits learn_url",
    (resourceType) => {
      const resource = factories.resource({ resource_type: resourceType })

      expect(typeof resource.learn_url).toBe("string")
      expect(resource.learn_url).toContain(`resource=${resource.id}`)
    },
  )

  test("an override wins over the default", () => {
    const resource = factories.video({
      learn_url: "https://learn.test/video/7/lecture-1?playlist=8",
    })

    expect(resource.learn_url).toBe(
      "https://learn.test/video/7/lecture-1?playlist=8",
    )
  })
})
