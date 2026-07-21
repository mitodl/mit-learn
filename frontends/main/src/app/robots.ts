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
      rules: [
        {
          userAgent: "*",
          /**
           * Resource drawer: every ?resource= URL canonicalizes to
           * /search?resource=<id>&resource_title=<slug>, and the resources
           * sitemap enumerates every resource at exactly that URL. Crawling
           * drawer overlays anywhere else (/c/, /news, /, faceted search) is
           * pure duplicate load, so allow only the canonical form (and the
           * bare /search landing page) and block resource-carrying URLs
           * site-wide. The allow rules win by longest-match precedence
           * (RFC 9309); they are listed first for naive first-match parsers.
           *
           * NOTE: the allow rule is a literal prefix match, so it depends on
           * `resource` being the FIRST query param in canonical drawer URLs
           * (see resourceDrawerSearch in common/urls.ts).
           */
          allow: ["/search$", "/search?resource="],
          disallow: [
            "/search",
            "/*?resource=",
            "/*&resource=",
            // Next.js router-prefetch payloads — never part of rendered or
            // indexed content
            "/*?_rsc=",
            "/*&_rsc=",
            // Account / app-only areas
            "/dashboard/",
            "/learningpaths/",
            "/onboarding/",
            "/cart/",
            "/program_letter/",
            "/enrollmentcode/",
            "/organization/",
            "/website_content/drafts",
          ],
        },
        {
          /**
           * Link-preview fetchers: fetch exact shared URLs on demand (tiny
           * volume) and must be able to see ?resource= URLs for og: cards.
           * A named group opts them out of ALL default-group rules.
           */
          userAgent: [
            "facebookexternalhit",
            "Twitterbot",
            "Slackbot",
            "LinkedInBot",
            "Discordbot",
            "WhatsApp",
            "TelegramBot",
          ],
          allow: "/",
        },
        {
          /**
           * AI-training crawlers — blocking costs no search visibility.
           * (Google-Extended / Applebot-Extended are opt-out tokens
           * controlling training use of Googlebot/Applebot crawl data, not
           * separate crawlers.)
           */
          userAgent: [
            "GPTBot",
            "CCBot",
            "meta-externalagent",
            "Google-Extended",
            "Applebot-Extended",
            "Bytespider",
            "ClaudeBot",
            "Amazonbot",
          ],
          disallow: "/",
        },
        {
          /**
           * Meta's advertising/business crawler. Blocked 2026-07-21 (#3653)
           * after it crawled ?resource=/_rsc= URL permutations at up to
           * ~90k req/hr — the majority of all origin-reaching traffic during
           * the incident. robots.txt is advisory only (this UA has never
           * fetched /robots.txt here), so the gateway/WAF layer is the
           * enforcement backstop if volume doesn't drop.
           *
           * NOTE: RFC 9309 user-agent tokens cannot contain "/" — matching
           * requires the bare product token, not "meta-externalads/1.1".
           */
          userAgent: "meta-externalads",
          disallow: "/",
        },
      ],
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
