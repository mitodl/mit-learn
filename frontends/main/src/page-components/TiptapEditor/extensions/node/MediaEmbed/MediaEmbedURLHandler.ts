import { Extension } from "@tiptap/core"
import { Plugin, NodeSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import type { QueryClient } from "@tanstack/react-query"

import { convertToEmbedUrl } from "@/common/utils"
import { requiredEnv } from "@/env"
import { learningResourceQueries } from "api/hooks/learningResources"
import { createURLToNodeHandler } from "../shared/createURLToNodeHandler"

function extractMediaEmbedUrl(text: string): string | null {
  try {
    // convertToEmbedUrl now handles all validation and returns null for unsupported URLs
    return convertToEmbedUrl(text.trim())
  } catch {
    return null
  }
}

/**
 * Matches video embed URLs on this app's own origin (NEXT_PUBLIC_ORIGIN), e.g.
 *   https://learn.mit.edu/video/embed/123
 * A trailing slash is allowed. Returns the numeric video ID, or null if not
 * matched.
 */
function extractMITLearnVideoId(url: string): number | null {
  try {
    const parsed = new URL(url.trim())
    const appHostname = new URL(
      requiredEnv("NEXT_PUBLIC_ORIGIN"),
    ).hostname.replace(/^www\./, "")
    if (parsed.hostname.replace(/^www\./, "") !== appHostname) {
      return null
    }
    const match = parsed.pathname.match(/^\/video\/embed\/(\d+)\/?$/)
    if (!match) return null
    return Number(match[1])
  } catch {
    return null
  }
}

/**
 * Creates a ProseMirror keydown handler that asynchronously resolves MIT Learn
 * video embed URLs by fetching the resource detail from the API, then replaces
 * the typed text with a mediaEmbed node.
 */
function createMITLearnHandler(queryClient: QueryClient) {
  return (view: EditorView, event: KeyboardEvent): boolean => {
    if (event.key !== "Enter") return false

    const { state } = view
    const { $from } = state.selection
    const parent = $from.parent

    if (parent.type.name !== "paragraph") return false

    const text = parent.textContent.trim()
    const videoId = extractMITLearnVideoId(text)
    if (!videoId) return false

    event.preventDefault()

    queryClient
      .fetchQuery(learningResourceQueries.detail(videoId))
      .then((resource) => {
        if (resource.resource_type !== "video") return

        // Re-read the current editor state when the promise resolves so that
        // any edits that happened during the fetch are respected.
        const currentState = view.state
        let foundStart: number | null = null
        let foundEnd: number | null = null

        currentState.doc.descendants((node, pos) => {
          if (foundStart !== null) return false
          if (node.type.name !== "paragraph") return true
          if (node.textContent.trim() !== text) return true

          // Check if the paragraph is inside a mediaEmbedInput node
          const $pos = currentState.doc.resolve(pos + 1)
          const grandParent = $pos.node($pos.depth - 1)
          if (grandParent?.type.name === "mediaEmbedInput") {
            foundStart = $pos.before($pos.depth - 1)
            foundEnd = foundStart + grandParent.nodeSize
          } else {
            foundStart = pos
            foundEnd = pos + node.nodeSize
          }
          return false
        })

        if (foundStart === null || foundEnd === null) return

        const embedNode = currentState.schema.nodes["mediaEmbed"].create({
          mitLearnVideoId: videoId,
          src: text,
        })
        const tr = currentState.tr.replaceWith(foundStart, foundEnd, embedNode)
        tr.setSelection(NodeSelection.create(tr.doc, foundStart))
        view.dispatch(tr)
      })
      .catch(() => {
        // Silently fail — the typed URL text remains in the editor.
      })

    return true
  }
}

interface MediaEmbedURLHandlerOptions {
  queryClient: QueryClient | null
}

export const MediaEmbedURLHandler =
  Extension.create<MediaEmbedURLHandlerOptions>({
    name: "mediaEmbedURLHandler",

    addOptions() {
      return {
        queryClient: null,
      }
    },

    addProseMirrorPlugins() {
      const plugins = [
        new Plugin({
          props: {
            handleKeyDown: createURLToNodeHandler({
              inputNodeName: "mediaEmbedInput",
              outputNodeName: "mediaEmbed",
              extractValue: extractMediaEmbedUrl,
              createNodeAttrs: (src) => ({ src }),
            }),
          },
        }),
      ]

      const { queryClient } = this.options
      if (queryClient) {
        plugins.push(
          new Plugin({
            props: {
              handleKeyDown: createMITLearnHandler(queryClient),
            },
          }),
        )
      }

      return plugins
    },
  })
