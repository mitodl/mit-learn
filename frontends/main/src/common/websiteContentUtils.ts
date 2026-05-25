/**
 * Recursively traverses a ProseMirror JSON content structure to find the first image.
 *
 * @param content - The ProseMirror JSON content object
 * @returns The URL of the first image found, or null if no image exists
 */
export function extractFirstImage(content: unknown): string | null {
  if (!content || typeof content !== "object") return null

  const node = content as Record<string, unknown>

  // Check if current node is an image
  if (node.type === "imageWithCaption" || node.type === "image") {
    const attrs = node.attrs as Record<string, unknown> | undefined
    const src = attrs?.src
    if (src && typeof src === "string") {
      return src
    }
  }

  // Recursively check content array
  if (Array.isArray(node.content)) {
    for (const childNode of node.content) {
      const imageUrl = extractFirstImage(childNode)
      if (imageUrl) {
        return imageUrl
      }
    }
  }

  return null
}
