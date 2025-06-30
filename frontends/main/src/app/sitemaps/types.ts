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
   */
  location: string
  limit: number
  offset: number
}
