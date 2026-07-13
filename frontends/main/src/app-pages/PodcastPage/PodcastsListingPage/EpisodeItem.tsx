import React from "react"
import Link from "next/link"
import { Typography, styled } from "ol-components"
import { ActionButton } from "@mitodl/smoot-design"
import { RiPlayFill, RiPauseFill } from "@remixicon/react"
import DOMPurify from "isomorphic-dompurify"
import { formatDate } from "ol-utilities"
import type { LearningResource } from "api/v1"
import { getEpisodeDurationMinutes } from "./helpers"

const EpisodeRow = styled(Link, {
  shouldForwardProp: (prop) => prop !== "isEpisodePage",
})<{ isEpisodePage?: boolean }>(({ theme, isEpisodePage }) => ({
  textDecoration: "none",
  margin: 0,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  padding: !isEpisodePage ? "24px 16px" : "24px 0px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  ...(isEpisodePage && {
    "&:first-of-type": { paddingTop: 0, boxShadow: "none" },
    // When there is only one episode (first AND last), keep only the bottom
    // shadow — the top shadow from :first-of-type should remain removed.
    "&:first-of-type:last-child": {
      boxShadow: `0 1px 0 ${theme.custom.colors.lightGray2}`,
    },
  }),
  gap: "16px",
  "&:last-child": {
    boxShadow: `0 -1px 0 ${theme.custom.colors.lightGray2}, 0 1px 0 ${theme.custom.colors.lightGray2}`,
  },
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
    cursor: "pointer",
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.red}`,
    outlineOffset: "-2px",
  },
  "&:hover .episode-title, &:focus-visible .episode-title": {
    color: theme.custom.colors.red,
  },
  "&:hover .play-button, &:focus-visible .play-button": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
    padding: "24px 16px",
  },
}))

const EpisodeInfo = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const EpisodeOverline = styled.span(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  display: "block",
  marginBottom: "8px",
  lineHeight: "16px",
}))

const EpisodeTitleLink = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  textDecoration: "none",
  display: "block",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    marginBottom: "8px",
  },
}))

const EpisodeRight = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "28px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
  },
}))

const StyledDot = styled.span(({ theme }) => ({
  display: "inline-block",
  fontSize: "14px",
  padding: "0 6px",
  fontWeight: theme.typography.fontWeightBold,
}))

const EpisodeDescription = styled(Typography)(({ theme }) => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  maxWidth: "100%",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  "& p": {
    display: "inline",
    margin: 0,
    maxWidth: "100%",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    whiteSpace: "normal",
    textWrap: "wrap",
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body1,
    lineHeight: "20px",
  },
}))

const EpisodeMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
  textAlign: "right",
}))

const PlayButton = styled(ActionButton, {
  shouldForwardProp: (prop) => prop !== "isPlaying",
})<{
  isPlaying: boolean
}>(({ theme, isPlaying }) => [
  {
    width: "48px",
    height: "48px",
    color: theme.custom.colors.darkGray2,
    backgroundColor: theme.custom.colors.white,
    borderColor: "currentColor",
    "&:hover:not(:disabled)": {
      color: theme.custom.colors.red,
    },
    [theme.breakpoints.down("sm")]: {
      width: "80px",
      height: "48px",
      backgroundColor: theme.custom.colors.white,
    },
  },
  isPlaying && {
    color: theme.custom.colors.red,
  },
])

export type EpisodeItemProps = {
  episode: LearningResource
  href: string
  role?: string
  overline?: string
  onPlayClick: (episode: LearningResource) => void
  onPauseClick?: () => void
  isPlaying: boolean
  isPlayable: boolean
  isEpisodePage?: boolean
  isMobile: boolean
}

export const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episode,
  href,
  role,
  overline,
  onPlayClick,
  onPauseClick,
  isPlaying,
  isPlayable,
  isEpisodePage = false,
  isMobile,
}) => {
  const duration = getEpisodeDurationMinutes(episode)

  const date = episode.last_modified
    ? formatDate(episode.last_modified, "MMM D")
    : null

  const metaParts = [duration ? `${duration} min` : null, date].filter(Boolean)

  return (
    <EpisodeRow href={href} role={role} isEpisodePage={isEpisodePage}>
      <EpisodeInfo>
        {!isMobile && overline && <EpisodeOverline>{overline}</EpisodeOverline>}
        <EpisodeTitleLink className="episode-title">
          {episode.title}
        </EpisodeTitleLink>
        {isMobile && episode?.description && (
          <EpisodeDescription
            className="episode-description"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(episode.description),
            }}
          />
        )}
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
        <PlayButton
          aria-label={
            isPlaying ? `Pause ${episode.title}` : `Play ${episode.title}`
          }
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isPlaying) {
              onPauseClick?.()
            } else {
              onPlayClick(episode)
            }
          }}
          isPlaying={isPlaying}
          disabled={!isPlayable}
          variant="secondary"
          className="play-button"
        >
          {isPlaying ? <RiPauseFill size={20} /> : <RiPlayFill size={20} />}
        </PlayButton>
      </EpisodeRight>
    </EpisodeRow>
  )
}

export default EpisodeItem
