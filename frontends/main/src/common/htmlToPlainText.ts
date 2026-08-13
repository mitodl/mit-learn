import DOMPurify from "isomorphic-dompurify"
import { collapseWhitespace } from "@/common/utils"

const BLOCK_BOUNDARY_TAGS =
  /<\/(?:p|div|li|h[1-6]|td|th|tr|blockquote|pre)>|<br\s*\/?>/gi

// A string containing neither of these has no tag to strip and no entity to
// decode, so sanitizing it is a round trip. Both characters matter: guarding on
// `<` alone would send "Tom &amp; Jerry" down the fast path and leave the entity
// undecoded.
const MARKUP_OR_ENTITY = /[<&]/

/**
 * Converts a sanitized-HTML string (e.g. a resource `description`) to plain
 * text suitable for contexts that must not contain markup, like <meta
 * name="description">, og:description, and twitter:description. Strips all
 * tags and decodes entities (&amp; -> &); a space is inserted at block-level
 * boundaries first so adjacent paragraphs/list items don't get mashed
 * together once their tags are removed.
 *
 * Kept out of common/utils.ts and imported only by server-only code (e.g.
 * metadata.ts): isomorphic-dompurify has no `sideEffects: false`, so any
 * client component importing anything from utils.ts would otherwise pull
 * DOMPurify into its bundle even when htmlToPlainText itself is unused.
 *
 * `standardizeMetadata` calls this on every server-rendered page, and on the
 * server `isomorphic-dompurify` is jsdom -- so every call allocated a real DOM
 * fragment, including for descriptions that contain no markup at all (the
 * default "Learn with MIT" among them). The markup-free fast path below skips
 * that. Note it avoids the per-render allocation, not the module-level jsdom
 * import, which is a one-time cost.
 */
const htmlToPlainText = (html: string): string => {
  if (!html) return ""
  if (!MARKUP_OR_ENTITY.test(html)) return collapseWhitespace(html)
  const withBreaks = html.replace(BLOCK_BOUNDARY_TAGS, (match) => `${match} `)
  // RETURN_DOM_FRAGMENT gives back real DOM nodes rather than a serialized
  // HTML string, so reading .textContent decodes entities for free (a
  // serialized-string result stays HTML-escaped, e.g. "&amp;", since it's
  // meant to be re-inserted as HTML).
  const fragment = DOMPurify.sanitize(withBreaks, {
    RETURN_DOM_FRAGMENT: true,
  })
  return collapseWhitespace(fragment.textContent ?? "")
}

export { htmlToPlainText }
