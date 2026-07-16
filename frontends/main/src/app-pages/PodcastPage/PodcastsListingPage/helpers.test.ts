import { factories } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import {
  formatApproxCount,
  getEpisodeAudioUrl,
  getEpisodeDurationMinutes,
  getEpisodeParentPodcast,
  getEpisodeParentPodcastId,
  getEpisodeParentPodcastName,
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

  it("falls back to episode_link by default when audio_url is absent", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT1M",
        audio_url: null as unknown as string,
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeAudioUrl(episode)).toBe("https://example.com/link")
  })

  it("does not fall back to episode_link when allowEpisodeLink is false", () => {
    // The embed player feeds the URL straight into an <audio> element, so the
    // (possibly non-media) episode_link must never be used.
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT1M",
        audio_url: null as unknown as string,
        episode_link: "https://example.com/webpage",
      },
    }) as unknown as LearningResource
    expect(getEpisodeAudioUrl(episode, { allowEpisodeLink: false })).toBeNull()
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

describe("getEpisodeParentPodcastName", () => {
  it("returns null for non-episode resources", () => {
    const course = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })
    expect(getEpisodeParentPodcastName(course)).toBeNull()
  })

  it("returns the first parent podcast's title (not offered_by)", () => {
    const episode = factories.learningResources.podcastEpisode({
      offered_by: { name: "MIT OpenCourseWare", code: "ocw" },
      podcast_episode: {
        id: 1,
        podcasts: [42],
        parent_podcasts: [
          { id: 42, title: "The Show Name", readable_id: "the-show" },
        ],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeParentPodcastName(episode)).toBe("The Show Name")
  })

  it("returns null when there are no parent podcasts", () => {
    const episode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [],
        parent_podcasts: [],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource
    expect(getEpisodeParentPodcastName(episode)).toBeNull()
  })

  describe("when an episode belongs to multiple podcasts", () => {
    const multiParentEpisode = factories.learningResources.podcastEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1, 2],
        parent_podcasts: [
          { id: 1, title: "Podcast A", readable_id: "podcast-a" },
          { id: 2, title: "Podcast B", readable_id: "podcast-b" },
        ],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }) as unknown as LearningResource

    it("names the parent matching the given podcastId", () => {
      expect(getEpisodeParentPodcastName(multiParentEpisode, 2)).toBe(
        "Podcast B",
      )
    })

    it("falls back to the first parent when no podcastId is given", () => {
      expect(getEpisodeParentPodcastName(multiParentEpisode)).toBe("Podcast A")
    })

    it("falls back to the first parent when the podcastId does not match", () => {
      expect(getEpisodeParentPodcastName(multiParentEpisode, 999)).toBe(
        "Podcast A",
      )
    })
  })
})

describe("getEpisodeParentPodcast", () => {
  const multiParentEpisode = factories.learningResources.podcastEpisode({
    podcast_episode: {
      id: 1,
      podcasts: [1, 2],
      parent_podcasts: [
        { id: 1, title: "Podcast A", readable_id: "podcast-a" },
        { id: 2, title: "Podcast B", readable_id: "podcast-b" },
      ],
      duration: "PT1M",
      audio_url: "https://example.com/audio.mp3",
      episode_link: "https://example.com/link",
    },
  }) as unknown as LearningResource

  it("returns null for non-episode resources", () => {
    const course = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })
    expect(getEpisodeParentPodcast(course)).toBeNull()
  })

  it("returns the full parent object matching the given podcastId", () => {
    expect(getEpisodeParentPodcast(multiParentEpisode, 2)).toEqual({
      id: 2,
      title: "Podcast B",
      readable_id: "podcast-b",
    })
  })

  it("falls back to the first parent when no id is given or none matches", () => {
    expect(getEpisodeParentPodcast(multiParentEpisode)?.id).toBe(1)
    expect(getEpisodeParentPodcast(multiParentEpisode, 999)?.id).toBe(1)
  })
})
