import { requiredEnv } from "@/env"
import type { MetadataRoute } from "next"
import { dangerouslyDetectProductionBuildPhase } from "./sitemaps/util"

/**
 * As of NextJS 15.5.3, metadata routes like robots.ts are ALWAYS executed at
 * build time even with force-dynamic (this may be a NextJS bug). We guard
 * against that here so requiredEnv() is not called before NEXT_PUBLIC_ORIGIN
 * is injected at runtime by Kubernetes.
 */
export const dynamic = "force-dynamic"

export default function robots(): MetadataRoute.Robots {
  if (dangerouslyDetectProductionBuildPhase()) {
    // Safe fallback during `next build`: never served in production.
    return { rules: { userAgent: "*", disallow: "/" } }
  }
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
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
