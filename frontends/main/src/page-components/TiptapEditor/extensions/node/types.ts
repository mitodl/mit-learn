import { Node } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

export type ExtendedNodeConfig = Parameters<typeof Node.create>[0] & {
  getPlaceholders: (childNode: ProseMirrorNode) => string | null
}
