import {
  videoDetailPath,
  podcastEpisodePath,
  podcastPath,
  resourceDrawerSearch,
} from "@/common/urls"
import { extractResourceId } from "./LearningResourcePaste"

// The paste handler must recover the resource id from the URLs our path
// builders emit, cosmetic slug segment included. Every input here comes from a
// real builder, so a change to a URL shape reaches this test on its own.
describe("extractResourceId", () => {
  test("recovers the video id from a canonical video URL", () => {
    const url = videoDetailPath(135366, 128974, "intro-to-machine-learning")
    expect(extractResourceId(url)).toBe(135366)
  })

  test("recovers the episode id (not the podcast id) from an episode URL", () => {
    const url = podcastEpisodePath("137277", "136068", "episode-one")
    expect(extractResourceId(url)).toBe(137277)
  })

  test("recovers the podcast id from a canonical podcast URL", () => {
    const url = podcastPath(136068, "beyond-biology")
    expect(extractResourceId(url)).toBe(136068)
  })

  test("recovers the id from a bare (no-slug) canonical URL", () => {
    // The id sits at the end of the string, exercising the `$` arm of the
    // `(?:[/?#]|$)` boundary.
    const url = podcastPath(136068, undefined)
    expect(extractResourceId(url)).toBe(136068)
  })

  test("recovers the resource id from a drawer URL", () => {
    const url = resourceDrawerSearch(114927, "Beyond Biology")
    expect(extractResourceId(url)).toBe(114927)
  })

  test("returns null when no resource id is present", () => {
    expect(extractResourceId("https://example.com/about")).toBeNull()
  })
})
