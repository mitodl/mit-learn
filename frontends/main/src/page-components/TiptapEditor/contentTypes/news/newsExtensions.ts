import type { Extension, Node, Mark } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import { BannerNode } from "../../extensions/node/Banner/BannerNode"
import { ByLineInfoBarNode } from "../../extensions/node/ByLineInfoBar/ByLineInfoBarNode"
import { createBaseExtensions } from "../../extensions/baseExtensions"
import type { CreateExtensionsFn } from "../../core/WebsiteContentEditor"
import type { QueryClient } from "@tanstack/react-query"

export const NewsDocument = Document.extend({
  content: "banner byline block+",
})

export const newNewsDocument = {
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
 * Factory function that builds the full extensions list for the news content type.
 * Pass to WebsiteContentEditor as `createExtensions`.
 */
export const createNewsExtensions: CreateExtensionsFn = (
  uploadHandler,
  setUploadError,
  queryClient?: QueryClient | null,
): (Extension | Node | Mark)[] => [
  NewsDocument,
  ...createBaseExtensions(uploadHandler, setUploadError, queryClient),
  BannerNode,
  ByLineInfoBarNode,
]
