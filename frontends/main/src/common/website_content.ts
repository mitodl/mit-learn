import type { JSONContent } from "@tiptap/react"
import { WebsiteContentContentTypeEnum, type WebsiteContent } from "api/v1"

/**
 * Display labels for website content types.
 *
 * Keyed on the generated enum rather than `Record<string, string>` so that
 * adding a content type is a type error here until a label is supplied.
 *
 * Deliberately not the generated `WebsiteContentContentTypeEnumDescriptions`:
 * those values come from the `WebsiteContentType` labels in
 * `website_content/constants.py`, so a backend rename would quietly change UI
 * copy. Take the type from generated code, keep the strings here.
 */
export const CONTENT_TYPE_LABELS: Record<
  WebsiteContentContentTypeEnum,
  string
> = {
  [WebsiteContentContentTypeEnum.News]: "News",
  [WebsiteContentContentTypeEnum.Article]: "Article",
}

/**
 * Narrow an arbitrary query-param string to a known content type, or undefined
 * if it isn't one.
 */
export const toContentType = (
  value: string | undefined,
): WebsiteContentContentTypeEnum | undefined =>
  Object.values(WebsiteContentContentTypeEnum).find((type) => type === value)

/**
 * The banner's subheading -- the line under the headline, and the one part of
 * the body written as a summary.
 *
 * This is what an SEO description falls back to. The API resolves that for
 * saved content (`seo_description`, see `inferred_seo_description` in
 * `website_content/utils.py`); this reads a document in hand, which is what
 * the editor needs while someone is still typing into it.
 *
 * Positional, because that is how the banner is built: first child the
 * heading, second the subheading. The Python side matches, so a change to the
 * banner's shape has to land in both.
 *
 * Every inline node is joined, not just the first: a subheading with any
 * formatting in it is several text nodes rather than one, so "A **complex**
 * article" is three. Joined with nothing between them -- they are contiguous
 * characters that differ only by their marks, and a separator would break
 * words apart.
 */
export const extractWebsiteContentDescription = (
  content: WebsiteContent | { content?: JSONContent },
): string | undefined => {
  const banner = content.content?.content?.[0]
  const subheading = banner?.content?.[1]
  const text = (subheading?.content ?? [])
    .map((node: JSONContent) => node.text ?? "")
    .join("")
  /* Absent rather than blank, which is what `getMetadataAsync` needs to
     substitute its own default instead of emitting an empty tag. */
  return text || undefined
}

/**
 * The title and description for the page head, which is where the SEO fields
 * do their work: stored on the row they are invisible, and it is `<title>` and
 * `<meta name="description">` in the server's response that a crawler reads
 * and a search result shows.
 *
 * Both come resolved from the API -- `seo_title` and `seo_description` are the
 * editor's override where there is one and the content's own words otherwise,
 * so this applies no fallback of its own. A blank `seo_description` means
 * the document had no subheading to infer from, and `getMetadataAsync`
 * substitutes its own default for that.
 */
export const websiteContentSeo = (
  content: WebsiteContent,
): { title: string; description: string | undefined } => ({
  title: content.seo_title,
  description: content.seo_description || undefined,
})

export const extractImageMetadata = (
  content: WebsiteContent,
): { src: string; alt: string } | null => {
  const imageWithCaption = content.content?.content?.find(
    (node: JSONContent) => node.type === "imageWithCaption",
  )

  const attrs = imageWithCaption?.attrs as
    | { src?: string; alt?: string; caption?: string }
    | undefined

  if (!attrs?.src) {
    return null
  }

  return {
    src: attrs.src,
    alt: attrs.caption || attrs.alt || "",
  }
}

/**
 * The WebsiteContent id behind a news feed item, or null if it has none.
 *
 * The news feed mixes externally ingested items with website content that
 * `WebsiteContentNewsPlugin` syncs into it, and only the latter can be
 * unpublished from here. The feed carries no content id, so the link is the
 * guid the sync writes -- see `website_content_feed_guid` in
 * `news_events/etl/articles_news.py`, which is the convention's source of
 * truth. Anything that does not match that shape is not ours to act on.
 */
export const websiteContentIdFromFeedGuid = (
  guid: string | undefined,
): number | null => {
  const match = /^article-(\d+)$/.exec(guid ?? "")
  return match ? Number(match[1]) : null
}
