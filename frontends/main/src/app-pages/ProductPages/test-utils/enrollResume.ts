/**
 * Point the mocked window.location (see setupLocationMock) at a page URL.
 * Resume tests also stub history.replaceState, which jsdom would otherwise
 * apply to its real location rather than the mock.
 */
const setLocation = (pathAndQuery: string): void => {
  const url = new URL(pathAndQuery, "http://localhost")
  Object.assign(window.location, {
    href: url.href,
    pathname: url.pathname,
    search: url.search,
  })
}

/** The `next`/`signup_next` URLs of the last login redirect, and its query. */
const lastAuthRedirect = () => {
  const calls = jest.mocked(window.location.assign).mock.calls
  const url = new URL(String(calls[calls.length - 1][0]))
  return {
    url,
    next: new URL(url.searchParams.get("next")!),
    signupNext: new URL(url.searchParams.get("signup_next")!),
  }
}

export { setLocation, lastAuthRedirect }
