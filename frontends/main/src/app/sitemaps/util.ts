import { PHASE_PRODUCTION_BUILD } from "next/constants"

/**
 * This returns true DURING the production build. In other words:
 *
 * - false during development, (`next dev`)
 * - true during production build (`next build`)
 * - false when running the production server (`next start`)
 *
 * Avoid using this. Our code usually should not care whether it is running
 * during the build phase, and it's unclear whether this is part of NextJS's
 * public API.
 */
export const dangerouslyDetectProductionBuildPhase = () => {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
}

/**
 * NextJS serializes sitemap entries verbatim into <loc> tags with no XML
 * escaping, so a URL containing "&" (e.g. one with multiple query params)
 * produces invalid XML. Escape XML special characters ourselves; crawlers
 * decode entities, so <loc>a&amp;b</loc> round-trips back to "a&b".
 *
 * NOTE: this relies on NextJS emitting the url verbatim. If NextJS ever
 * starts escaping <loc> itself, this would double-escape.
 */
export const escapeSitemapUrl = (url: string) =>
  url
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
