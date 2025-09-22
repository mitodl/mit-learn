import { auth } from "./urls"

const MITOL_API_BASE_URL = process.env.NEXT_PUBLIC_MITOL_API_BASE_URL

test("login encodes the next parameter appropriately", () => {
  expect(
    auth({
      loginNext: { pathname: null, searchParams: null },
    }),
  ).toBe(
    `${MITOL_API_BASE_URL}/login?next=http://test.learn.odl.local:8062/&signup_next=http://test.learn.odl.local:8062/dashboard`,
  )

  expect(
    auth({
      loginNext: {
        pathname: "/foo/bar",
        searchParams: null,
      },
    }),
  ).toBe(
    `${MITOL_API_BASE_URL}/login?next=http://test.learn.odl.local:8062/foo/bar&signup_next=http://test.learn.odl.local:8062/dashboard`,
  )

  expect(
    auth({
      loginNext: {
        pathname: "/foo/bar",
        searchParams: new URLSearchParams("?cat=meow"),
      },
    }),
  ).toBe(
    `${MITOL_API_BASE_URL}/login?next=http://test.learn.odl.local:8062/foo/bar%3Fcat%3Dmeow&signup_next=http://test.learn.odl.local:8062/dashboard`,
  )
})
