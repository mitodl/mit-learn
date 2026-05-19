import type { Extension, Node, Mark } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import { ArticleBannerNode } from "../../extensions/node/Banner/ArticleBannerNode"
import { ByLineInfoBarNode } from "../../extensions/node/ArticleByLineInfoBar/ArticleByLineInfoBarNode"
import { createBaseExtensions } from "../../extensions/baseExtensions"
import type { CreateExtensionsFn } from "../../core/GenericEditor"

export const ArticleDocument = Document.extend({
  content: "banner byline block+",
})

export const newArticleDocument = {
  type: "doc",
  content: [
    {
      type: "banner",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [],
        },
        {
          type: "paragraph",
          content: [],
        },
      ],
    },
    {
      type: "byline",
      attrs: { authorName: null },
    },
    { type: "paragraph", content: [] },
  ],
}

/**
 * Factory function that builds the full extensions list for the article content type.
 * Pass to WebsiteContentEditor as `createExtensions`.
 */
export const createArticleExtensions: CreateExtensionsFn = (
  uploadHandler,
  setUploadError,
): (Extension | Node | Mark)[] => [
  ArticleDocument,
  ...createBaseExtensions(uploadHandler, setUploadError),
  ArticleBannerNode,
  ByLineInfoBarNode,
]
