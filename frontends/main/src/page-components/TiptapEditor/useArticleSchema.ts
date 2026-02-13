"use client"

import { useMemo } from "react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { getSchema } from "@tiptap/core"
import { useSchema } from "./useSchema"
import Document from "@tiptap/extension-document"
import { Placeholder, Selection } from "@tiptap/extensions"
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Heading } from "@tiptap/extension-heading"
import { Image } from "@tiptap/extension-image"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography as TiptapTypography } from "@tiptap/extension-typography"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import type { JSONContent } from "@tiptap/react"
import { HorizontalRule } from "./vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { ImageNode } from "./extensions/node/Image/ImageNode"
import { ImageWithCaptionNode } from "./extensions/node/Image/ImageWithCaptionNode"
import { DividerNode } from "./extensions/node/Divider/DividerNode"
import { ArticleByLineInfoBarNode } from "./extensions/node/ArticleByLineInfoBar/ArticleByLineInfoBarNode"
import { LearningResourceNode } from "./extensions/node/LearningResource/LearningResourceNode"
import { LearningResourceInputNode } from "./extensions/node/LearningResource/LearningResourceInputNode"
import { LearningResourceURLHandler } from "./extensions/node/LearningResource/LearningResourcePaste"
import { MediaEmbedURLHandler } from "./extensions/node/MediaEmbed/MediaEmbedURLHandler"
import { MediaEmbedNode } from "./extensions/node/MediaEmbed/MediaEmbedNode"
import { MediaEmbedInputNode } from "./extensions/node/MediaEmbed/MediaEmbedInputNode"
import { BannerNode } from "./extensions/node/Banner/BannerNode"
import type { ExtendedNodeConfig } from "./extensions/node/types"
import { MAX_FILE_SIZE } from "./vendor/lib/tiptap-utils"

const ArticleDocument = Document.extend({
  content: "banner byline block+",
})

interface UseArticleSchemaOptions {
  uploadHandler: (
    file: File,
    onProgress?: (e: { progress: number }) => void,
    abortSignal?: AbortSignal,
  ) => Promise<string>
  setUploadError: (error: string | null) => void
  enabled: boolean
  content: JSONContent
}

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

export const useArticleSchema = ({
  uploadHandler,
  setUploadError,
  enabled,
  content,
}: UseArticleSchemaOptions) => {
  const extensions = useMemo(
    () => [
      ArticleDocument,
      StarterKit.configure({
        document: false, // Disable default document to use our ArticleDocument
        horizontalRule: false,
        heading: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
        trailingNode: {
          node: "paragraph",
        },
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Placeholder.configure({
        showOnlyCurrent: false,
        includeChildren: true,
        placeholder: ({ node, editor }): string => {
          let parentNode: typeof node | null = null

          editor.state.doc.descendants((n: ProseMirrorNode) => {
            n.forEach((childNode: ProseMirrorNode) => {
              if (childNode === node) {
                parentNode = n
              }
            })
            if (parentNode) {
              return false
            }
            return undefined
          })

          if (parentNode) {
            const parentExtension = editor.extensionManager.extensions.find(
              (ext) => ext.name === parentNode!.type.name,
            )

            if (
              parentExtension &&
              "config" in parentExtension &&
              parentExtension.config &&
              typeof (parentExtension.config as ExtendedNodeConfig)
                .getPlaceholders === "function"
            ) {
              const placeholder = (
                parentExtension.config as ExtendedNodeConfig
              ).getPlaceholders(node)
              if (placeholder) {
                return placeholder
              }
            }
          }

          if (node.type.name === "heading") {
            return "Add a heading"
          }
          return "Add some text"
        },
      }),
      HorizontalRule,
      LearningResourceURLHandler,
      LearningResourceNode,
      LearningResourceInputNode,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TiptapTypography,
      Superscript,
      Subscript,
      Selection,
      Image,
      MediaEmbedNode,
      MediaEmbedInputNode,
      DividerNode,
      ArticleByLineInfoBarNode,
      ImageWithCaptionNode,
      MediaEmbedURLHandler,
      ImageNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: uploadHandler,
        onError: (error) => setUploadError(error.message),
      }),
      BannerNode,
    ],
    [uploadHandler, setUploadError],
  )

  const schema = useMemo(() => getSchema(extensions), [extensions])

  const schemaError = useSchema({
    schema,
    content,
    enabled,
  })

  return {
    extensions,
    schema,
    schemaError,
  }
}
