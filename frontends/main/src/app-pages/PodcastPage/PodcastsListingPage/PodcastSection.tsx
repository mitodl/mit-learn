import React from "react"
import Link from "next/link"
import { Typography, Skeleton, styled } from "ol-components"
import type { TypographyProps } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiArrowRightSLine } from "@remixicon/react"
import { formatDate } from "ol-utilities"
import type { LearningResource } from "api/v1"
import { SEARCH_PODCASTS, podcastPageView } from "@/common/urls"
import {
  Section,
  SectionHeader,
  SectionTitle,
  SectionLink,
  SectionMessage,
} from "./styled"
import { formatApproxCount } from "./helpers"
import { PODCAST_FEATURED_COUNT, PODCAST_MORE_COUNT } from "./constants"

const PodcastDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  padding: "40px 0",
  lineHeight: "24px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0",
  },
}))

const PodcastGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "56px",
})

const FeaturedLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  padding: "24px 2px 24px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "0px 2px 22px 0",
  },
}))

const FeaturedPodcastRow = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

const FeaturedPodcastCard = styled(Link)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  padding: "40px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  // Adjacent cards share a single 1px divider instead of a doubled border.
  "&:not(:first-of-type)": {
    borderLeft: "none",
  },
  "&:hover .podcast-card-title": {
    color: theme.custom.colors.red,
  },
  "&:hover .podcast-card-arrow": {
    opacity: 1,
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    padding: "24px",
    // Cards stack vertically on mobile, so adjacent cards share a single
    // horizontal divider instead of a vertical one.
    "&:not(:first-of-type)": {
      borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
      borderTop: "none",
    },
  },
}))

const FeaturedPodcastHeader = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "24px",
})

const FeaturedPodcastImage = styled.img({
  width: "72px",
  height: "72px",
  objectFit: "cover",
  borderRadius: "8px",
})

const FeaturedPodcastArrow = styled(RiArrowRightSLine)(({ theme }) => ({
  flexShrink: 0,
  fontSize: "24px",
  color: theme.custom.colors.red,
  // Revealed on card hover via the parent's ".podcast-card-arrow" rule.
  opacity: 0,
  marginLeft: "auto",
}))

const FeaturedPodcastTitle = styled(Typography)<
  Pick<TypographyProps, "component">
>(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
}))

const FeaturedPodcastSummary = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "24px",
  marginBottom: "16px",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
}))

const FeaturedPodcastMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "22px",
}))

const MorePodcastRow = styled(Link)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "23px 0 24px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  textDecoration: "none",
  "&:hover .series-row-title": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
  },
}))

const MorePodcastLeft = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  minWidth: 0,
})

const MorePodcastTitle = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    color: theme.custom.colors.darkGray2,
    whiteSpace: "normal",
  }),
)

const MorePodcastOfferedBy = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}))

const MorePodcastMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
}))

const ViewAllContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  paddingTop: "40px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const ViewAllButton = styled(ButtonLink)(({ theme }) => ({
  padding: "12px 32px 12px 32px",
  height: "48px",
  ...theme.typography.body1,
  lineHeight: "16px",
  color: theme.custom.colors.darkRed,
  fontWeight: theme.typography.fontWeightMedium,
  whiteSpace: "nowrap",
  "&:hover:not(:disabled)": {
    color: theme.custom.colors.darkRed,
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "center",
  },
}))

const StyledRiArrowRightLine = styled(RiArrowRightLine)(() => ({
  fontSize: "24px",
}))

const MorePodcastSkeletonRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  padding: "23px 0 24px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const FeaturedPodcastSkeletonCard = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "40px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  "&:not(:first-of-type)": {
    borderLeft: "none",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "24px",
    "&:not(:first-of-type)": {
      borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
      borderTop: "none",
    },
  },
}))

const FeaturedPodcastsSkeleton = () => (
  <FeaturedPodcastRow>
    {Array.from({ length: PODCAST_FEATURED_COUNT }, (_unused, i) => (
      <FeaturedPodcastSkeletonCard key={i}>
        <Skeleton variant="rectangular" width={72} height={72} />
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="text" width="100%" height={48} />
        <Skeleton variant="text" width="40%" height={22} />
      </FeaturedPodcastSkeletonCard>
    ))}
  </FeaturedPodcastRow>
)

const MorePodcastsSkeleton = () => (
  <>
    {Array.from({ length: PODCAST_MORE_COUNT }, (_unused, i) => (
      <MorePodcastSkeletonRow key={i}>
        <Skeleton variant="text" width="40%" height={26} />
      </MorePodcastSkeletonRow>
    ))}
  </>
)

export type PodcastSectionProps = {
  featuredPodcasts: LearningResource[]
  morePodcasts: LearningResource[]
  hasMorePodcasts: boolean
  totalPodcasts: number
  isMobile: boolean
  isLoading?: boolean
  isError?: boolean
  isFeaturedLoading?: boolean
}

const PodcastSection: React.FC<PodcastSectionProps> = ({
  featuredPodcasts,
  morePodcasts,
  hasMorePodcasts,
  totalPodcasts,
  isMobile,
  isLoading = false,
  isError = false,
  isFeaturedLoading = false,
}) => {
  return (
    <Section style={{ paddingBottom: isMobile ? "32px" : "80px" }}>
      <SectionHeader>
        <SectionTitle>Podcasts across MIT</SectionTitle>
        <Link href={SEARCH_PODCASTS}>
          <SectionLink variant="subtitle1">All podcasts</SectionLink>
        </Link>
      </SectionHeader>
      <PodcastDescription variant="subtitle1">
        Departments, labs, and centers across MIT produce their own audio
        series. Each reflects a different part of the Institute.
      </PodcastDescription>

      <PodcastGroup>
        {(isFeaturedLoading || featuredPodcasts.length > 0) && (
          <div>
            <FeaturedLabel variant="subtitle2">FEATURED</FeaturedLabel>
            {isFeaturedLoading ? (
              <FeaturedPodcastsSkeleton />
            ) : (
              <FeaturedPodcastRow>
                {featuredPodcasts.map((item) => {
                  const episodeCount =
                    item.resource_type === "podcast"
                      ? item.podcast?.episode_count
                      : null
                  const updated = item.last_modified
                    ? formatDate(item.last_modified, "MMM D")
                    : null
                  return (
                    <FeaturedPodcastCard
                      key={item.id}
                      href={podcastPageView(String(item.id), item.title)}
                    >
                      <FeaturedPodcastHeader>
                        {item.image?.url && (
                          <FeaturedPodcastImage
                            src={item.image.url}
                            alt={item.image.alt ?? item.title}
                          />
                        )}
                        <FeaturedPodcastArrow
                          className="podcast-card-arrow"
                          aria-hidden="true"
                        />
                      </FeaturedPodcastHeader>
                      <FeaturedPodcastTitle
                        className="podcast-card-title"
                        variant="h4"
                        component="h3"
                      >
                        {item.title}
                      </FeaturedPodcastTitle>
                      {item.description && (
                        <FeaturedPodcastSummary variant="body1">
                          {item.description}
                        </FeaturedPodcastSummary>
                      )}
                      <FeaturedPodcastMeta variant="body2">
                        {[
                          episodeCount ? `${episodeCount} episodes` : null,
                          updated ? `Updated ${updated}` : null,
                        ]
                          .filter(Boolean)
                          .join("  •  ")}
                      </FeaturedPodcastMeta>
                    </FeaturedPodcastCard>
                  )
                })}
              </FeaturedPodcastRow>
            )}
          </div>
        )}

        <div>
          <SectionHeader>
            <SectionTitle>More Podcasts</SectionTitle>
          </SectionHeader>
          {isLoading && <MorePodcastsSkeleton />}
          {!isLoading && isError && (
            <SectionMessage variant="body1">
              Something went wrong loading podcasts. Please try again later.
            </SectionMessage>
          )}
          {!isLoading && !isError && morePodcasts.length === 0 && (
            <SectionMessage variant="body1">
              No podcasts available right now.
            </SectionMessage>
          )}
          {!isLoading &&
            !isError &&
            morePodcasts.map((item) => {
              const episodeCount =
                item.resource_type === "podcast"
                  ? item.podcast?.episode_count
                  : null
              const updated = item.last_modified
                ? formatDate(item.last_modified, "MMM D")
                : null
              return (
                <MorePodcastRow
                  key={item.id}
                  href={podcastPageView(String(item.id), item.title)}
                >
                  <MorePodcastLeft>
                    <MorePodcastTitle
                      className="series-row-title"
                      variant="h5"
                      component="h3"
                    >
                      {item.title}
                    </MorePodcastTitle>
                    {item.offered_by?.name && (
                      <MorePodcastOfferedBy variant="subtitle3">
                        {item.offered_by.name}
                      </MorePodcastOfferedBy>
                    )}
                  </MorePodcastLeft>
                  <MorePodcastMeta variant="body3">
                    {[episodeCount ? `${episodeCount} episodes` : null, updated]
                      .filter(Boolean)
                      .join("  •  ")}
                  </MorePodcastMeta>
                </MorePodcastRow>
              )
            })}
          {!isLoading &&
            !isError &&
            morePodcasts.length > 0 &&
            hasMorePodcasts && (
              <ViewAllContainer>
                <ViewAllButton
                  variant="bordered"
                  endIcon={<StyledRiArrowRightLine size={24} />}
                  href={SEARCH_PODCASTS}
                >
                  {`View all ${formatApproxCount(totalPodcasts)} podcasts`}
                </ViewAllButton>
              </ViewAllContainer>
            )}
        </div>
      </PodcastGroup>
    </Section>
  )
}

export default PodcastSection
