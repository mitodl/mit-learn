"use client"

import React, { useState } from "react"
import { RiShareForwardFill } from "@remixicon/react"
import type { PodcastEpisodeResource } from "api/v1"
import ShareDialog from "@/components/ShareDialog/ShareDialog"
import ShareButton from "@/components/ShareButton/ShareButton"

type PodcastShareButtonProps = {
  resource: PodcastEpisodeResource
  title: string
  sharePageUrl: string
  className?: string
}

const PodcastShareButton: React.FC<PodcastShareButtonProps> = ({
  resource,
  title,
  sharePageUrl,
  className,
}) => {
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      <ShareButton
        className={className}
        aria-label={`Share ${title}`}
        onClick={() => setShareOpen(true)}
      >
        <RiShareForwardFill size={16} />
        Share
      </ShareButton>
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
