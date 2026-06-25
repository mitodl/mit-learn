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

const ErrorShell = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "88px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
}))

interface PodcastEpisodeEmbedViewerNode {
  attrs: {
    episodeId?: number | null
  }
}

const PodcastEpisodeEmbedViewerInner = ({
  episodeId,
}: {
  episodeId: number
}) => {
  const {
    data: resource,
    isLoading,
    isError,
  } = useLearningResourcesDetail(episodeId)

  if (isLoading) {
    return (
      <LoadingShell>
        <LoadingSpinner loading size={32} />
      </LoadingShell>
    )
  }

  if (isError || resource?.resource_type !== "podcast_episode") {
    return <ErrorShell>Unable to load podcast episode.</ErrorShell>
  }

  return (
    <div data-style-boundary>
      <PodcastEmbedPlayer resource={resource} inline />
    </div>
  )
}

export const PodcastEpisodeEmbedViewer = ({
  node,
}: {
  node?: PodcastEpisodeEmbedViewerNode
}) => {
  const episodeId = node?.attrs?.episodeId ?? null
  if (!episodeId) return null
  return <PodcastEpisodeEmbedViewerInner episodeId={episodeId} />
}
