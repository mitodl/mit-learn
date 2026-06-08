import {
  slugify,
  parseResourceId,
  resolveEpisodeParent,
  resolveVideoPlaylist,
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
    { title: "Æther", expected: "ther" }, // æ has no NFKD decomposition → dropped
    { title: "straße", expected: "stra-e" }, // ß → "-"
  ])("slugifies $title → $expected", ({ title, expected }) => {
    expect(slugify(title)).toBe(expected)
  })

  test.each([
    { title: "2024" }, // digits only, no [a-z]
    { title: "Καλημέρα" }, // Greek, no ascii letters
    { title: "你好" }, // CJK
    { title: "   " }, // whitespace only
    { title: "" },
  ])("returns '' (blank) for $title", ({ title }) => {
    expect(slugify(title)).toBe("")
  })

  test("truncates at 60 chars, backing off to last hyphen (no partial word)", () => {
    const title =
      "the quick brown fox jumps over the lazy dog and then keeps running far"
    const result = slugify(title)
    expect(result.length).toBeLessThanOrEqual(60)
    expect(result.endsWith("-")).toBe(false)
    // backs off to a word boundary at or before 60
    expect(title.toLowerCase().replace(/ /g, "-")).toContain(result)
  })
})

describe("parseResourceId", () => {
  test.each([
    { value: "2813", expected: 2813 },
    { value: "114927", expected: 114927 },
  ])("parses $value → $expected", ({ value, expected }) => {
    expect(parseResourceId(value)).toBe(expected)
  })

  test.each([
    { value: "2813-beyond-biology" }, // NOT a fused token — rejected
    { value: "2813oops" },
    { value: "abc" },
    { value: "0" }, // not a positive id
    { value: "-5" },
    { value: " 12" }, // whitespace
    { value: "" },
    { value: ["1", "2"] as string[] }, // repeated param
    { value: undefined },
    { value: null },
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
  test("falls back to first playlist for a non-member value", () => {
    expect(resolveVideoPlaylist([55, 66], "999")).toBe(55)
  })
  test("falls back to first playlist when no param", () => {
    expect(resolveVideoPlaylist([55, 66], undefined)).toBe(55)
  })
  test("falls back to first playlist for a repeated (array) param", () => {
    expect(resolveVideoPlaylist([55, 66], ["1", "2"])).toBe(55)
  })
  test("falls back to first playlist for a non-numeric value", () => {
    expect(resolveVideoPlaylist([55], "abc")).toBe(55)
  })
  test("returns null when the video has no playlists", () => {
    expect(resolveVideoPlaylist([], "5")).toBeNull()
    expect(resolveVideoPlaylist([], undefined)).toBeNull()
  })
})
