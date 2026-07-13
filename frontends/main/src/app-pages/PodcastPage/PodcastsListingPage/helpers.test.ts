import { factories } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import {
  formatApproxCount,
  getEpisodeAudioUrl,
  getEpisodeDurationMinutes,
  getEpisodeParentPodcastId,
} from "./helpers"

describe("formatApproxCount", () => {
  it.each([
    [0, "0"],
    [45, "45"],
    [99, "99"],
    [100, "100+"],
    [150, "100+"],
    [999, "900+"],
    [1234, "1200+"],
  ])("formats %i as %s", (count, expected) => {
    expect(formatApproxCount(count)).toBe(expected)
  })
})

describe("getEpisodeAudioUrl", () => {
  it("returns null for non-episode resources", () => {
    const course = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })
    expect(getEpisodeAudioUrl(course)).toBeNull()
  })

  it("returns the audio_url when present", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeAudioUrl(episode)).toBe("https://example.com/audio.mp3")
  })

  it("returns null when audio_url is blank, even if episode_link is set", () => {
    // audio_url is a required field, so a blank/whitespace value is not
    // nullish and the `??` fallback to episode_link never kicks in.
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT1M",
        audio_url: "   ",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeAudioUrl(episode)).toBeNull()
  })

  it("returns null when neither audio_url nor episode_link is set", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT1M",
        audio_url: "",
        episode_link: "",
      },
    }) as unknown as LearningResource
    expect(getEpisodeAudioUrl(episode)).toBeNull()
  })
})

describe("getEpisodeDurationMinutes", () => {
  it("returns null for non-episode resources", () => {
    const course = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })
    expect(getEpisodeDurationMinutes(course)).toBeNull()
  })

  it("converts an ISO 8601 duration to rounded minutes", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT2H",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeDurationMinutes(episode)).toBe(120)
  })

  it("rounds partial minutes", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT1H13M44S",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeDurationMinutes(episode)).toBe(74)
  })

  it("returns null when duration is missing", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeDurationMinutes(episode)).toBeNull()
  })
})

describe("getEpisodeParentPodcastId", () => {
  it("returns null for non-episode resources", () => {
    const course = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })
    expect(getEpisodeParentPodcastId(course)).toBeNull()
  })

  it("returns the first parent podcast id", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [42, 43],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeParentPodcastId(episode)).toBe(42)
  })

  it("returns null when there are no parent podcasts", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeParentPodcastId(episode)).toBeNull()
  })
})
