"use client"

import React, { useState } from "react"
import { RiShareForwardFill } from "@remixicon/react"
import type { PodcastEpisodeResource } from "api/v1"
import ShareDialog from "../VideoPlaylistCollectionPage/ShareDialog"
import * as Styled from "../VideoPlaylistCollectionPage/VideoSeriesDetailPage.styled"

type VideoShareButtonProps = {
  resource: PodcastEpisodeResource
  title: string
  sharePageUrl: string
  className?: string
}

const PodcastShareButton: React.FC<VideoShareButtonProps> = ({
  resource,
  title,
  sharePageUrl,
  className,
}) => {
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      <Styled.ShareButton
        className={className}
        aria-label={`Share ${title}`}
        onClick={() => setShareOpen(true)}
      >
        <RiShareForwardFill size={16} />
        Share
      </Styled.ShareButton>
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        resource={resource as PodcastEpisodeResource}
        pageUrl={sharePageUrl}
        title={title ?? ""}
      />
    </>
  )
}

export default PodcastShareButton
