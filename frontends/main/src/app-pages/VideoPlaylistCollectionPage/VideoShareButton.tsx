"use client"

import React, { useRef, useState } from "react"
import { RiShareForwardFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import VideoShareDialog from "./VideoShareDialog"
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
  const shareButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Styled.ShareButton
        ref={shareButtonRef}
        className={className}
        aria-label={`Share ${title}`}
        onClick={() => setShareOpen(true)}
      >
        <RiShareForwardFill size={16} />
        Share
      </Styled.ShareButton>
      <VideoShareDialog
        open={shareOpen}
        video={video}
        title={title}
        anchorEl={shareButtonRef.current}
        onClose={() => setShareOpen(false)}
        pageUrl={pageUrl}
      />
    </>
  )
}

export default VideoShareButton
