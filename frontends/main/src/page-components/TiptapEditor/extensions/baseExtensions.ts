/**
 * Tier-1 base extensions: common to all website content types.
 * Constructible from only (uploadHandler, setUploadError) — no type-specific args.
 *
 * Each content type's createExtensions factory collapses to:
 *   [TypeDocument, ...createBaseExtensions(deps), TypeBannerNode, ByLineInfoBarNode]
 */
import type { Extension, Node, Mark } from "@tiptap/core"
import { Placeholder, Selection } from "@tiptap/extensions"
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Heading } from "@tiptap/extension-heading"
import { Image } from "@tiptap/extension-image"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography as TiptapTypography } from "@tiptap/extension-typography"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { HorizontalRule } from "../vendor/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { ImageNode } from "./node/Image/ImageNode"
import { ImageWithCaptionNode } from "./node/Image/ImageWithCaptionNode"
import { DividerNode } from "./node/Divider/DividerNode"
import { LearningResourceNode } from "./node/LearningResource/LearningResourceNode"
import { LearningResourceInputNode } from "./node/LearningResource/LearningResourceInputNode"
import { LearningResourceURLHandler } from "./node/LearningResource/LearningResourcePaste"
import { MediaEmbedURLHandler } from "./node/MediaEmbed/MediaEmbedURLHandler"
import { MediaEmbedNode } from "./node/MediaEmbed/MediaEmbedNode"
import { MediaEmbedInputNode } from "./node/MediaEmbed/MediaEmbedInputNode"
import type { ExtendedNodeConfig } from "./node/types"
import { MAX_FILE_SIZE } from "../vendor/lib/tiptap-utils"
import type { UploadHandler } from "../core/WebsiteContentEditor"

export const createBaseExtensions = (
  uploadHandler: UploadHandler,
  setUploadError: (error: string | null) => void,
): (Extension | Node | Mark)[] => [
  StarterKit.configure({
    document: false,
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
  ImageWithCaptionNode,
  MediaEmbedURLHandler,
  ImageNode.configure({
    accept: "image/*",
    maxSize: MAX_FILE_SIZE,
    limit: 3,
    upload: uploadHandler,
    onError: (error) => setUploadError(error.message),
  }),
]
