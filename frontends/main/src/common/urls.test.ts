import { login } from "./urls"

const MITOL_API_BASE_URL = process.env.NEXT_PUBLIC_MITOL_API_BASE_URL

test("login encodes the next parameter appropriately", () => {
  expect(login({ pathname: null, searchParams: null })).toBe(
    `${MITOL_API_BASE_URL}/login?next=http://test.learn.odl.local:8062/`,
  )

  expect(
    login({
      pathname: "/foo/bar",
      searchParams: null,
    }),
  ).toBe(
    `${MITOL_API_BASE_URL}/login?next=http://test.learn.odl.local:8062/foo/bar`,
  )

  expect(
    login({
      pathname: "/foo/bar",
      searchParams: new URLSearchParams("?cat=meow"),
    }),
  ).toBe(
    `${MITOL_API_BASE_URL}/login?next=http://test.learn.odl.local:8062/foo/bar%3Fcat%3Dmeow`,
  )
})
