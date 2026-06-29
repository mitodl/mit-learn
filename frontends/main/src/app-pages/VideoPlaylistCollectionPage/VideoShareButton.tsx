"use client"

import React, { useState } from "react"
import { RiShareForwardFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import ShareDialog from "./ShareDialog"
import * as Styled from "./VideoSeriesDetailPage.styled"

type VideoShareButtonProps = {
  video: VideoResource
  title: string
  pageUrl: string
  className?: string
}

const VideoShareButton: React.FC<VideoShareButtonProps> = ({
  video,
  title,
  pageUrl,
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
        video={video}
        title={title}
        onClose={() => setShareOpen(false)}
        pageUrl={pageUrl}
      />
    </>
  )
}

export default VideoShareButton
