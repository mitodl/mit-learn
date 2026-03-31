import React from "react"
import { Container, Typography, styled, theme, Skeleton } from "ol-components"
import type { VideoPlaylistResource } from "api/v1"

const PageHeader = styled.div({
  padding: "24px 0 28px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: "#f8f8f8",
})

const PageHeaderTop = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
})

const PageHeaderContent = styled.div({
  flex: 1,
})

const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.black,
  marginBottom: "12px",
  lineHeight: 1.1,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h4,
  },
}))

const PageDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray1,
  maxWidth: "560px",
  ...theme.typography.body2,
}))

type VideoPageHeaderProps = {
  playlist?: VideoPlaylistResource
}

const VideoPageHeader: React.FC<VideoPageHeaderProps> = ({ playlist }) => {
  return (
    <PageHeader>
      <Container>
        <PageHeaderTop>
          <PageHeaderContent>
            <PageTitle>{playlist?.title ?? <Skeleton width={320} />}</PageTitle>
            <PageDescription>
              {playlist?.description ??
                "Conversations with MIT faculty on the future of science, technology, and society."}
            </PageDescription>
          </PageHeaderContent>
        </PageHeaderTop>
      </Container>
    </PageHeader>
  )
}

export default VideoPageHeader
