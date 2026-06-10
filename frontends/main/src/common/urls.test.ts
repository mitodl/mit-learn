import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  auth,
  coursePageView,
  ocwLearnPageView,
  programPageView,
  podcastPageView,
  podcastEpisodePageView,
  videoDetailPageView,
  videoPlaylistPageView,
  canonicalResourceDrawerUrl,
  carrySearchParams,
  resourceDrawerSearch,
} from "./urls"

const MITOL_API_BASE_URL = process.env.NEXT_PUBLIC_MITOL_API_BASE_URL

test.each([
  {
    loginNext: { pathname: "/", searchParams: null },
    expected: [
      "http://api.test.learn.odl.local:8065/login",
      "?next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2F",
    ].join(""),
  },
  {
    loginNext: {
      pathname: "/courses/course-v1:edX+DemoX+Demo_Course",
      searchParams: null,
    },
    expected: [
      "http://api.test.learn.odl.local:8065/login",
      "?next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2Fcourses%2Fcourse-v1%3AedX%2BDemoX%2BDemo_Course",
    ].join(""),
  },
  {
    loginNext: {
      pathname: "/courses/course-v1:edX+DemoX+Demo_Course",
      searchParams: new URLSearchParams({ foo: "bar" }),
    },
    expected: [
      `${MITOL_API_BASE_URL}/login`,
      "?next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2Fcourses%2Fcourse-v1%3AedX%2BDemoX%2BDemo_Course%3Ffoo%3Dbar",
    ].join(""),
  },
  {
    loginNext: {
      pathname: "/courses/course-v1:edX+DemoX+Demo_Course",
      searchParams: new URLSearchParams({ foo: "bar" }),
    },
    signupNext: {
      pathname: "/somewhere/else",
      searchParams: null,
    },
    expected: [
      `${MITOL_API_BASE_URL}/login`,
      "?next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2Fcourses%2Fcourse-v1%3AedX%2BDemoX%2BDemo_Course%3Ffoo%3Dbar",
      "&signup_next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2Fsomewhere%2Felse",
    ].join(""),
  },
])(
  "login encodes the next parameter appropriately",
  ({ loginNext, signupNext, expected }) => {
    expect(auth({ next: loginNext, signupNext })).toBe(expected)
  },
)

test.each([
  {
    readableId: "course-v1:MITxT+10.50x",
    expected: "/courses/course-v1:MITxT+10.50x",
  },
  {
    readableId: "some-plain-slug",
    expected: "/courses/some-plain-slug",
  },
])(
  "coursePageView does not encode RFC 3986 pchar characters",
  ({ readableId, expected }) => {
    expect(coursePageView(readableId)).toBe(expected)
  },
)

test.each([
  { displayMode: null, label: "null" },
  { displayMode: "", label: "empty string" },
  { displayMode: undefined, label: "undefined" },
] as const)(
  "programPageView returns /programs/ path when display_mode is $label",
  ({ displayMode }) => {
    // Use a realistic readable_id with pchar characters (: and +) to verify
    // they are not percent-encoded in the URL path.
    expect(
      programPageView({
        readable_id: "program-v1:MITxT+10.50x",
        display_mode: displayMode,
      }),
    ).toBe("/programs/program-v1:MITxT+10.50x")
  },
)

test("programPageView returns /programs/ path when display_mode is omitted", () => {
  expect(
    programPageView(
      // @ts-expect-error Force callers to pass display_mode explicitly
      { readable_id: "some-plain-slug" },
    ),
  ).toBe("/programs/some-plain-slug")
})

test("programPageView returns /courses/p/ path when display_mode is course", () => {
  expect(
    programPageView({
      readable_id: "program-v1:MITxT+18.01x",
      display_mode: DisplayModeEnum.Course,
    }),
  ).toBe("/courses/p/program-v1:MITxT+18.01x")
})

test("programPageView falls back to /programs/ for unknown display_mode values", () => {
  expect(
    programPageView({
      readable_id: "some-slug",
      display_mode: "unknown-future-value" as never,
    }),
  ).toBe("/programs/some-slug")
})

test.each([
  "https://example.com/courses/some-course",
  "https://mit.edu/courses/some-course",
])("ocwLearnPageView returns original URL for non-OCW hostnames", (url) => {
  expect(ocwLearnPageView(url)).toBe(url)
})

test.each([
  {
    input: "https://ocw.mit.edu/courses/some-course",
    expected: "/courses/o/some-course",
  },
  {
    input: "https://ocw.mit.edu/courses/physics-101/",
    expected: "/courses/o/physics-101/",
  },
  {
    input: "https://ocw.mit.edu/search",
    expected: "/search",
  },
])("ocwLearnPageView transforms OCW URLs correctly", ({ input, expected }) => {
  expect(ocwLearnPageView(input)).toBe(expected)
})

describe("slug-aware path builders", () => {
  test("podcastPageView appends a slug segment; blank → 'resource'; no title → bare", () => {
    expect(podcastPageView("123", "Beyond Biology")).toBe(
      "/podcast/123/beyond-biology",
    )
    expect(podcastPageView("123", "2024")).toBe("/podcast/123/resource") // blank slug
    // explicit undefined title → bare (redirects)
    expect(podcastPageView("123", undefined)).toBe("/podcast/123")
  })

  test("podcastEpisodePageView slugs the episode, keeps podcast id bare", () => {
    expect(podcastEpisodePageView("55", "123", "Episode One")).toBe(
      "/podcast/123/podcast_episode/55/episode-one",
    )
    expect(podcastEpisodePageView("55", "123", "你好")).toBe(
      "/podcast/123/podcast_episode/55/resource",
    )
  })

  test("videoDetailPageView slugs the video and keeps ?playlist", () => {
    expect(videoDetailPageView(16765, 13798, "Beyond Biology")).toBe(
      "/video/16765/beyond-biology?playlist=13798",
    )
    expect(videoDetailPageView(16765, undefined, "Beyond Biology")).toBe(
      "/video/16765/beyond-biology",
    )
    expect(videoDetailPageView(16765, 13798, undefined)).toBe(
      "/video/16765?playlist=13798",
    )
  })

  test("videoDetailPageView allows a slug equal to 'embed' (embed route moved out)", () => {
    expect(videoDetailPageView(16765, undefined, "Embed")).toBe(
      "/video/16765/embed",
    )
  })

  test("videoPlaylistPageView appends a slug segment", () => {
    expect(videoPlaylistPageView("13798", "Great Talks")).toBe(
      "/video-playlist/13798/great-talks",
    )
  })
})

describe("separate-param drawer builders", () => {
  test("resourceDrawerSearch emits resource + optional resource_title (relative)", () => {
    expect(resourceDrawerSearch(114927, "Beyond Biology")).toBe(
      "/search?resource=114927&resource_title=beyond-biology",
    )
    expect(resourceDrawerSearch(114927, "2024")).toBe("/search?resource=114927") // blank → omit
    expect(resourceDrawerSearch(114927)).toBe("/search?resource=114927")
  })

  test("canonicalResourceDrawerUrl is the absolute form", () => {
    expect(canonicalResourceDrawerUrl(114927, "Beyond Biology")).toMatch(
      /\/search\?resource=114927&resource_title=beyond-biology$/,
    )
    expect(canonicalResourceDrawerUrl(114927, "2024")).toMatch(
      /\/search\?resource=114927$/,
    )
  })
})

test("INVARIANT: canonical paths round-trip URL decoding byte-identically", () => {
  // The [slug] pages compare Next's *decoded* route params against builder
  // output; if a builder ever emits a percent-encodable character, a URL
  // could redirect to a spelling of itself and loop. See pathSlug in urls.ts.
  const paths = [
    podcastPageView("123", "Beyond Biology!"),
    podcastEpisodePageView("55", "123", "Épisode #1"),
    videoDetailPageView(16765, 13798, "你好"),
    videoPlaylistPageView("9", "a".repeat(70)),
  ]
  paths.forEach((p) => expect(decodeURIComponent(p)).toBe(p))
})

describe("carrySearchParams", () => {
  test("appends incoming params to the canonical", () => {
    expect(
      carrySearchParams("/podcast/1/slug", { utm_source: "newsletter" }),
    ).toBe("/podcast/1/slug?utm_source=newsletter")
    expect(carrySearchParams("/podcast/1/slug", {})).toBe("/podcast/1/slug")
  })

  test("canonical-owned params win and omitted params are dropped", () => {
    expect(
      carrySearchParams(
        "/video/1/slug?playlist=10",
        { playlist: "999", utm_source: "x" },
        ["playlist"],
      ),
    ).toBe("/video/1/slug?utm_source=x&playlist=10")
  })
})
