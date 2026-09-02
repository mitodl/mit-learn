import { factories } from "api/test-utils"
import type { PodcastEpisodeResource } from "api/v1"
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

test("omits the payload entirely without a last_modified date", () => {
  const episode = factories.learningResources.podcastEpisode({
    last_modified: null,
  })
  expect(
    buildPodcastEpisodeStructuredData(episode, { series: null }),
  ).toBeNull()
  expect(
    buildPodcastEpisodeStructuredData(undefined, { series: null }),
  ).toBeNull()
})

test.each(["PT17M16S", "PT0S", "PT1H13M44S", "P1D", "P1Y2M3DT4H5M6.7S"])(
  "keeps the valid ISO-8601 duration %s",
  (duration) => {
    const built = buildPodcastEpisodeStructuredData(makeEpisode({ duration }), {
      series: null,
    })
    expect(built).toHaveProperty("duration", duration)
  },
)

// "P" and "PT" have no components at all and "P1DT" has a dangling designator;
// none is a valid ISO-8601 duration, and schema.org's `duration` requires one.
test.each(["P", "PT", "P1DT", "17 minutes", "1:13:44", ""])(
  "drops the invalid duration %p rather than publishing it",
  (duration) => {
    const built = buildPodcastEpisodeStructuredData(makeEpisode({ duration }), {
      series: null,
    })
    expect(built).not.toHaveProperty("duration")
  },
)

test("names the series it is given, not one it picks itself", () => {
  const episode = makeEpisode({
    parent_podcasts: [
      {
        id: 1,
        title: "Podcast A",
        readable_id: "a",
        learn_url: "http://test.learn.odl.local:8062/podcast/1/podcast-a",
      },
      {
        id: 2,
        title: "Podcast B",
        readable_id: "b",
        learn_url: "http://test.learn.odl.local:8062/podcast/2/podcast-b",
      },
    ],
  })
  const built = buildPodcastEpisodeStructuredData(episode, {
    series: {
      id: 2,
      title: "Podcast B",
      readable_id: "b",
      learn_url: "http://test.learn.odl.local:8062/podcast/2/podcast-b",
    },
    seriesUrl: "https://learn.mit.edu/podcast/2/podcast-b",
  })
  expect(built).toHaveProperty("partOfSeries", {
    "@type": "PodcastSeries",
    name: "Podcast B",
    url: "https://learn.mit.edu/podcast/2/podcast-b",
  })
})
