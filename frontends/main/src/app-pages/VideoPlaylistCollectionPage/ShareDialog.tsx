"use client"

import React, { useEffect, useRef, useState } from "react"
import { Dialog, styled, theme } from "ol-components"
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
} from "@remixicon/react"
import { Button, Input } from "@mitodl/smoot-design"
import type { VideoResource, PodcastEpisodeResource } from "api/v1"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

type Tab = "share" | "embed"

// ─── Layout ────────────────────────────────────────────────────────────────

const DialogInner = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
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
  transition: "background-color 0.15s, color 0.15s",
  "&:hover": {
    backgroundColor: active
      ? theme.custom.colors.darkRed
      : theme.custom.colors.lightGray2,
  },
}))

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

const StartAtRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  "input[type='checkbox']": {
    width: "16px",
    height: "16px",
    cursor: "pointer",
    accentColor: theme.custom.colors.red,
  },
  label: {
    cursor: "pointer",
    userSelect: "none",
  },
}))

// ─── Helpers ───────────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<void> {
  if (!navigator?.clipboard) throw new Error("Clipboard API unavailable")
  await navigator.clipboard.writeText(text)
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

function formatTimestamp(totalSeconds: number): string {
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

function withTimeParam(url: string, seconds: number, param = "t"): string {
  try {
    const u = new URL(url)
    u.searchParams.set(param, String(Math.floor(seconds)))
    return u.toString()
  } catch {
    return url
  }
}

function buildVideoEmbedHtml(
  video: VideoResource,
  title: string,
  embedPageUrl: string,
  startTime = 0,
): string {
  const isOvs = video.platform?.code === "ovs" || video.platform?.code === "ocw"
  const escapedTitle = escapeHtmlAttr(title)
  const t = Math.floor(startTime)
  if (isOvs) {
    if (!embedPageUrl) return ""
    const src = t > 0 ? withTimeParam(embedPageUrl, t) : embedPageUrl
    return `<iframe width="560" height="315" src="${src}" title="${escapedTitle}" frameborder="0" allowfullscreen></iframe>`
  }

  const youtubeId = getYouTubeVideoId(video.url)
  if (!youtubeId) return ""
  const ytBase = `https://www.youtube.com/embed/${youtubeId}`
  const src = t > 0 ? withTimeParam(ytBase, t, "start") : ytBase
  return `<iframe width="560" height="315" src="${src}" title="${escapedTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
}

function buildPodcastEmbedHtml(
  resource: PodcastEpisodeResource,
  title: string,
  _embedPageUrl: string,
): string {
  const episode = resource.podcast_episode
  if (!episode?.audio_url) return ""
  const escapedTitle = escapeHtmlAttr(title)
  const escapedAudioUrl = escapeHtmlAttr(episode.audio_url)
  return `<audio controls title="${escapedTitle}"><source src="${escapedAudioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio>`
}

// ─── Component ─────────────────────────────────────────────────────────────

type ShareDialogProps = {
  open: boolean
  onClose: () => void
  video?: VideoResource
  resource?: PodcastEpisodeResource
  pageUrl: string
  title: string
  getCurrentTime?: () => number
}

const ShareDialog = ({
  open,
  onClose,
  video,
  resource,
  pageUrl,
  title,

  getCurrentTime,
}: ShareDialogProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("share")
  const [copyLinkText, setCopyLinkText] = useState("Copy Link")
  const [copyEmbedText, setCopyEmbedText] = useState("Copy")
  const [startTime, setStartTime] = useState(0)
  const [includeTime, setIncludeTime] = useState(false)

  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const t = getCurrentTime?.() ?? 0
      setStartTime(t)
      setIncludeTime(t > 0)
    }
    wasOpenRef.current = open
  }, [open, getCurrentTime])

  const copyLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyEmbedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (copyLinkTimerRef.current) clearTimeout(copyLinkTimerRef.current)
      if (copyEmbedTimerRef.current) clearTimeout(copyEmbedTimerRef.current)
    },
    [],
  )

  const shareTabRef = useRef<HTMLButtonElement | null>(null)
  const embedTabRef = useRef<HTMLButtonElement | null>(null)
  const tabRefs: Record<Tab, React.RefObject<HTMLButtonElement | null>> = {
    share: shareTabRef,
    embed: embedTabRef,
  }
  const TABS: Tab[] = ["share", "embed"]

  const handleTabKeyDown =
    (tab: Tab) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const idx = TABS.indexOf(tab)
      let next: Tab | null = null
      if (e.key === "ArrowRight") next = TABS[(idx + 1) % TABS.length]
      else if (e.key === "ArrowLeft")
        next = TABS[(idx - 1 + TABS.length) % TABS.length]
      if (next) {
        e.preventDefault()
        setActiveTab(next)
        tabRefs[next].current?.focus()
      }
    }

  const hasEmbed = video !== undefined || resource !== undefined

  const videoEmbedPageUrl = video
    ? `${NEXT_PUBLIC_ORIGIN}/video/embed/${video.id}`
    : ""
  const embedUrl = video
    ? videoEmbedPageUrl
    : resource
      ? `${NEXT_PUBLIC_ORIGIN}/podcast/embed/${resource.id}`
      : null

  const t = includeTime && startTime > 0 ? Math.floor(startTime) : 0

  const activeShareUrl = t > 0 ? withTimeParam(pageUrl, t) : pageUrl
  const activeEmbedUrl =
    embedUrl && t > 0 ? withTimeParam(embedUrl, t) : embedUrl

  const embedHtml = video
    ? buildVideoEmbedHtml(video, title, videoEmbedPageUrl, t)
    : resource
      ? buildPodcastEmbedHtml(resource, title, embedUrl || "")
      : ""

  const embedUrlLabel = video ? "Video URL" : "Audio URL"

  const startAtLabel =
    video && startTime > 0 ? `Start at ${formatTimestamp(startTime)}` : null
  console.log("startAtLabel", activeTab, startAtLabel, startTime, includeTime)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      cancelText={null}
      confirmText={null}
      fullWidth
      maxWidth="sm"
    >
      <DialogInner>
        {hasEmbed && (
          <TabGroup role="tablist">
            <TabButton
              ref={tabRefs.share}
              id="tab-share"
              role="tab"
              aria-selected={activeTab === "share"}
              aria-controls="tabpanel-share"
              active={activeTab === "share"}
              tabIndex={activeTab === "share" ? 0 : -1}
              onClick={() => setActiveTab("share")}
              onKeyDown={handleTabKeyDown("share")}
            >
              <RiShareForwardFill size={16} />
              Share
            </TabButton>
            <TabButton
              ref={tabRefs.embed}
              id="tab-embed"
              role="tab"
              aria-selected={activeTab === "embed"}
              aria-controls="tabpanel-embed"
              active={activeTab === "embed"}
              tabIndex={activeTab === "embed" ? 0 : -1}
              onClick={() => setActiveTab("embed")}
              onKeyDown={handleTabKeyDown("embed")}
            >
              <RiCodeSSlashLine size={16} />
              Embed
            </TabButton>
          </TabGroup>
        )}

        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === "share" || !hasEmbed ? (
            <ShareContents>
              <SocialContainer>
                <SectionHeading>Share on Social</SectionHeading>
                <SocialButtonRow>
                  <ShareLink
                    href={`${FACEBOOK_SHARE_BASE_URL}?u=${encodeURIComponent(activeShareUrl)}`}
                    aria-label="Share on Facebook"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RiFacebookFill size={18} />
                  </ShareLink>
                  <ShareLink
                    href={`${TWITTER_SHARE_BASE_URL}?text=${encodeURIComponent(title)}&url=${encodeURIComponent(activeShareUrl)}`}
                    aria-label="Share on X (Twitter)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RiTwitterXLine size={18} />
                  </ShareLink>
                  <ShareLink
                    href={`${LINKEDIN_SHARE_BASE_URL}?url=${encodeURIComponent(activeShareUrl)}`}
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
                    value={activeShareUrl}
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
                      if (!activeShareUrl) return
                      try {
                        await copyToClipboard(activeShareUrl)
                        setCopyLinkText("Copied!")
                      } catch {
                        setCopyLinkText("Failed to copy")
                      }
                      if (copyLinkTimerRef.current)
                        clearTimeout(copyLinkTimerRef.current)
                      copyLinkTimerRef.current = setTimeout(
                        () => setCopyLinkText("Copy Link"),
                        2000,
                      )
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
                <SectionHeading>{embedUrlLabel}</SectionHeading>
                <Input
                  fullWidth
                  value={activeEmbedUrl}
                  size="small"
                  inputProps={{ "aria-label": embedUrlLabel }}
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
                {startAtLabel && (
                  <StartAtRow style={{ flex: 1 }}>
                    <input
                      type="checkbox"
                      id="start-at-embed"
                      checked={includeTime}
                      onChange={(e) => setIncludeTime(e.target.checked)}
                    />
                    <label htmlFor="start-at-embed">{startAtLabel}</label>
                  </StartAtRow>
                )}
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
                    } catch {
                      setCopyEmbedText("Failed to copy")
                    }
                    if (copyEmbedTimerRef.current)
                      clearTimeout(copyEmbedTimerRef.current)
                    copyEmbedTimerRef.current = setTimeout(
                      () => setCopyEmbedText("Copy"),
                      2000,
                    )
                  }}
                >
                  {copyEmbedText}
                </CopyButton>
              </EmbedFooter>
            </EmbedContents>
          )}
        </div>
      </DialogInner>
    </Dialog>
  )
}

export default ShareDialog
export type { ShareDialogProps }
