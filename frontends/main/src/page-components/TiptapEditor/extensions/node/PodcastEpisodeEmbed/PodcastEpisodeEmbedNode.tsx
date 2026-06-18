"use client"

import React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import { styled, LoadingSpinner } from "ol-components"
import { ActionButton } from "@mitodl/smoot-design"
import { RiCloseLargeLine } from "@remixicon/react"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import PodcastEmbedPlayer from "@/app-pages/PodcastPage/PodcastEmbedPlayer"

// ─── Styled components ─────────────────────────────────────────────────────────

const StyledNodeViewWrapper = styled(NodeViewWrapper)(({ theme }) => ({
  position: "relative",
  margin: "16px 0",
  ".ProseMirror-selectednode &": {
    outline: `2px solid ${theme.custom.colors.red}`,
    borderRadius: "8px",
  },
}))

const RemoveButton = styled(ActionButton)({
  position: "absolute",
  top: "-7px",
  right: "-7px",
  zIndex: 2,
  display: "none",
  ".node-podcastEpisodeEmbed:hover &": {
    display: "flex",
  },
})

const LoadingShell = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "88px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
}))

// ─── Node view ─────────────────────────────────────────────────────────────────

const PodcastEpisodeEmbedNodeViewComponent = ({
  node,
  editor,
  getPos,
}: ReactNodeViewProps) => {
  const { episodeId, editable } = node.attrs
  const { data: resource, isLoading } = useLearningResourcesDetail(episodeId)

  const handleRemove = () => {
    const pos = getPos()
    if (typeof pos !== "number") return
    editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
  }

  const selectNode = () => {
    if (!editable) return
    const pos = getPos()
    if (typeof pos !== "number") return
    editor.chain().focus().setNodeSelection(pos).run()
  }

  return (
    <StyledNodeViewWrapper onMouseDown={selectNode}>
      {editable && (
        <RemoveButton
          variant="primary"
          edge="circular"
          size="small"
          onClick={handleRemove}
          aria-label="Remove podcast embed"
        >
          <RiCloseLargeLine />
        </RemoveButton>
      )}
      {isLoading || !resource ? (
        <LoadingShell>
          <LoadingSpinner loading size={32} />
        </LoadingShell>
      ) : (
        <div data-style-boundary>
          <PodcastEmbedPlayer resource={resource} inline />
        </div>
      )}
    </StyledNodeViewWrapper>
  )
}

// ─── Node definition ───────────────────────────────────────────────────────────

export const PodcastEpisodeEmbedNode = Node.create({
  name: "podcastEpisodeEmbed",

  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      episodeId: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute("data-episode-id")
          return val ? Number(val) : null
        },
        renderHTML: (attrs) =>
          attrs.episodeId ? { "data-episode-id": String(attrs.episodeId) } : {},
      },
      src: { default: null },
      editable: { default: true, renderHTML: false },
    }
  },

  parseHTML() {
    return [{ tag: "podcast-episode-embed[data-episode-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    const { editable: _editable, ...rest } = HTMLAttributes
    return ["podcast-episode-embed", mergeAttributes(rest)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PodcastEpisodeEmbedNodeViewComponent)
  },
})
