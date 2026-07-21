import robots from "./robots"

describe("robots", () => {
  const originalNoindex = process.env.MITOL_NOINDEX

  afterEach(() => {
    process.env.MITOL_NOINDEX = originalNoindex
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
          // emits) and the bare search landing stay crawlable; these win
          // over the disallows below by longest-match precedence.
          allow: ["/search$", "/search?resource="],
          disallow: [
            "/search",
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
})
