import React from "react"
import Link from "next/link"
import { Container, Skeleton, Typography, styled, theme } from "ol-components"
import type { VideoPlaylistResource } from "api/v1"

const Section = styled.section({
  padding: "80px 0",
})

const Heading = styled(Typography)({
  ...theme.typography.h4,
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  color: theme.custom.colors.black,
  marginBottom: "32px",
})

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
    rowGap: "22px",
  },
})

const CollectionLink = styled(Link)({
  display: "block",
  textDecoration: "none",
  color: "inherit",
})

const CollectionType = styled(Typography)({
  ...theme.typography.body3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: theme.custom.colors.silverGrayDark,
  marginBottom: "8px",
})

const CollectionTitle = styled(Typography)({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
  transition: "color 0.15s",

  "a:hover &": {
    color: theme.custom.colors.red,
  },
})

const CollectionMeta = styled(Typography)({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})

const parseDurationToHoursAndMinutes = (duration?: string): string | null => {
  if (!duration) return null

  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) {
    return duration
  }

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)

  const normalizedMinutes = minutes + Math.floor(seconds / 60)
  const totalHours = hours + Math.floor(normalizedMinutes / 60)
  const remainingMinutes = normalizedMinutes % 60

  if (totalHours > 0 && remainingMinutes > 0) {
    return `${totalHours}h ${remainingMinutes}m`
  }
  if (totalHours > 0) {
    return `${totalHours}h`
  }
  if (remainingMinutes > 0) {
    return `${remainingMinutes}m`
  }
  return null
}

const buildMeta = (playlist: VideoPlaylistResource): string => {
  const videoCount = playlist.video_playlist.video_count
  const videoCountLabel =
    videoCount === 1
      ? "1 video"
      : `${playlist.video_playlist.video_count} videos`
  const durationLabel = parseDurationToHoursAndMinutes(playlist.duration)

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
  return parseDurationToHoursAndMinutes(playlist.duration)
    ? "Video Series"
    : "Collection"
}

type OtherCollectionsProps = {
  collections: VideoPlaylistResource[]
  isLoading: boolean
}

const OtherCollections: React.FC<OtherCollectionsProps> = ({
  collections,
  isLoading,
}) => {
  if (!isLoading && collections.length === 0) {
    return null
  }

  return (
    <Section>
      <Container>
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
      </Container>
    </Section>
  )
}

export default OtherCollections
