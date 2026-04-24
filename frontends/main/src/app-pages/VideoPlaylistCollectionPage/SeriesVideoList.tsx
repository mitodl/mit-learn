"use client"

import React from "react"
import Link from "next/link"
import { Typography, styled } from "ol-components"
import { RiPlayFill, RiArrowRightSLine } from "@remixicon/react"
import type { LearningResource } from "api/v1"
import { formatDate, formatDurationClockTime } from "ol-utilities"

const EpisodeNumber = styled.span<{ $isFirst?: boolean }>(
  ({ theme, $isFirst }) => ({
    ...theme.typography.body1,
    color: $isFirst ? theme.custom.colors.red : theme.custom.colors.darkGray2,
    flexShrink: 0,
    textAlign: "left",
    width: "16px",
    fontWeight: $isFirst
      ? theme.typography.fontWeightBold
      : theme.typography.fontWeightRegular,
    lineHeight: "20px",
    [theme.breakpoints.down("sm")]: {
      width: "40px",
      height: "auto",
      textAlign: "center",
      display: "block",
      alignSelf: "center",
    },
  }),
)

const EpisodeDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  marginTop: "4px",
  maxWidth: "460px",
  display: "-webkit-box",
  lineHeight: "22px",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    marginTop: 0,
  },
}))

const EpisodeRowLink = styled(Link)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "24px 0 24px 16px",
  gap: "30px",
  color: "inherit",
  textDecoration: "none",
  flex: 1,
  "&:hover .episode-title, &:focus-visible .episode-title": {
    color: theme.custom.colors.red,
  },
  "&:hover .play-button, &:focus-visible .play-button": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "8px",
    padding: "24px 0px",
  },
}))

const EpisodeRow = styled.li(({ theme }) => ({
  margin: 0,
  display: "flex",
  flexDirection: "row",
  "&:last-child": {
    boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}, 0 1px 0 ${theme.custom.colors.lightGray2}`,
  },
  "&:has(a:hover), &:has(a:focus-visible)": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
}))

const ContentBlock = styled.div(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "30px",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
  },
}))

const EpisodeInfo = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const ChevronIcon = styled.span(({ theme }) => ({
  display: "none",
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    alignItems: "center",
    color: theme.custom.colors.darkGray1,
    marginTop: "-4px",
  },
}))

const EpisodeTitleLink = styled.span<{ $isFirst?: boolean }>(
  ({ theme, $isFirst }) => ({
    ...theme.typography.subtitle1,
    color: theme.custom.colors.darkGray2,
    textDecoration: "none",
    display: "block",
    marginBottom: "8px",
    fontSize: $isFirst ? "34px" : "18px",
    fontStyle: "normal",
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: $isFirst ? "40px" : "26px",

    [theme.breakpoints.down("sm")]: {
      fontSize: $isFirst ? "28px" : "20px",
      lineHeight: $isFirst ? "36px" : "26px",
    },
  }),
)

const EpisodeRight = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "24px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    marginTop: 0,
    gap: "0",
  },
}))

const StyledDot = styled.span(({ theme }) => ({
  display: "inline-block",
  fontSize: "14px",
  padding: "0 6px",
  fontWeight: theme.typography.fontWeightBold,
}))

const EpisodeMeta = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  lineHeight: "22px",
  whiteSpace: "nowrap",
  textAlign: "left",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    lineHeight: "16px",
  },
}))

const PlayButton = styled("div")<{
  isPlaying: boolean
}>(({ theme, isPlaying }) => [
  {
    color: theme.custom.colors.silverGrayLight,
    width: "48px",
    height: "48px",
    border: `1px solid ${theme.custom.colors.silverGrayLight}`,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "color 0.2s ease, border-color 0.2s ease",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  isPlaying && {
    color: theme.custom.colors.red,
    borderColor: theme.custom.colors.red,
  },
])

/* ── Episode row component ── */

type EpisodeItemProps = {
  episode: LearningResource
  href: string
  isPlaying?: boolean
  index?: number
}

export const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  href,
  isPlaying,
  index,
}) => {
  const videoResource = episode.resource_type === "video" ? episode : null

  const duration = videoResource?.video?.duration
    ? formatDurationClockTime(videoResource.video.duration)
    : null

  const date = episode.last_modified
    ? formatDate(episode.last_modified, "MMM D")
    : null

  const metaParts = [duration, date].filter(Boolean)

  return (
    <EpisodeRow>
      <EpisodeRowLink href={href}>
        {index !== undefined && (
          <EpisodeNumber $isFirst={index === 1}>{index}</EpisodeNumber>
        )}
        <ContentBlock>
          <EpisodeInfo>
            <EpisodeTitleLink className="episode-title" $isFirst={index === 1}>
              {episode.title}
            </EpisodeTitleLink>

            <EpisodeDescription variant="body2">
              {episode.description}
            </EpisodeDescription>
          </EpisodeInfo>

          <EpisodeRight>
            {metaParts.length > 0 && (
              <EpisodeMeta variant="body3">
                {metaParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <StyledDot>&middot;</StyledDot>}
                    {part}
                  </React.Fragment>
                ))}
              </EpisodeMeta>
            )}
            <PlayButton isPlaying={isPlaying ?? false} className="play-button">
              <RiPlayFill size={20} />
            </PlayButton>
            <ChevronIcon>
              <RiArrowRightSLine size={20} />
            </ChevronIcon>
          </EpisodeRight>
        </ContentBlock>
      </EpisodeRowLink>
    </EpisodeRow>
  )
}
