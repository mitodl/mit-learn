import React from "react"
import { RiPlayFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import * as Styled from "./VideoSeriesDetailPage.styled"
import { styled } from "ol-components"
import VideoShareButton from "./VideoShareButton"

const StyledVideoShareButton = styled(VideoShareButton)({
  height: "40px",
  marginTop: "8px",
  padding: "18px 16px",
})
type UpNextSectionProps = {
  nextVideo: VideoResource
  getVideoHref: (v: VideoResource) => string
  currentVideo: VideoResource
  shareUrl: string
}

const UpNextSection: React.FC<UpNextSectionProps> = ({
  nextVideo,
  getVideoHref,
  currentVideo,
  shareUrl,
}) => {
  return (
    <Styled.UpNextSection>
      <Styled.UpNextLeft>
        <Styled.UpNextLabel>Up Next</Styled.UpNextLabel>
        <Styled.UpNextTitle>{nextVideo.title}</Styled.UpNextTitle>
      </Styled.UpNextLeft>
      <Styled.UpNextRight>
        <StyledVideoShareButton
          video={currentVideo}
          title={currentVideo.title ?? ""}
          pageUrl={shareUrl}
        />
        <Styled.StyledButtonLink
          href={getVideoHref(nextVideo)}
          variant="primary"
          startIcon={<RiPlayFill size={16} />}
        >
          Continue
        </Styled.StyledButtonLink>
      </Styled.UpNextRight>
    </Styled.UpNextSection>
  )
}

export default UpNextSection
