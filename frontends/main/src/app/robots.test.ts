import robots from "./robots"
import { resourceDrawerSearch } from "@/common/urls"

/**
 * Minimal RFC 9309 rule evaluator: `*` matches any chars, `$` anchors the
 * end, the longest matching pattern wins, and ties go to Allow. Used to pin
 * rule *interactions* (which rule wins for a URL), not just the rule list.
 */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const patternMatches = (pattern: string, path: string): boolean => {
  const anchored = pattern.endsWith("$")
  const body = anchored ? pattern.slice(0, -1) : pattern
  const source = `^${body.split("*").map(escapeRegExp).join(".*")}${anchored ? "$" : ""}`
  return new RegExp(source).test(path)
}
const asArray = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]
const isAllowed = (
  group: { allow?: string | string[]; disallow?: string | string[] },
  path: string,
): boolean => {
  const matched = [
    ...asArray(group.allow).map((p) => ({ p, allow: true })),
    ...asArray(group.disallow).map((p) => ({ p, allow: false })),
  ].filter(({ p }) => patternMatches(p, path))
  matched.sort((a, b) => b.p.length - a.p.length || (a.allow ? -1 : 1))
  return matched[0]?.allow ?? true
}

const getDefaultGroup = () => {
  const rules = robots().rules
  if (!Array.isArray(rules)) throw new Error("expected an array of rule groups")
  const group = rules.find((r) => r.userAgent === "*")
  if (!group) throw new Error("expected a default (*) rule group")
  return group
}

describe("robots", () => {
  const originalNoindex = process.env.MITOL_NOINDEX

  afterEach(() => {
    if (originalNoindex === undefined) {
      delete process.env.MITOL_NOINDEX
    } else {
      process.env.MITOL_NOINDEX = originalNoindex
    }
  })

  it("disallows everything when MITOL_NOINDEX is not 'false'", () => {
    process.env.MITOL_NOINDEX = "true"
    expect(robots()).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    })
  })

  it("emits the crawl rules when indexing is enabled", () => {
    process.env.MITOL_NOINDEX = "false"
    expect(robots()).toEqual({
      rules: [
        {
          userAgent: "*",
          // Canonical resource drawer URLs (the form the resources sitemap
          // emits) stay crawlable; this wins over the disallows below by
          // longest-match precedence.
          allow: ["/search?resource="],
          disallow: [
            "/search?",
            "/*?resource=",
            "/*&resource=",
            "/*?_rsc=",
            "/*&_rsc=",
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
          userAgent: "meta-externalads",
          disallow: "/",
        },
      ],
      sitemap: "http://test.learn.odl.local:8062/sitemaps/sitemap-index.xml",
    })
  })

  /**
   * The Allow rule for drawer URLs is a literal prefix, so it only covers
   * URLs exactly as resourceDrawerSearch emits them — the same builder the
   * resources sitemap and canonical tags use. If the builder changes (path,
   * param order), these fail rather than silently de-indexing every resource.
   */
  describe("canonical drawer URLs stay crawlable", () => {
    beforeEach(() => {
      process.env.MITOL_NOINDEX = "false"
    })

    it("allows the URL form the resources sitemap emits", () => {
      const group = getDefaultGroup()
      expect(
        isAllowed(
          group,
          resourceDrawerSearch(123, "Introduction to Algorithms"),
        ),
      ).toBe(true)
      expect(isAllowed(group, resourceDrawerSearch(123, undefined))).toBe(true)
    })

    it("allows the bare search landing page but not faceted search", () => {
      const group = getDefaultGroup()
      expect(isAllowed(group, "/search")).toBe(true)
      expect(isAllowed(group, "/search?q=physics")).toBe(false)
    })

    it("disallows drawer overlays anywhere else", () => {
      const group = getDefaultGroup()
      expect(isAllowed(group, "/?resource=123")).toBe(false)
      expect(isAllowed(group, "/c/topic/physics?resource=123")).toBe(false)
      expect(isAllowed(group, "/search?q=physics&resource=123")).toBe(false)
    })
  })
})
