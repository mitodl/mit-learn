import React from "react"
import Link from "next/link"
import { Skeleton, Typography, styled, theme } from "ol-components"
import VideoContainer from "./VideoContainer"
import type { VideoPlaylistResource } from "api/v1"
import { formatDurationHuman } from "ol-utilities"

const Section = styled.section(({ theme }) => ({
  padding: "80px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "38px 0",
  },
}))

const Heading = styled(Typography)(({ theme }) => ({
  ...theme.typography.h4,
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  color: theme.custom.colors.black,
  marginBottom: "32px",
  lineHeight: "36px" /* 150% */,
  letterSpacing: "1.92px",
  [theme.breakpoints.down("sm")]: {
    fontSize: "22px",
    fontStyle: "normal",
    lineHeight: "36px" /* 163.636% */,
    letterSpacing: "1.76px",
    textTransform: "uppercase",
  },
}))

const Grid = styled.div({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  columnGap: "32px",
  rowGap: "32px",

  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    columnGap: "36px",
  },

  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    rowGap: "0",
  },
})

const CollectionLink = styled(Link)(({ theme }) => ({
  display: "block",
  textDecoration: "none",
  color: "inherit",
  [theme.breakpoints.down("sm")]: {
    borderBottom: "1px solid #DDE1E6",
    padding: "16px 0",
    "&:last-child": {
      borderBottom: "none",
    },
  },
}))

const CollectionType = styled(Typography)({
  ...theme.typography.body3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "8px",
  lineHeight: "16px" /* 133.333% */,
})

const CollectionTitle = styled(Typography)({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
  transition: "color 0.15s",
  lineHeight: "150%" /* 150% */,
  "a:hover &": {
    color: theme.custom.colors.red,
  },
})

const CollectionMeta = styled(Typography)({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "16px" /* 133.333% */,
})

const buildMeta = (playlist: VideoPlaylistResource): string => {
  const videoCount = playlist.video_playlist.video_count
  const videoCountLabel =
    videoCount === 1
      ? "1 video"
      : `${playlist.video_playlist.video_count} videos`
  const durationLabel = formatDurationHuman(`${playlist.duration}`)

  if (!durationLabel) {
    return videoCountLabel
  }

  return `${videoCountLabel} · ${durationLabel}`
}

const collectionTypeLabel = (playlist: VideoPlaylistResource): string => {
  const category = playlist.resource_category?.trim()
  if (category) {
    return category
  }

  return formatDurationHuman(`${playlist.duration}`)
    ? "Video Series"
    : "Collection"
}

type OtherCollectionsProps = {
  collections: VideoPlaylistResource[]
  isLoading: boolean
}

const RelatedPlaylist: React.FC<OtherCollectionsProps> = ({
  collections,
  isLoading,
}) => {
  if (!isLoading && collections.length === 0) {
    return null
  }
  return (
    <Section>
      <VideoContainer>
        <Heading>Other Collections</Heading>

        <Grid>
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <Skeleton variant="text" width="36%" height={22} />
                  <Skeleton variant="text" width="85%" height={34} />
                  <Skeleton variant="text" width="52%" height={24} />
                </div>
              ))
            : collections.map((collection) => (
                <CollectionLink
                  href={`/playlist/${collection.id}`}
                  key={collection.id}
                >
                  <CollectionType>
                    {collectionTypeLabel(collection)}
                  </CollectionType>
                  <CollectionTitle>{collection.title}</CollectionTitle>
                  <CollectionMeta>{buildMeta(collection)}</CollectionMeta>
                </CollectionLink>
              ))}
        </Grid>
      </VideoContainer>
    </Section>
  )
}

export default RelatedPlaylist
