import React from "react"
import Link from "next/link"
import { Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine } from "@remixicon/react"
import { formatDate } from "ol-utilities"
import type { LearningResource } from "api/v1"
import { SEARCH_PODCASTS, podcastPageView } from "@/common/urls"
import { Section, SectionHeader, SectionTitle, SectionLink } from "./styled"
import { formatApproxCount } from "./helpers"

const SeriesDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  padding: "40px 0",
  lineHeight: "24px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0",
  },
}))

const SeriesGroup = styled.div({
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

const FeaturedSeriesRow = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

const FeaturedSeriesCard = styled(Link)(({ theme }) => ({
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
  "&:hover .series-card-title": {
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

const FeaturedSeriesImage = styled.img({
  width: "72px",
  height: "72px",
  objectFit: "cover",
  borderRadius: "8px",
  marginBottom: "24px",
})

const FeaturedSeriesTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
}))

const FeaturedSeriesSummary = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "24px",
  marginBottom: "16px",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
}))

const FeaturedSeriesMeta = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "22px",
}))

const MoreSeriesRow = styled(Link)(({ theme }) => ({
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

const MoreSeriesLeft = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  minWidth: 0,
})

const MoreSeriesTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "normal",
}))

const MoreSeriesOfferedBy = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}))

const MoreSeriesMeta = styled(Typography)(({ theme }) => ({
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

export type PodcastSeriesSectionProps = {
  featuredSeries: LearningResource[]
  moreSeries: LearningResource[]
  hasMoreSeries: boolean
  totalSeries: number
  isMobile: boolean
}

const PodcastSeriesSection: React.FC<PodcastSeriesSectionProps> = ({
  featuredSeries,
  moreSeries,
  hasMoreSeries,
  totalSeries,
  isMobile,
}) => {
  return (
    <Section style={{ paddingBottom: isMobile ? "32px" : "80px" }}>
      <SectionHeader>
        <SectionTitle variant="subtitle1">Podcasts across MIT</SectionTitle>
        <Link href={SEARCH_PODCASTS}>
          <SectionLink variant="subtitle1">All podcasts</SectionLink>
        </Link>
      </SectionHeader>
      <SeriesDescription variant="subtitle1">
        Departments, labs, and centers across MIT produce their own audio
        series. Each reflects a different part of the Institute.
      </SeriesDescription>

      <SeriesGroup>
        {featuredSeries.length > 0 && (
          <div>
            <FeaturedLabel variant="subtitle2">FEATURED</FeaturedLabel>
            <FeaturedSeriesRow>
              {featuredSeries.map((item) => {
                const episodeCount =
                  item.resource_type === "podcast"
                    ? item.podcast?.episode_count
                    : null
                const updated = item.last_modified
                  ? formatDate(item.last_modified, "MMM D")
                  : null
                return (
                  <FeaturedSeriesCard
                    key={item.id}
                    href={podcastPageView(String(item.id), item.title)}
                  >
                    {item.image?.url && (
                      <FeaturedSeriesImage
                        src={item.image.url}
                        alt={item.image.alt ?? item.title}
                      />
                    )}
                    <FeaturedSeriesTitle
                      className="series-card-title"
                      variant="h4"
                    >
                      {item.title}
                    </FeaturedSeriesTitle>
                    {item.description && (
                      <FeaturedSeriesSummary variant="body1">
                        {item.description}
                      </FeaturedSeriesSummary>
                    )}
                    <FeaturedSeriesMeta variant="body2">
                      {[
                        episodeCount ? `${episodeCount} episodes` : null,
                        updated ? `Updated ${updated}` : null,
                      ]
                        .filter(Boolean)
                        .join("  •  ")}
                    </FeaturedSeriesMeta>
                  </FeaturedSeriesCard>
                )
              })}
            </FeaturedSeriesRow>
          </div>
        )}

        {moreSeries.length > 0 && (
          <div>
            <SectionHeader>
              <SectionTitle variant="subtitle1">More Podcasts</SectionTitle>
            </SectionHeader>
            {moreSeries.map((item) => {
              const episodeCount =
                item.resource_type === "podcast"
                  ? item.podcast?.episode_count
                  : null
              const updated = item.last_modified
                ? formatDate(item.last_modified, "MMM D")
                : null
              return (
                <MoreSeriesRow
                  key={item.id}
                  href={podcastPageView(String(item.id), item.title)}
                >
                  <MoreSeriesLeft>
                    <MoreSeriesTitle className="series-row-title" variant="h5">
                      {item.title}
                    </MoreSeriesTitle>
                    {item.offered_by?.name && (
                      <MoreSeriesOfferedBy variant="subtitle3">
                        {item.offered_by.name}
                      </MoreSeriesOfferedBy>
                    )}
                  </MoreSeriesLeft>
                  <MoreSeriesMeta variant="body3">
                    {[episodeCount ? `${episodeCount} episodes` : null, updated]
                      .filter(Boolean)
                      .join("  •  ")}
                  </MoreSeriesMeta>
                </MoreSeriesRow>
              )
            })}
            {hasMoreSeries && (
              <ViewAllContainer>
                <ViewAllButton
                  variant="bordered"
                  endIcon={<StyledRiArrowRightLine size={24} />}
                  href={SEARCH_PODCASTS}
                >
                  {`View all ${formatApproxCount(totalSeries)} podcasts`}
                </ViewAllButton>
              </ViewAllContainer>
            )}
          </div>
        )}
      </SeriesGroup>
    </Section>
  )
}

export default PodcastSeriesSection
