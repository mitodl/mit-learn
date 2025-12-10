import { auth } from "./urls"

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
