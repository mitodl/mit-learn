import React from "react"
import { Typography, Skeleton, styled } from "ol-components"
import { RiPlayFill, RiPauseFill } from "@remixicon/react"
import DOMPurify from "isomorphic-dompurify"
import { formatDate } from "ol-utilities"
import type { LearningResource } from "api/v1"
import { Section, PlayButton } from "./styled"
import { getEpisodeAudioUrl, getEpisodeDurationMinutes } from "./helpers"

const NowPlayingHeader = styled.div({
  display: "flex",
  width: "100%",
})

const NowPlayingTitleWrap = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "flex-start",
  flexShrink: 0,
  borderTop: `2px solid ${theme.custom.colors.brightRed}`,
  paddingTop: "14px",
  paddingBottom: "22px",
}))

const NowPlayingLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  whiteSpace: "nowrap",
  lineHeight: "24px",
  [theme.breakpoints.down("sm")]: {
    lineHeight: "18px",
  },
}))

const NowPlayingCard = styled.div(({ theme }) => ({
  display: "flex",
  gap: "48px",
  padding: "40px",
  alignItems: "flex-start",
  backgroundColor: theme.custom.colors.lightGray0,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "16px",
    padding: "0px",
    backgroundColor: "transparent",
    border: "none",
  },
}))

const NowPlayingImage = styled.img(({ theme }) => ({
  width: "250px",
  height: "250px",
  objectFit: "cover",
  flexShrink: 0,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
    borderRadius: "8px",
  },
}))

const NowPlayingBody = styled.div({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const FeaturedBadge = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignSelf: "flex-start",
  padding: "8px 16px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  ...theme.typography.subtitle3,
}))

const NowPlayingTitle = styled("h2")(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  fontSize: "28px",
  lineHeight: "40px",
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const NowPlayingMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  lineHeight: "24px",
}))

const NowPlayingBottom = styled.div(({ theme }) => ({
  display: "flex",
  gap: "80px",
  alignItems: "flex-start",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "24px",
  },
}))

const NowPlayingDescription = styled(Typography)(({ theme }) => ({
  flex: 1,
  color: theme.custom.colors.darkGray2,
  display: "-webkit-box",
  lineHeight: "22px",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    WebkitLineClamp: 4,
  },
}))

const NowPlayingRight = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  width: "186px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    alignItems: "flex-start",
  },
}))

const PlayEpisodeButton = styled(PlayButton)({
  width: "100%",
  height: "48px",
})

const NowPlayingDuration = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
}))

export type NowPlayingSectionProps = {
  nowPlaying: LearningResource | undefined
  isPlaying: boolean
  onPlayClick: (episode: LearningResource) => void
  onPauseClick: () => void
  isLoading?: boolean
}

const NowPlayingHeaderRow = () => (
  <NowPlayingHeader>
    <NowPlayingTitleWrap>
      <NowPlayingLabel variant="subtitle2">NOW PLAYING</NowPlayingLabel>
    </NowPlayingTitleWrap>
  </NowPlayingHeader>
)

const NowPlayingSection: React.FC<NowPlayingSectionProps> = ({
  nowPlaying,
  isPlaying,
  onPlayClick,
  onPauseClick,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Section style={{ paddingTop: "0" }}>
        <NowPlayingHeaderRow />
        <NowPlayingCard>
          <Skeleton variant="rectangular" width={250} height={250} />
          <NowPlayingBody>
            <Skeleton variant="rectangular" width={96} height={33} />
            <Skeleton variant="text" width="80%" height={40} />
            <Skeleton variant="text" width="40%" height={24} />
            <Skeleton variant="text" width="100%" height={66} />
          </NowPlayingBody>
        </NowPlayingCard>
      </Section>
    )
  }

  if (!nowPlaying || nowPlaying.resource_type !== "podcast_episode") {
    return null
  }

  const duration = getEpisodeDurationMinutes(nowPlaying)
  const date = nowPlaying.last_modified
    ? formatDate(nowPlaying.last_modified, "MMM D")
    : null

  return (
    <Section style={{ paddingTop: "0" }}>
      <NowPlayingHeaderRow />
      <NowPlayingCard>
        {nowPlaying.image?.url && (
          <NowPlayingImage
            src={nowPlaying.image.url}
            alt={
              nowPlaying.image.alt ??
              nowPlaying.title ??
              "Podcast episode cover"
            }
          />
        )}
        <NowPlayingBody>
          <FeaturedBadge>FEATURED</FeaturedBadge>
          <NowPlayingTitle>{nowPlaying.title}</NowPlayingTitle>

          <NowPlayingMeta variant="subtitle1">
            {[nowPlaying.offered_by?.name, nowPlaying.platform?.name]
              .filter(Boolean)
              .join(" • ")}
          </NowPlayingMeta>
          <NowPlayingBottom>
            {nowPlaying.description && (
              <NowPlayingDescription
                variant="body2"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(nowPlaying.description),
                }}
              />
            )}
            <NowPlayingRight>
              <PlayEpisodeButton
                variant="primary"
                startIcon={isPlaying ? <RiPauseFill /> : <RiPlayFill />}
                disabled={!getEpisodeAudioUrl(nowPlaying)}
                onClick={() => {
                  if (isPlaying) {
                    onPauseClick()
                  } else {
                    onPlayClick(nowPlaying)
                  }
                }}
              >
                {isPlaying ? "Pause episode" : "Play episode"}
              </PlayEpisodeButton>
              {(duration || date) && (
                <NowPlayingDuration variant="body3">
                  {[duration ? `${duration} min` : null, date]
                    .filter(Boolean)
                    .join("  •  ")}
                </NowPlayingDuration>
              )}
            </NowPlayingRight>
          </NowPlayingBottom>
        </NowPlayingBody>
      </NowPlayingCard>
    </Section>
  )
}

export default NowPlayingSection
