import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

// Extract the title from the banner node's content
export const getTitle = (node: ProseMirrorNode) => {
  if (!node || !node?.content) return "Article"
  // The banner contains heading and paragraph
  // Find the heading node and get its text content
  const headingNode = node.content.content.find(
    (child) => child.type.name === "heading",
  )

  if (headingNode) {
    const fullTitle = headingNode.textContent || "Article"
    const words = fullTitle.trim().split(/\s+/)

    if (words.length > 5) {
      return `${words.slice(0, 5).join(" ")}...`
    }

    return fullTitle
  }

  return "Article"
}
