import React from "react"
import { Breadcrumbs, Skeleton, Typography, styled, theme } from "ol-components"
import type { VideoPlaylistResource } from "api/v1"
import VideoContainer from "./VideoContainer"

const BreadcrumbBar = styled.div({
  padding: "32px 0 16px 0",
  borderBottom: `2px solid ${theme.custom.colors.red}`,
})

const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span": {
    paddingBottom: 0,
  },
}))

const HeaderSection = styled.div({
  padding: "56px 0 72px",
})

const CollectionLabel = styled.span(({ theme }) => ({
  display: "block",
  textTransform: "uppercase",
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  marginBottom: "8px",
  lineHeight: "150%" /* 18px */,
  letterSpacing: "1.92px",
}))

const PageTitle = styled.h1(({ theme }) => ({
  ...theme.typography.h2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
  fontSize: "44px",
  margin: "0 0 24px",
  lineHeight: "120%",
  marginBottom: "18px",
  letterSpacing: "-0.88px",
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
    margin: "0 0 18px",
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h4,
    margin: "0 0 14px",
  },
}))

const PageDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  maxWidth: "640px",
  ...theme.typography.body1,
  lineHeight: "26px",
}))

type VideoPageHeaderProps = {
  playlist?: VideoPlaylistResource
}

const VideoPageHeader: React.FC<VideoPageHeaderProps> = ({ playlist }) => {
  const collectionLabel = playlist
    ? playlist.resource_category?.trim() || "Video Collection"
    : null

  return (
    <>
      <BreadcrumbBar>
        <VideoContainer>
          <StyledBreadcrumbs
            variant="light"
            ancestors={[
              { href: "/", label: "Home" },
              { href: "/videos", label: "Videos" },
            ]}
            current={playlist?.title}
          />
        </VideoContainer>
      </BreadcrumbBar>

      <HeaderSection>
        <VideoContainer>
          {collectionLabel === null ? (
            <Skeleton width={140} height={24} style={{ marginBottom: 18 }} />
          ) : (
            <CollectionLabel>{collectionLabel}</CollectionLabel>
          )}

          <PageTitle>{playlist?.title ?? <Skeleton width={380} />}</PageTitle>
          {playlist === undefined ? (
            <Skeleton width={520} height={28} />
          ) : (
            <PageDescription>
              {playlist.description ||
                "Conversations with MIT faculty on the future of science, technology, and society."}
            </PageDescription>
          )}
        </VideoContainer>
      </HeaderSection>
    </>
  )
}

export default VideoPageHeader
