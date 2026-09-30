/**
 * Point the address bar at where a saved draft lives, without navigating.
 *
 * A draft writes itself a couple of seconds after typing stops, and the first
 * such save on a new item is what gives that item a URL. Reaching it with
 * `router.push` unmounts the editor and mounts the next page in its place: the
 * caret is lost mid-sentence, the new route shows a spinner while it fetches
 * the item the editor is already holding, and to the author the page simply
 * reloaded under them while they were writing.
 *
 * `history.replaceState` is Next's supported way to change the URL without
 * re-running the route, so nothing unmounts and the editor keeps its state and
 * its focus. That is safe because the URL is not what the editor saves
 * against -- it remembers the row it created (`createdIdRef` in
 * `WebsiteContentEditor`) and PATCHes that regardless of what the address bar
 * says. Updating it only matters for a reload, a bookmark, or a shared link.
 *
 * `replace` rather than `push`, so Back does not have to step through an entry
 * per autosave to get out of the editor.
 *
 * No-op when the URL is already right, which is the common case: every save
 * after the first one is to an item whose URL we are already on.
 */
export const replaceDraftUrl = (url: string): void => {
  if (typeof window === "undefined") return
  if (window.location.pathname === url) return
  window.history.replaceState({}, "", url)
}
