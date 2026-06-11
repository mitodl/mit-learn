/**
 * Our return type for generateSitemaps, see
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generating-multiple-sitemaps
 */
export type GenerateSitemapResult = {
  /**
   * Required by NextJS
   */
  id: number
  /**
   * We use this to generate the sitemap index file
   *
   * NOT passed to the sitemap function
   */
  location: string
}

/**
 * The argument NextJS passes to a metadata route's default `sitemap()` export
 * when the route also exports `generateSitemaps()`.
 *
 * `id` is the stringified `id` from a {@link GenerateSitemapResult}, and in
 * Next 15.5+/16 it arrives as a Promise (part of the async request-API change),
 * so it MUST be awaited before use. NextJS does not type the `sitemap()`
 * argument itself — only the return value (`MetadataRoute.Sitemap`) — so this
 * type is hand-maintained to keep the await contract explicit and consistent
 * across every sitemap route. Not awaiting `id` silently makes `+id` NaN, which
 * collapses every shard to offset 0.
 */
export type GeneratedSitemapArgs = {
  id: Promise<string>
}
