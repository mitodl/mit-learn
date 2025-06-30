import type { MetadataRoute } from "next"
import invariant from "tiny-invariant"

invariant(process.env.NEXT_PUBLIC_ORIGIN, "NEXT_PUBLIC_ORIGIN must be defined")
const BASE_URL: string = process.env.NEXT_PUBLIC_ORIGIN

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/learningpaths/",
        "/onboarding/",
        "/cart/",
        "/chat/",
        "/chat_syllabus/",
        "/program_letter/",
      ],
    },
    sitemap: `${BASE_URL}/sitemaps/sitemap-index.xml`,
  }
}
