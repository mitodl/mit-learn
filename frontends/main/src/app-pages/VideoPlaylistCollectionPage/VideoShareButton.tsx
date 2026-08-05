"use client"

import React, { useState } from "react"
import { styled } from "ol-components"
import { RiShareForwardFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import ShareDialog from "@/components/ShareDialog/ShareDialog"
import ShareButton from "@/components/ShareButton/ShareButton"
import type { VideoPlayerHandle } from "./VideoResourcePlayer"

// Both video pages sized the button identically via their own
// `styled(VideoShareButton)` wrapper; that sizing now lives here instead.
const StyledShareButton = styled(ShareButton)({
  height: "40px",
  padding: "18px 12px",
})

type VideoShareButtonProps = {
  video: VideoResource
  title: string
  pageUrl: string
  playerRef?: React.RefObject<VideoPlayerHandle | null>
  className?: string
}

const VideoShareButton: React.FC<VideoShareButtonProps> = ({
  video,
  title,
  pageUrl,
  playerRef,
  className,
}) => {
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      <StyledShareButton
        className={className}
        aria-label={`Share ${title}`}
        onClick={() => setShareOpen(true)}
      >
        <RiShareForwardFill size={16} />
        Share
      </StyledShareButton>
      <ShareDialog
        open={shareOpen}
        video={video}
        title={title}
        onClose={() => setShareOpen(false)}
        pageUrl={pageUrl}
        getCurrentTime={() => playerRef?.current?.getCurrentTime() ?? 0}
      />
    </>
  )
}

export default VideoShareButton
