"use client"

import React, { useState } from "react"
import { Popover, styled, theme } from "ol-components"
import Link from "next/link"
import { env } from "@/env"
import {
  FACEBOOK_SHARE_BASE_URL,
  TWITTER_SHARE_BASE_URL,
  LINKEDIN_SHARE_BASE_URL,
} from "@/common/urls"
import {
  RiFacebookFill,
  RiTwitterXLine,
  RiLinkedinFill,
  RiLink,
  RiShareForwardFill,
  RiCodeSSlashLine,
  RiCloseLine,
} from "@remixicon/react"
import { Button, Input } from "@mitodl/smoot-design"
import type { VideoResource } from "api/v1"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

type Tab = "share" | "embed"

// ─── Layout ────────────────────────────────────────────────────────────────

const StyledPopover = styled(Popover)({
  width: "648px",
  maxWidth: "calc(100vw - 48px)",
  ".MuiPopper-arrow": {
    display: "none",
  },
})

const DialogInner = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  padding: "16px",
})

// ─── Header ────────────────────────────────────────────────────────────────

const Header = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
})

const TabGroup = styled.div({
  display: "flex",
  gap: "10px",
})

const TabButton = styled.button<{ active: boolean }>(({ active }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 24px 12px 16px",
  borderRadius: "24px",
  border: "none",
  cursor: "pointer",
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "14px",
  backgroundColor: active
    ? theme.custom.colors.red
    : theme.custom.colors.lightGray2,
  color: active ? theme.custom.colors.white : theme.custom.colors.darkGray1,
  boxShadow:
    "0 2px 4px 0 rgba(37, 38, 43, 0.10), 0 3px 8px 0 rgba(37, 38, 43, 0.12)",
  transition: "background-color 0.15s, color 0.15s",
  "&:hover": {
    backgroundColor: active
      ? theme.custom.colors.darkRed
      : theme.custom.colors.lightGray2,
  },
}))

const CloseButton = styled.button({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: theme.custom.colors.darkGray1,
  padding: "4px",
  borderRadius: "4px",
  "&:hover": {
    color: theme.custom.colors.black,
  },
})

// ─── Share tab ─────────────────────────────────────────────────────────────

const ShareContents = styled.div(({ theme }) => ({
  display: "flex",
  gap: "40px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "32px",
  },
}))

const SocialContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const LinkContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  flex: 1,
})

const SectionHeading = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  fontWeight: theme.typography.fontWeightBold,
}))

const SocialButtonRow = styled.div({
  display: "flex",
  gap: "16px",
  a: { height: "18px" },
})

const ShareLink = styled(Link)({
  color: theme.custom.colors.silverGrayDark,
  "&:hover": { color: theme.custom.colors.lightRed },
})

const LinkControls = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  input: {
    ...theme.typography.body3,
    color: theme.custom.colors.darkGray2,
    padding: "0 3px",
  },
}))

const RedLinkIcon = styled(RiLink)({
  color: theme.custom.colors.red,
})

const CopyButton = styled(Button)({
  minWidth: "104px",
})

// ─── Embed tab ─────────────────────────────────────────────────────────────

const EmbedContents = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const Field = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const EmbedTextarea = styled.textarea(({ theme }) => ({
  width: "100%",
  minHeight: "100px",
  resize: "vertical",
  borderRadius: "4px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  padding: "8px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  fontFamily: "monospace",
  boxSizing: "border-box",
}))

const EmbedFooter = styled.div({
  display: "flex",
  justifyContent: "end",
  alignItems: "center",
})

// ─── Helpers ───────────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<void> {
  await navigator?.clipboard?.writeText(text)
}

function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
}

function buildEmbedHtml(
  video: VideoResource,
  title: string,
  embedPageUrl: string,
): string {
  const isOvs = video.platform?.code === "ovs" || video.platform?.code === "ocw"
  const escapedTitle = escapeHtmlAttr(title)
  if (isOvs) {
    if (!embedPageUrl) return ""
    return `<iframe width="560" height="315" src="${embedPageUrl}" title="${escapedTitle}" frameborder="0" allowfullscreen></iframe>`
  }

  const youtubeId = getYouTubeVideoId(video.url)
  if (!youtubeId) return ""
  return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}" title="${escapedTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
}

// ─── Component ─────────────────────────────────────────────────────────────

type VideoShareDialogProps = {
  open: boolean
  onClose: () => void
  anchorEl: HTMLElement | null
  video: VideoResource
  pageUrl: string
  title: string
}

const VideoShareDialog = ({
  open,
  onClose,
  anchorEl,
  video,
  pageUrl,
  title,
}: VideoShareDialogProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("share")
  const [copyLinkText, setCopyLinkText] = useState("Copy Link")
  const [copyEmbedText, setCopyEmbedText] = useState("Copy")

  const embedPageUrl = `${NEXT_PUBLIC_ORIGIN}/video/embed/${video.id}`
  const embedHtml = buildEmbedHtml(video, title, embedPageUrl)

  return (
    <StyledPopover open={open} onClose={onClose} anchorEl={anchorEl}>
      <DialogInner>
        <Header>
          <TabGroup role="tablist">
            <TabButton
              role="tab"
              aria-selected={activeTab === "share"}
              active={activeTab === "share"}
              onClick={() => setActiveTab("share")}
            >
              <RiShareForwardFill size={16} />
              Share
            </TabButton>
            <TabButton
              role="tab"
              aria-selected={activeTab === "embed"}
              active={activeTab === "embed"}
              onClick={() => setActiveTab("embed")}
            >
              <RiCodeSSlashLine size={16} />
              Embed
            </TabButton>
          </TabGroup>
          <CloseButton onClick={onClose} aria-label="Close dialog">
            <RiCloseLine size={20} />
          </CloseButton>
        </Header>

        <div
          role="tabpanel"
          aria-label={activeTab === "share" ? "Share" : "Embed"}
        >
          {activeTab === "share" ? (
            <ShareContents>
              <SocialContainer>
                <SectionHeading>Share on Social</SectionHeading>
                <SocialButtonRow>
                  <ShareLink
                    href={`${FACEBOOK_SHARE_BASE_URL}?u=${encodeURIComponent(pageUrl)}`}
                    aria-label="Share on Facebook"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RiFacebookFill size={18} />
                  </ShareLink>
                  <ShareLink
                    href={`${TWITTER_SHARE_BASE_URL}?text=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`}
                    aria-label="Share on X (Twitter)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RiTwitterXLine size={18} />
                  </ShareLink>
                  <ShareLink
                    href={`${LINKEDIN_SHARE_BASE_URL}?url=${encodeURIComponent(pageUrl)}`}
                    aria-label="Share on LinkedIn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RiLinkedinFill size={18} />
                  </ShareLink>
                </SocialButtonRow>
              </SocialContainer>
              <LinkContainer>
                <SectionHeading>Share a link</SectionHeading>
                <LinkControls>
                  <Input
                    fullWidth
                    value={pageUrl}
                    size="small"
                    onClick={(event) => {
                      const input = event.currentTarget.querySelector("input")
                      if (!input) return
                      input.select()
                    }}
                  />
                  <CopyButton
                    size="small"
                    edge="circular"
                    variant="bordered"
                    startIcon={<RedLinkIcon />}
                    onClick={async () => {
                      if (!pageUrl) return
                      try {
                        await copyToClipboard(pageUrl)
                        setCopyLinkText("Copied!")
                        setTimeout(() => setCopyLinkText("Copy Link"), 2000)
                      } catch {
                        setCopyLinkText("Failed to copy")
                        setTimeout(() => setCopyLinkText("Copy Link"), 2000)
                      }
                    }}
                  >
                    {copyLinkText}
                  </CopyButton>
                </LinkControls>
              </LinkContainer>
            </ShareContents>
          ) : (
            <EmbedContents>
              <Field>
                <SectionHeading>Video URL</SectionHeading>
                <Input
                  fullWidth
                  value={embedPageUrl}
                  size="small"
                  inputProps={{ "aria-label": "Video URL" }}
                  onClick={(event) => {
                    const input = event.currentTarget.querySelector("input")
                    if (!input) return
                    input.select()
                  }}
                />
              </Field>
              <Field>
                <SectionHeading>Embed HTML</SectionHeading>
                <EmbedTextarea
                  aria-label="Embed HTML"
                  readOnly
                  value={embedHtml}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </Field>
              <EmbedFooter>
                <CopyButton
                  size="small"
                  edge="circular"
                  variant="bordered"
                  startIcon={<RedLinkIcon />}
                  onClick={async () => {
                    if (!embedHtml) return
                    try {
                      await copyToClipboard(embedHtml)
                      setCopyEmbedText("Copied!")
                      setTimeout(() => setCopyEmbedText("Copy"), 2000)
                    } catch {
                      setCopyEmbedText("Failed to copy")
                      setTimeout(() => setCopyEmbedText("Copy"), 2000)
                    }
                  }}
                >
                  {copyEmbedText}
                </CopyButton>
              </EmbedFooter>
            </EmbedContents>
          )}
        </div>
      </DialogInner>
    </StyledPopover>
  )
}

export default VideoShareDialog
