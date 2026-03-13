import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { auth, coursePageView, programPageView } from "./urls"

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

test("programPageView returns /programs/ path for program with empty display_mode", () => {
  expect(
    programPageView({ readable_id: "some-plain-slug", display_mode: null }),
  ).toBe("/programs/some-plain-slug")
  expect(
    programPageView({
      readable_id: "some-plain-slug",
      display_mode: "",
    }),
  ).toBe("/programs/some-plain-slug")
  expect(
    programPageView({
      readable_id: "some-plain-slug",
      display_mode: undefined,
    }),
  ).toBe("/programs/some-plain-slug")
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
