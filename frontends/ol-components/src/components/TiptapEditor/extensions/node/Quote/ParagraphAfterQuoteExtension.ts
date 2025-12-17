import { Extension } from "@tiptap/core"
import { ensureParagraphAfterQuotePlugin } from "./ensureParagraphAfterQuote"

export const EnsureParagraphAfterQuote = Extension.create({
  name: "ensureParagraphAfterQuote",

  addProseMirrorPlugins() {
    return [ensureParagraphAfterQuotePlugin()]
  },
})
