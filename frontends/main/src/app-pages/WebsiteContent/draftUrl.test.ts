import { replaceDraftUrl } from "./draftUrl"

const at = (pathname: string) => window.history.replaceState({}, "", pathname)

describe("replaceDraftUrl", () => {
  test("puts the draft's URL in the address bar", () => {
    at("/website_content/article/new")

    replaceDraftUrl("/website_content/article/42/edit")

    expect(window.location.pathname).toBe("/website_content/article/42/edit")
  })

  test("canonicalises a URL that named the item by slug", () => {
    at("/website_content/article/some-slug/edit")

    replaceDraftUrl("/website_content/article/42/edit")

    expect(window.location.pathname).toBe("/website_content/article/42/edit")
  })

  /**
   * The common case, since a draft saves itself every couple of seconds and
   * every save after the first is to an item whose URL we are already on.
   * Writing the same entry repeatedly is what `history.replaceState` is least
   * bad at, but skipping it keeps the intent legible and costs nothing.
   */
  test("does nothing when the URL is already right", () => {
    at("/website_content/article/42/edit")
    const replaceState = jest.spyOn(window.history, "replaceState")

    replaceDraftUrl("/website_content/article/42/edit")

    expect(replaceState).not.toHaveBeenCalled()
    replaceState.mockRestore()
  })

  /**
   * `replace`, not `push`: Back should leave the editor, not step through an
   * entry per autosave to get out of it.
   */
  test("leaves no history entry behind", () => {
    at("/website_content/article/new")
    const pushState = jest.spyOn(window.history, "pushState")

    replaceDraftUrl("/website_content/article/42/edit")

    expect(pushState).not.toHaveBeenCalled()
    pushState.mockRestore()
  })
})
