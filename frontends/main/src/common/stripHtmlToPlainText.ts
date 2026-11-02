/*
 * schema.org values are plain text, so rich-text fields have to be stripped of
 * markup before they go into a JSON-LD payload. Deliberately not
 * common/htmlToPlainText: that is documented server-only because it pulls in
 * isomorphic-dompurify (jsdom), and the structured-data builders are imported
 * by "use client" components. The inputs are already sanitized to a small tag
 * set upstream, so a strip plus the handful of entities nh3 emits is enough.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

/*
 * Strip tags to a fixed point rather than in one pass.
 *
 * A single `replace(/<[^>]*>/g, "")` is not idempotent: removing one match can
 * join its neighbours into a new tag, so `<scr<div>ipt>` survives as `<script>`.
 * CodeQL calls this incomplete multi-character sanitization and it is right -
 * this value ends up inside a <script type="application/ld+json"> block. The
 * injection point also escapes `</`, but a helper that claims to return plain
 * text should not depend on its caller for that.
 *
 * Looping to a fixed point and then dropping any surviving angle bracket means
 * the result cannot contribute to a tag in any context.
 */
const stripTags = (html: string): string => {
  let previous = ""
  let current = html
  while (current !== previous) {
    previous = current
    current = current.replace(/<[^>]*>/g, "")
  }
  return current
}

const stripHtmlToPlainText = (html: string): string =>
  stripTags(
    html
      /*
       * Every block-level tag the backend allowlist keeps
       * (main/constants.py ALLOWED_HTML_TAGS) is a boundary, or its neighbours
       * run together: <div>First</div><div>Second</div> became "FirstSecond"
       * when this list only covered p/li/ul/ol/blockquote.
       */
      .replace(/<\/(?:p|li|ul|ol|blockquote|div|pre|caption|center|q)>/gi, " ")
      .replace(/<(?:br|hr)\s*\/?>/gi, " "),
  )
    // decode before dropping brackets, so an entity cannot smuggle one back in
    .replace(
      /&[a-z#0-9]+;/gi,
      (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
    )
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()

export { stripHtmlToPlainText }
