import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  AccountAction,
  accountAction,
  auth,
  coursePageView,
  ocwLearnPageView,
  programPageView,
  podcastEpisodePath,
  videoDetailPath,
  learnUrlPath,
  learnUrlSlug,
  generateVideoPlaylistPath,
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
    action: AccountAction.UpdateEmail,
    expected: [
      `${MITOL_API_BASE_URL}/account/action/start/update-email/`,
      "?next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2Fdashboard%2Fsettings",
    ].join(""),
  },
  {
    action: AccountAction.UpdatePassword,
    expected: [
      `${MITOL_API_BASE_URL}/account/action/start/update-password/`,
      "?next=http%3A%2F%2Ftest.learn.odl.local%3A8062%2Fdashboard%2Fsettings",
    ].join(""),
  },
])(
  "accountAction points at Django with an encoded next URL",
  ({ action, expected }) => {
    expect(
      accountAction(action, {
        pathname: "/dashboard/settings",
        searchParams: null,
      }),
    ).toBe(expected)
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

describe("separate-param drawer builders", () => {
  test("resourceDrawerSearch emits resource + optional resource_title (relative)", () => {
    expect(resourceDrawerSearch(114927, "Beyond Biology")).toBe(
      "/search?resource=114927&resource_title=beyond-biology",
    )
    expect(resourceDrawerSearch(114927, "2024")).toBe("/search?resource=114927") // blank → omit
    expect(resourceDrawerSearch(114927, undefined)).toBe(
      "/search?resource=114927",
    )
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

describe("learn_url helpers", () => {
  const ORIGIN = "http://test.learn.odl.local:8062"

  test("learnUrlPath keeps the path and query, dropping the origin", () => {
    expect(learnUrlPath(`${ORIGIN}/podcast/123/beyond-biology`)).toBe(
      "/podcast/123/beyond-biology",
    )
    expect(learnUrlPath(`${ORIGIN}/video/16765/intro?playlist=13798`)).toBe(
      "/video/16765/intro?playlist=13798",
    )
    expect(learnUrlPath(`${ORIGIN}/search?resource=42&resource_title=x`)).toBe(
      "/search?resource=42&resource_title=x",
    )
  })

  test("learnUrlPath leaves readable-id characters unescaped", () => {
    // An MITx Online id contains ':' and '+', both legal in a path segment.
    expect(learnUrlPath(`${ORIGIN}/courses/course-v1:MITxT+14.100x`)).toBe(
      "/courses/course-v1:MITxT+14.100x",
    )
  })

  test("learnUrlSlug returns the final path segment", () => {
    expect(learnUrlSlug(`${ORIGIN}/podcast/123/beyond-biology`)).toBe(
      "beyond-biology",
    )
    // The query is not part of the slug.
    expect(learnUrlSlug(`${ORIGIN}/video/16765/intro?playlist=13798`)).toBe(
      "intro",
    )
    // The backend emits the literal "resource" when a title yields no slug.
    expect(learnUrlSlug(`${ORIGIN}/podcast/123/resource`)).toBe("resource")
  })

  test("podcastEpisodePath places the episode under the given podcast", () => {
    expect(podcastEpisodePath("55", "123", "episode-one")).toBe(
      "/podcast/123/podcast_episode/55/episode-one",
    )
    // No slug → bare, which redirects to the canonical form.
    expect(podcastEpisodePath("55", "123", undefined)).toBe(
      "/podcast/123/podcast_episode/55",
    )
  })

  test("videoDetailPath keeps ?playlist alongside the slug", () => {
    expect(videoDetailPath(16765, 13798, "beyond-biology")).toBe(
      "/video/16765/beyond-biology?playlist=13798",
    )
    expect(videoDetailPath(16765, undefined, "beyond-biology")).toBe(
      "/video/16765/beyond-biology",
    )
    expect(videoDetailPath(16765, 13798, undefined)).toBe(
      "/video/16765?playlist=13798",
    )
  })

  test("the bare playlist path redirects to the slugged canonical", () => {
    expect(generateVideoPlaylistPath("13798")).toBe("/video-playlist/13798")
  })
})

test("INVARIANT: canonical paths round-trip URL decoding byte-identically", () => {
  // The [slug] pages compare Next's *decoded* route params against these
  // paths; if one ever carried a percent-encodable character, a URL could
  // redirect to a spelling of itself and loop. The slug now comes from the
  // backend, whose charset is [a-z0-9-] or the literal "resource".
  const paths = [
    podcastEpisodePath("55", "123", "episode-one"),
    videoDetailPath(16765, 13798, "beyond-biology"),
    learnUrlPath("http://test.learn.odl.local:8062/podcast/123/resource"),
    generateVideoPlaylistPath("9"),
  ]
  paths.forEach((path) => expect(decodeURIComponent(path)).toBe(path))
})

describe("carrySearchParams", () => {
  test("appends incoming params to the canonical", () => {
    expect(
      carrySearchParams("/podcast/1/slug", { utm_source: "newsletter" }),
    ).toBe("/podcast/1/slug?utm_source=newsletter")
    expect(carrySearchParams("/podcast/1/slug", {})).toBe("/podcast/1/slug")
  })

  test("canonical-owned params win", () => {
    expect(
      carrySearchParams(
        "/video/1/slug?playlist=10",
        { playlist: "999", utm_source: "x" },
        ["playlist"],
      ),
    ).toBe("/video/1/slug?utm_source=x&playlist=10")
  })

  test("omit drops a rejected param the canonical doesn't own (loop safety)", () => {
    // Without omit, the rejected playlist would be forwarded onto the bare
    // canonical, differ from it on the next request, and redirect forever.
    expect(
      carrySearchParams("/video/1/slug", { playlist: "999", utm_source: "x" }, [
        "playlist",
      ]),
    ).toBe("/video/1/slug?utm_source=x")
  })
})
