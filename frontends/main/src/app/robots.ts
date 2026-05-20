import { env } from "@/env"
import type { MetadataRoute } from "next"
import invariant from "tiny-invariant"

invariant(env("NEXT_PUBLIC_ORIGIN"), "NEXT_PUBLIC_ORIGIN must be defined")
const BASE_URL: string = env("NEXT_PUBLIC_ORIGIN")

export default function robots(): MetadataRoute.Robots {
  const shouldIndex = process.env.MITOL_NOINDEX === "false"

  if (shouldIndex) {
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
      sitemap: `${BASE_URL}/sitemaps/sitemap-index.xml`,
    }
  } else {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    }
  }
}
