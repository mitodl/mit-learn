import React from "react"
import { LoadingSpinner, styled } from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"
import PodcastEmbedPlayer from "@/app-pages/PodcastPage/PodcastEmbedPlayer"

const LoadingShell = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "88px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
}))

interface PodcastEpisodeEmbedViewerNode {
  attrs: {
    episodeId?: number | null
  }
}

export const PodcastEpisodeEmbedViewer = ({
  node,
}: {
  node?: PodcastEpisodeEmbedViewerNode
}) => {
  const episodeId = node?.attrs?.episodeId ?? null
  const { data: resource, isLoading } = useLearningResourcesDetail(episodeId!)

  if (!episodeId) return null

  if (isLoading || !resource) {
    return (
      <LoadingShell>
        <LoadingSpinner loading size={32} />
      </LoadingShell>
    )
  }

  return (
    <div data-style-boundary>
      <PodcastEmbedPlayer resource={resource} inline />
    </div>
  )
}
