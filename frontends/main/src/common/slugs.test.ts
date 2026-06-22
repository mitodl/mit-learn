import {
  slugify,
  parseResourceId,
  parentPodcastIds,
  resolveEpisodeParent,
  resolveVideoPlaylist,
  videoPlaylistIds,
} from "./slugs"

describe("slugify", () => {
  test.each([
    { title: "Beyond Biology", expected: "beyond-biology" },
    { title: "  Beyond  Biology  ", expected: "beyond-biology" },
    {
      title: "IA Generativa na Era da Transformação Digital",
      expected: "ia-generativa-na-era-da-transformacao-digital",
    },
    { title: "C++ & Python!", expected: "c-python" },
    { title: "2024 Q2", expected: "2024-q2" },
  ])("slugifies $title → $expected", ({ title, expected }) => {
    expect(slugify(title)).toBe(expected)
  })

  test.each([
    { title: "2024" }, // digits only, no [a-z]
    { title: "你好" }, // non-Latin, no ascii letters
    { title: "" },
  ])("returns '' (blank) for $title", ({ title }) => {
    expect(slugify(title)).toBe("")
  })

  test("truncates at 60 chars, backing off to last hyphen (no partial word)", () => {
    const title =
      "the quick brown fox jumps over the lazy dog and then keeps running far"
    expect(slugify(title)).toBe(
      "the-quick-brown-fox-jumps-over-the-lazy-dog-and-then-keeps",
    )
  })

  test("hard-cuts an unbroken 60+ char token", () => {
    expect(slugify("a".repeat(70))).toBe("a".repeat(60))
  })
})

describe("parseResourceId", () => {
  test("parses a bare positive integer", () => {
    expect(parseResourceId("2813")).toBe(2813)
  })

  test.each([
    { value: "2813-beyond-biology" }, // not a fused token — guards against split-parsing
    { value: "abc" }, // non-numeric
    { value: "0" }, // not a positive id
    { value: ["1", "2"] as string[] }, // repeated query param
    { value: undefined }, // missing
  ])("rejects $value → null", ({ value }) => {
    expect(parseResourceId(value)).toBeNull()
  })
})

describe("resolveEpisodeParent", () => {
  test("keeps the incoming id when it is one of the episode's podcasts", () => {
    expect(resolveEpisodeParent([10, 20], 20)).toBe(20)
  })
  test("falls back to the first podcast when incoming is not a member", () => {
    expect(resolveEpisodeParent([10, 20], 99)).toBe(10)
  })
  test("returns null when the episode has no podcasts", () => {
    expect(resolveEpisodeParent([], 5)).toBeNull()
  })
})

describe("resolveVideoPlaylist", () => {
  test("honors a ?playlist that is a member", () => {
    expect(resolveVideoPlaylist([55, 66], "66")).toBe(66)
  })
  test("falls back to the first playlist for a non-member value", () => {
    expect(resolveVideoPlaylist([55, 66], "999")).toBe(55)
  })
  test("falls back to the first playlist for a repeated (array) param", () => {
    expect(resolveVideoPlaylist([55, 66], ["1", "2"])).toBe(55)
  })
  test("returns null when the video has no playlists", () => {
    expect(resolveVideoPlaylist([], "5")).toBeNull()
  })
})

describe("id extractors", () => {
  test("keep API order and drop invalid entries", () => {
    expect(videoPlaylistIds({ playlists: ["55", "abc", "0", "66"] })).toEqual([
      55, 66,
    ])
    expect(
      parentPodcastIds({ podcast_episode: { podcasts: ["10", "x", "20"] } }),
    ).toEqual([10, 20])
  })
})
