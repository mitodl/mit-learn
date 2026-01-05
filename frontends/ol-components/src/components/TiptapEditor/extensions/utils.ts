import { JSONContent } from "@tiptap/react"

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  // Fallback: UUIDv4 using random numbers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function extractTextFromNode(node: JSONContent | null | undefined): string {
  if (!node) return ""

  if (node.type === "text" && node.text) {
    return node.text
  }

  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join(" ")
  }

  return ""
}

function countWords(text: string): number {
  if (!text || !text.trim()) return 0
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

export function calculateReadTime(
  content: JSONContent | null | undefined,
  wordsPerMinute: number = 250,
): number | null {
  if (!content) return null

  const text = extractTextFromNode(content)
  const wordCount = countWords(text)

  if (wordCount === 0) return null

  const readingTime = wordCount / wordsPerMinute

  return Math.round(readingTime)
}

export function extractLearningResourceIds(content: JSONContent): number[] {
  const ids = new Set<number>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (node.type === "learningResource" && node.attrs?.resourceId) {
      ids.add(node.attrs.resourceId)
    }
    node.content?.forEach(walk)
  }

  walk(content)
  return Array.from(ids)
}
