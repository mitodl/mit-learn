import React from "react"
import { RiPlayFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import * as Styled from "./VideoSeriesDetailPage.styled"

type UpNextSectionProps = {
  nextVideo: VideoResource
  getVideoHref: (v: VideoResource) => string
}

const UpNextSection: React.FC<UpNextSectionProps> = ({
  nextVideo,
  getVideoHref,
}) => {
  return (
    <Styled.UpNextSection>
      <Styled.UpNextLeft>
        <Styled.UpNextLabel>Up Next</Styled.UpNextLabel>
        <Styled.UpNextTitle>{nextVideo.title}</Styled.UpNextTitle>
      </Styled.UpNextLeft>
      <Styled.StyledButtonLink
        href={getVideoHref(nextVideo)}
        variant="primary"
        startIcon={<RiPlayFill size={16} />}
      >
        Continue
      </Styled.StyledButtonLink>
    </Styled.UpNextSection>
  )
}

export default UpNextSection
