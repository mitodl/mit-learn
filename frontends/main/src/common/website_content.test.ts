import { factories } from "api/test-utils"
import {
  extractWebsiteContentDescription,
  websiteContentSeo,
} from "./website_content"

/**
 * A body shaped the way the banner is built: first child the heading, second
 * the subheading. That subheading is what an SEO description falls back to.
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

describe("extractWebsiteContentDescription", () => {
  /**
   * Mirrored by `inferred_seo_description` in `website_content/utils.py`, which
   * is what the API resolves with. This reads a document in hand instead, for
   * the editor, so the two have to agree on where the subheading is.
   */
  test("reads the banner's subheading", () => {
    expect(
      extractWebsiteContentDescription({
        content: withBannerSubheading("The line beneath it."),
      }),
    ).toBe("The line beneath it.")
  })

  /**
   * A subheading with any formatting in it is several text nodes, not one --
   * ProseMirror splits on every mark boundary. Reading only the first gave
   * "A " for a line that reads "A complex article with various elements."
   */
  test("joins a subheading split up by formatting", () => {
    expect(
      extractWebsiteContentDescription({
        content: {
          type: "doc",
          content: [
            {
              type: "banner",
              content: [
                {
                  type: "heading",
                  content: [{ type: "text", text: "Complex Article" }],
                },
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "A " },
                    {
                      type: "text",
                      marks: [{ type: "bold" }],
                      text: "complex",
                    },
                    { type: "text", text: " article with " },
                    {
                      type: "text",
                      marks: [{ type: "italic" }],
                      text: "various",
                    },
                    { type: "text", text: " elements." },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ).toBe("A complex article with various elements.")
  })

  test("yields nothing for a body that is not that shape", () => {
    expect(
      extractWebsiteContentDescription({
        content: { type: "doc", content: [] },
      }),
    ).toBe("")
  })
})

/**
 * The fallbacks live in the serializer now -- `seo_title` and
 * `seo_description` arrive resolved -- so this only has to hand them on. It
 * exists to keep the two routes reading the same two fields rather than each
 * reaching into the payload.
 */
describe("websiteContentSeo", () => {
  test("passes the resolved values through", () => {
    const content = factories.websiteContent.websiteContent({
      title: "The content's own title",
      seo_title: "A title written for search",
      seo_description: "A description written for search.",
    })

    expect(websiteContentSeo(content)).toEqual({
      title: "A title written for search",
      description: "A description written for search.",
    })
  })

  /**
   * A blank description means the document had no subheading and nobody wrote
   * one. `getMetadataAsync` substitutes its own default for `undefined`, and
   * would emit an empty tag for `""` -- so the blank has to become absent here.
   */
  test("turns a blank description into nothing at all", () => {
    const content = factories.websiteContent.websiteContent({
      seo_title: "Still has a title",
      seo_description: "",
    })

    expect(websiteContentSeo(content).description).toBeUndefined()
  })
})
