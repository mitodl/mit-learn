import React from "react"
import {
  Breadcrumbs,
  Skeleton,
  Typography,
  styled,
  type TypographyProps,
} from "ol-components"
import type { VideoPlaylistResource } from "api/v1"
import VideoContainer from "./VideoContainer"
import { richTextDescription } from "./shared.styled"
import { addExternalLinkTargets } from "@/common/utils"

const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))

const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span": {
    paddingBottom: 0,
  },
}))

const HeaderSection = styled.div<{ isSeries?: boolean; $shorts?: boolean }>(
  ({ theme, isSeries, $shorts }) => ({
    // A shorts grid starts 24px below the description.
    padding: $shorts ? "56px 0 24px" : "56px 0 72px",
    [theme.breakpoints.down("md")]: {
      padding: $shorts ? "32px 0 24px" : "32px 0 40px",
    },
    [theme.breakpoints.down("sm")]: {
      padding: isSeries
        ? "32px 0 16px"
        : $shorts
          ? "32px 0 24px"
          : "32px 0 40px",
    },
  }),
)

const CollectionLabel = styled.span<{ $shorts?: boolean }>(
  ({ theme, $shorts }) => ({
    display: "block",
    textTransform: "uppercase",
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightBold,
    color: $shorts ? theme.custom.colors.darkRed : theme.custom.colors.black,
    marginBottom: "8px",
    lineHeight: "150%" /* 18px */,
    letterSpacing: "1.92px",
  }),
)

const CollectionHeader = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  [theme.breakpoints.down("sm")]: {},
}))

const PageTitle = styled.h1<{ isSeries?: boolean }>(({ theme, isSeries }) => ({
  ...theme.typography.h2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  fontSize: "44px",
  margin: "0 0 24px",
  lineHeight: "120%",
  marginBottom: "16px",
  letterSpacing: "-0.88px",
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
    margin: "0 0 18px",
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h3,
    margin: isSeries ? "0 0 16px" : "0 0 8px",
    letterSpacing: "inherit",
  },
}))

/*
 * The Pick<TypographyProps, "component"> generic is what allows
 * component="div" at the call site. A sanitized OVS description contains block elements (<p>, <ul>), which are invalid inside Typography's default element for these variants (<p>).
 */
const PageDescription = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$shorts",
})<Pick<TypographyProps, "component"> & { $shorts?: boolean }>(
  ({ theme, $shorts }) => ({
    ...richTextDescription,
    color: $shorts
      ? theme.custom.colors.darkGray2
      : theme.custom.colors.darkGray1,
    ...theme.typography.body1,
    lineHeight: "26px",
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.body2,
      lineHeight: "22px",
    },
  }),
)

const CollectionTitle = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$shorts",
})<{ $shorts?: boolean }>(({ theme, $shorts }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.black,
  lineHeight: "150%",
  ...($shorts && {
    ...theme.typography.body2,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: "22px",
    marginBottom: "8px",
  }),
}))

type VideoPageHeaderProps = {
  playlist?: VideoPlaylistResource
  isSeries?: boolean
  /** A shorts playlist, whose grid of cards follows the header directly. */
  isShorts?: boolean
  totalVideos?: number
}

const VideoPageHeader: React.FC<VideoPageHeaderProps> = ({
  playlist,
  totalVideos,
  isSeries = false,
  isShorts = false,
}) => {
  const collectionLabel = playlist
    ? playlist.resource_category?.trim() || "Video Collection"
    : null

  return (
    <>
      <BreadcrumbBar>
        <VideoContainer>
          <StyledBreadcrumbs
            variant="light"
            ancestors={[{ href: "/", label: "Home" }]}
            current={playlist?.title}
          />
        </VideoContainer>
      </BreadcrumbBar>

      <HeaderSection isSeries={isSeries} $shorts={isShorts}>
        <VideoContainer>
          {collectionLabel === null ? (
            <Skeleton width={140} height={24} style={{ marginBottom: 18 }} />
          ) : (
            <CollectionLabel $shorts={isShorts}>
              {isSeries ? "Video Series" : collectionLabel}
            </CollectionLabel>
          )}

          <PageTitle isSeries={isSeries}>
            {playlist?.title ?? <Skeleton width={380} />}
          </PageTitle>
          {!isSeries && (
            <CollectionHeader>
              <CollectionTitle $shorts={isShorts}>
                {totalVideos} Videos
              </CollectionTitle>
            </CollectionHeader>
          )}
          {playlist === undefined ? (
            <Skeleton width={520} height={28} />
          ) : (
            <PageDescription
              component="div"
              $shorts={isShorts}
              /* Rich text, sanitized during ETL. Rendered as markup rather
                 than interpolated, or an author's formatting would appear to
                 the learner as visible tags. */
              dangerouslySetInnerHTML={{
                __html: addExternalLinkTargets(playlist.description ?? ""),
              }}
            />
          )}
        </VideoContainer>
      </HeaderSection>
    </>
  )
}

export default VideoPageHeader
