import type { MetadataRoute } from "next"
import invariant from "tiny-invariant"

invariant(process.env.NEXT_PUBLIC_ORIGIN, "NEXT_PUBLIC_ORIGIN must be defined")
const BASE_URL: string = process.env.NEXT_PUBLIC_ORIGIN

export default function robots(): MetadataRoute.Robots {
  const sitemap =
    process.env.MITOL_NOINDEX === "false"
      ? `${BASE_URL}/sitemaps/sitemap-index.xml`
      : undefined
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/learningpaths/",
        "/onboarding/",
        "/cart/",
        "/program_letter/",
      ],
    },
    sitemap,
  }
}
