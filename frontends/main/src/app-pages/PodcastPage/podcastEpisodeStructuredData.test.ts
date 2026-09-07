import { faker } from "@faker-js/faker/locale/en"
import { factories } from "api/test-utils"
import type { PodcastEpisodeParent, PodcastEpisodeResource } from "api/v1"
import { buildPodcastEpisodeStructuredData } from "./podcastEpisodeStructuredData"

const makeEpisode = (
  podcastEpisode: Partial<PodcastEpisodeResource["podcast_episode"]> = {},
): PodcastEpisodeResource =>
  factories.learningResources.podcastEpisode({
    // The resource factory leaves last_modified unset and the payload is
    // omitted without it, so every case here has to supply one.
    last_modified: "2026-01-02T03:04:05Z",
    podcast_episode: podcastEpisode,
  })

const makeParent = (): PodcastEpisodeParent => {
  const id = faker.number.int({ min: 1, max: 1e6 })
  const slug = faker.lorem.slug()
  return {
    id,
    title: faker.lorem.words(3),
    readable_id: faker.lorem.slug(),
    learn_url: `http://test.learn.odl.local:8062/podcast/${id}/${slug}`,
  }
}

test("omits the payload entirely without a last_modified date", () => {
  const episode = factories.learningResources.podcastEpisode({
    last_modified: null,
  })
  expect(buildPodcastEpisodeStructuredData(episode)).toBeNull()
  expect(buildPodcastEpisodeStructuredData(undefined)).toBeNull()
})

test.each(["PT17M16S", "PT0S", "PT1H13M44S", "P1D", "P1Y2M3DT4H5M6.7S"])(
  "keeps the valid ISO-8601 duration %s",
  (duration) => {
    const built = buildPodcastEpisodeStructuredData(makeEpisode({ duration }))
    expect(built).toHaveProperty("duration", duration)
  },
)

// "P" and "PT" have no components at all and "P1DT" has a dangling designator;
// none is a valid ISO-8601 duration, and schema.org's `duration` requires one.
test.each(["P", "PT", "P1DT", "17 minutes", "1:13:44", ""])(
  "drops the invalid duration %p rather than publishing it",
  (duration) => {
    const built = buildPodcastEpisodeStructuredData(makeEpisode({ duration }))
    expect(built).not.toHaveProperty("duration")
  },
)

test("names the canonical series, not a later parent", () => {
  const canonical = makeParent()
  const other = makeParent()
  const episode = makeEpisode({ parent_podcasts: [canonical, other] })

  const built = buildPodcastEpisodeStructuredData(episode)

  expect(built).toHaveProperty("url", episode.learn_url)
  expect(built).toHaveProperty("partOfSeries", {
    "@type": "PodcastSeries",
    name: canonical.title,
    url: canonical.learn_url,
  })
})

test("omits partOfSeries for an episode with no parent podcast", () => {
  const built = buildPodcastEpisodeStructuredData(
    makeEpisode({ parent_podcasts: [] }),
  )
  expect(built).not.toHaveProperty("partOfSeries")
})
