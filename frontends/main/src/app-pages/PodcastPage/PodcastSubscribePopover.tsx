"use client"

import React, { useRef, useState } from "react"
import { styled, Typography } from "ol-components"
import { RiPlayCircleFill, RiRssLine } from "@remixicon/react"

// ─── Styles ───────────────────────────────────────────────────────────────────

const SubscribeButton = styled("button")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 24px",
  borderRadius: "4px",
  border: "none",
  cursor: "pointer",
  backgroundColor: theme.custom.colors.mitRed,
  color: theme.custom.colors.white,
  ...theme.typography.button,
  boxShadow:
    "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
  "&:hover": {
    backgroundColor: theme.custom.colors.darkRed,
    boxShadow: "none",
  },
  minWidth: "130px",
}))

const Popover = styled.div(({ theme }) => ({
  position: "absolute",
  top: "calc(100% + 2px)",
  left: 0,
  zIndex: theme.zIndex.modal,
  backgroundColor: theme.custom.colors.white,
  borderBottomLeftRadius: "8px",
  borderBottomRightRadius: "8px",
  padding: "12px 16px",
  boxShadow: "0px 4px 12px rgba(0,0,0,0.15), 0px 2px 4px rgba(0,0,0,0.10)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "row",
}))

const PopoverOption = styled("a")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
  textDecoration: "none",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle2,
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
  cursor: "pointer",
  flex: 1,
}))

const IconCircle = styled.div<{ bgColor: string }>(({ bgColor }) => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  backgroundColor: bgColor,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}))

const Wrapper = styled.div({
  position: "relative",
  display: "inline-block",
})

// ─── Types ────────────────────────────────────────────────────────────────────

type PodcastSubscribePopoverProps = {
  podcastUrl?: string
  rssUrl?: string
  buttonLabel?: string
  buttonIcon?: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

const PodcastSubscribePopover: React.FC<PodcastSubscribePopoverProps> = ({
  podcastUrl = "http://example.com/podcast",
  rssUrl = "http://example.com/rss",
  buttonLabel = "Subscribe to new episodes",
  buttonIcon,
}) => {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <Wrapper ref={wrapperRef}>
      <SubscribeButton onClick={() => setOpen((prev) => !prev)}>
        {buttonIcon}
        {buttonLabel}
      </SubscribeButton>

      {open && (
        <Popover role="dialog" aria-label="Subscribe options">
          <PopoverOption
            href={podcastUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{ marginRight: "32px" }}
          >
            <IconCircle bgColor="#CC0000">
              <RiPlayCircleFill size={22} color="white" />
            </IconCircle>
            <Typography variant="subtitle2">Podcasts</Typography>
          </PopoverOption>

          <PopoverOption
            href={rssUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{ marginRight: "5px" }}
          >
            <IconCircle bgColor="#F7931E">
              <RiRssLine size={22} color="white" />
            </IconCircle>
            <Typography variant="subtitle2">RSS</Typography>
          </PopoverOption>
        </Popover>
      )}
    </Wrapper>
  )
}

export default PodcastSubscribePopover
