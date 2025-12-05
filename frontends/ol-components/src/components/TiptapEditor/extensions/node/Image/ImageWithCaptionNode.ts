import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ImageWithCaption } from "./ImageWithCaption"

export const ImageWithCaptionNode = Node.create({
  name: "imageWithCaption",

  group: "block",
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      editable: { default: true },
      caption: { default: "" },
      layout: { default: "default" }, // default | wide | full
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image-with-caption"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "image-with-caption" }),
      ["img", { src: HTMLAttributes.src }],
      ["figcaption", {}, HTMLAttributes.caption || ""],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageWithCaption)
  },
})
