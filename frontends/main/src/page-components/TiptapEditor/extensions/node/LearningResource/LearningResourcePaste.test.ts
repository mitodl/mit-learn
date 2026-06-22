import {
  videoDetailPageView,
  podcastPageView,
  podcastEpisodePageView,
  resourceDrawerSearch,
} from "@/common/urls"
import { extractResourceId } from "./LearningResourcePaste"

// The paste handler must recover the resource id from the *canonical* URLs our
// builders emit — including the cosmetic slug segment they now append. Building
// inputs from the real constructors (rather than hand-written strings) keeps
// this contract pinned if the URL shape ever changes.
describe("extractResourceId", () => {
  test("recovers the video id from a canonical video URL", () => {
    const url = videoDetailPageView(135366, 128974, "Intro to Machine Learning")
    expect(extractResourceId(url)).toBe(135366)
  })

  test("recovers the episode id (not the podcast id) from an episode URL", () => {
    const url = podcastEpisodePageView("137277", "136068", "Episode One")
    expect(extractResourceId(url)).toBe(137277)
  })

  test("recovers the podcast id from a canonical podcast URL", () => {
    const url = podcastPageView("136068", "Beyond Biology")
    expect(extractResourceId(url)).toBe(136068)
  })

  test("recovers the id from a bare (no-slug) canonical URL", () => {
    // Builders emit the bare path when title is undefined; the id sits at the
    // end of the string, exercising the `$` arm of the `(?:[/?#]|$)` boundary.
    const url = podcastPageView("136068", undefined)
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
