import { useEffect } from "react"
import { slugify } from "@/common/slugs"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"

/**
 * Once the drawer's resource is known, canonicalize the `resource_title` param
 * in place (history.replaceState — not push, so Back isn't polluted): set it to
 * the current slug, correct a stale one, or remove it when the slug is blank.
 * `resource` (the authoritative id) is never touched; the host pathname and all
 * other query params are preserved. No-op until the title is known and when
 * already canonical (see feature_work/hq_11210/spec.md criterion 13).
 *
 * Takes primitive (id, title) rather than an object so the effect deps are
 * stable — it won't re-fire on every render from a fresh object reference.
 */
export const useCanonicalizeResourceParam = (
  id: number | undefined,
  title: string | undefined,
) => {
  useEffect(() => {
    if (id === undefined || title === undefined) return
    const slug = slugify(title)
    const key = RESOURCE_DRAWER_PARAMS.resource_title
    const params = new URLSearchParams(window.location.search)
    // The resource may have left the URL before its fetch resolved (drawer
    // closed mid-fetch, or switched to another resource) — don't write a
    // resource_title that matches nothing.
    if (params.get(RESOURCE_DRAWER_PARAMS.resource) !== String(id)) return
    const current = params.get(key)

    if (slug) {
      if (current === slug) return
      params.set(key, slug)
    } else {
      if (current === null) return
      params.delete(key)
    }
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params}${window.location.hash}`,
    )
  }, [id, title])
}
