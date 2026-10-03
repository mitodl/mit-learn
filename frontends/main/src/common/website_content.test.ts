import { factories } from "api/test-utils"
import { websiteContentSeo } from "./website_content"

/**
 * A body shaped the way `extractWebsiteContentDescription` reads it: the
 * banner's second child's first text node. That is what the page head used
 * before the SEO fields existed, and what it falls back to now.
 */
const withBannerSubheading = (text: string) => ({
  type: "doc",
  content: [
    {
      type: "banner",
      content: [
        { type: "heading", content: [{ type: "text", text: "A heading" }] },
        { type: "paragraph", content: [{ type: "text", text }] },
      ],
    },
  ],
})

const content = (overrides = {}) =>
  factories.websiteContent.websiteContent({
    title: "The content's own title",
    content: withBannerSubheading("The opening of the body."),
    ...overrides,
  })

describe("websiteContentSeo", () => {
  test("the editor's overrides win where they are set", () => {
    expect(
      websiteContentSeo(
        content({
          seo_title: "A title written for search",
          seo_description: "A description written for search.",
        }),
      ),
    ).toEqual({
      title: "A title written for search",
      description: "A description written for search.",
    })
  })

  /**
   * Blank, not null, is how an unset field arrives -- the serializer defaults
   * both to `""` -- so the fallback has to be chosen on emptiness. Picking on
   * `null` alone would emit an empty title, which is worse than the old
   * behaviour rather than better than it.
   */
  test("blank falls back to the title and the body's opening", () => {
    expect(websiteContentSeo(content())).toEqual({
      title: "The content's own title",
      description: "The opening of the body.",
    })
  })

  test("the two fall back independently", () => {
    expect(
      websiteContentSeo(content({ seo_title: "Only the title is written" })),
    ).toEqual({
      title: "Only the title is written",
      description: "The opening of the body.",
    })
    expect(
      websiteContentSeo(content({ seo_description: "Only this is written." })),
    ).toEqual({
      title: "The content's own title",
      description: "Only this is written.",
    })
  })

  /**
   * A body that is not the expected shape yields no description at all, which
   * is what `getMetadataAsync` turns into its own default. An SEO description
   * is the way out of that, so it must still be preferred here.
   */
  test("a body it cannot read leaves the description undefined", () => {
    const unreadable = content({ content: { type: "doc", content: [] } })
    expect(websiteContentSeo(unreadable).description).toBeUndefined()
    expect(
      websiteContentSeo({ ...unreadable, seo_description: "Written." })
        .description,
    ).toBe("Written.")
  })
})
